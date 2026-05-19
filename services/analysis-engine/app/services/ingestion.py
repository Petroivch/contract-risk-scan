from __future__ import annotations

import atexit
import base64
import hashlib
import html
import re
import subprocess
import tempfile
import threading
import time
from dataclasses import dataclass
from dataclasses import field
from io import BytesIO
from pathlib import Path
from typing import Any
from zipfile import BadZipFile, ZipFile
from xml.etree import ElementTree as ET

from pypdf import PdfReader

from app.config.runtime import get_runtime_config
from app.localization import resolve_localized_text
from app.dto.analysis import AnalysisRunRequest
from app.services.contract_analysis import DetectedRole, extract_roles_from_text
from app.services.text_normalization import normalize_contract_text


@dataclass(slots=True)
class IngestionPayload:
    document_name: str
    mime_type: str | None
    text: str
    detected_roles: list[DetectedRole]
    extraction_source: str
    extraction_ok: bool
    extraction_error: str | None
    sha256: str | None
    binary_payload: bytes | None = field(default=None, repr=False, compare=False)


@dataclass(slots=True)
class ExtractionResult:
    text: str
    extraction_source: str
    extraction_ok: bool
    extraction_error: str | None = None


@dataclass(slots=True)
class RenderedPdfPage:
    page_number: int
    page_count: int
    image: Any


@dataclass(slots=True)
class PdfTextCandidate:
    text: str
    extraction_source: str
    quality_score: float
    usable: bool


class IngestionService:
    """Document ingestion with multi-strategy extraction for text, doc, docx, pdf and html."""

    _word_app = None
    _word_pythoncom = None
    _word_lock = threading.Lock()
    _MIN_PDF_TEXT_CHARS = 40
    _MIN_PDF_TEXT_QUALITY = 0.55
    _PDF_OCR_DPI = 200

    def __init__(self) -> None:
        self._runtime_config = get_runtime_config()
        self._ingestion_config = self._runtime_config.pipeline.ingestion

    def ingest(self, request: AnalysisRunRequest) -> IngestionPayload:
        limits = self._runtime_config.pipeline.limits
        errors = self._runtime_config.pipeline.errors

        if request.document_text and len(request.document_text) > limits.max_document_text_chars:
            raise ValueError(resolve_localized_text(errors.document_text_too_long, request.language))

        if request.document_base64 and len(request.document_base64) > limits.max_document_base64_chars:
            raise ValueError(resolve_localized_text(errors.document_base64_too_long, request.language))

        binary_payload: bytes | None = None
        sha256: str | None = None
        if request.document_base64:
            binary_payload = self._decode_base64_payload(request.document_base64)
            sha256 = hashlib.sha256(binary_payload).hexdigest()
        elif request.document_text is not None:
            sha256 = hashlib.sha256(request.document_text.encode("utf-8", errors="ignore")).hexdigest()

        if request.document_text:
            extracted = ExtractionResult(
                text=normalize_contract_text(request.document_text),
                extraction_source="request.document_text",
                extraction_ok=bool(request.document_text.strip()),
                extraction_error=None if request.document_text.strip() else "document_text is empty after trim",
            )
        else:
            extracted = self._extract_text_from_binary_payload(
                payload=binary_payload or b"",
                mime_type=request.mime_type,
                document_name=request.document_name,
            )
            extracted.text = normalize_contract_text(extracted.text)

        text = extracted.text
        if not text:
            text = resolve_localized_text(
                self._runtime_config.pipeline.ingestion.empty_text_placeholder,
                request.language,
            )
        detected_roles = extract_roles_from_text(text)

        return IngestionPayload(
            document_name=request.document_name,
            mime_type=request.mime_type,
            text=text,
            detected_roles=detected_roles,
            extraction_source=extracted.extraction_source,
            extraction_ok=extracted.extraction_ok,
            extraction_error=extracted.extraction_error,
            sha256=sha256,
            binary_payload=binary_payload,
        )

    @staticmethod
    def _decode_base64_payload(payload: str) -> bytes:
        normalized_payload = payload.strip()
        padding = (-len(normalized_payload)) % 4
        if padding:
            normalized_payload = f"{normalized_payload}{'=' * padding}"

        return base64.b64decode(normalized_payload)

    def _extract_text_from_binary_payload(
        self,
        payload: bytes,
        mime_type: str | None,
        document_name: str,
    ) -> ExtractionResult:
        normalized_mime_type = (mime_type or "").strip().lower()
        normalized_name = document_name.strip().lower()

        if self._is_docx(normalized_mime_type, normalized_name):
            return self._extract_docx(payload)

        if self._is_doc(normalized_mime_type, normalized_name):
            return self._extract_doc(payload)

        if self._is_pdf(normalized_mime_type, normalized_name):
            return self._extract_pdf(payload)

        if self._is_html(normalized_mime_type, normalized_name):
            return self._extract_html(payload)

        if self._is_plain_text(normalized_mime_type, normalized_name):
            return self._extract_plain_text(payload)

        return ExtractionResult(
            text=payload.decode("utf-8", errors="ignore"),
            extraction_source="binary:utf8_decode",
            extraction_ok=bool(payload),
            extraction_error=None if payload else "empty binary payload",
        )

    @staticmethod
    def _is_docx(mime_type: str, file_name: str) -> bool:
        return mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document" or file_name.endswith(
            ".docx"
        )

    @staticmethod
    def _is_doc(mime_type: str, file_name: str) -> bool:
        return mime_type == "application/msword" or file_name.endswith(".doc")

    @staticmethod
    def _is_pdf(mime_type: str, file_name: str) -> bool:
        return mime_type == "application/pdf" or file_name.endswith(".pdf")

    @staticmethod
    def _is_html(mime_type: str, file_name: str) -> bool:
        return mime_type in {"text/html", "application/xhtml+xml"} or file_name.endswith((".html", ".htm"))

    @staticmethod
    def _is_plain_text(mime_type: str, file_name: str) -> bool:
        return mime_type.startswith("text/") or file_name.endswith(".txt")

    @staticmethod
    def _extract_plain_text(payload: bytes) -> ExtractionResult:
        text = payload.decode("utf-8", errors="ignore").strip()
        return ExtractionResult(
            text=text,
            extraction_source="txt:utf8",
            extraction_ok=bool(text),
            extraction_error=None if text else "txt extraction returned empty text",
        )

    def _extract_docx(self, payload: bytes) -> ExtractionResult:
        errors: list[str] = []

        if self._extractors_enabled("docx_mammoth"):
            try:
                import mammoth

                result = mammoth.extract_raw_text(BytesIO(payload))
                text = self._collapse_blank_lines((result.value or "").strip())
                if text:
                    return ExtractionResult(text=text, extraction_source="docx:mammoth", extraction_ok=True)
                errors.append("mammoth returned empty text")
            except Exception as exc:  # pragma: no cover - environment dependent
                errors.append(f"mammoth: {exc}")

        if self._extractors_enabled("docx_python_docx"):
            try:
                from docx import Document

                document = Document(BytesIO(payload))
                paragraphs = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]
                text = self._collapse_blank_lines("\n".join(paragraphs).strip())
                if text:
                    return ExtractionResult(text=text, extraction_source="docx:python-docx", extraction_ok=True)
                errors.append("python-docx returned empty text")
            except Exception as exc:  # pragma: no cover - environment dependent
                errors.append(f"python-docx: {exc}")

        fallback = self._extract_docx_xml(payload)
        if fallback:
            return ExtractionResult(text=fallback, extraction_source="docx:xml", extraction_ok=True)

        return ExtractionResult(
            text="",
            extraction_source="docx:none",
            extraction_ok=False,
            extraction_error="; ".join(errors) if errors else "docx extraction failed",
        )

    @staticmethod
    def _extract_docx_xml(payload: bytes) -> str:
        try:
            with ZipFile(BytesIO(payload)) as archive:
                document_xml = archive.read("word/document.xml")
        except (BadZipFile, KeyError, ValueError):
            return ""

        try:
            root = ET.fromstring(document_xml)
        except ET.ParseError:
            return ""

        namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        paragraphs: list[str] = []
        for paragraph in root.findall(".//w:p", namespace):
            text_chunks = [node.text or "" for node in paragraph.findall(".//w:t", namespace)]
            merged = "".join(text_chunks).strip()
            if merged:
                paragraphs.append(merged)

        return "\n".join(paragraphs)

    def _extract_pdf(self, payload: bytes) -> ExtractionResult:
        direct_result = self._extract_pdf_direct_text(payload)
        if self._has_usable_pdf_text(direct_result.text):
            return direct_result

        ocr_result = self._extract_scanned_pdf_with_ocr(payload)
        if ocr_result.extraction_ok and ocr_result.text.strip():
            return ocr_result

        errors = [error for error in (direct_result.extraction_error, ocr_result.extraction_error) if error]
        if direct_result.text.strip():
            return ExtractionResult(
                text=direct_result.text,
                extraction_source=direct_result.extraction_source,
                extraction_ok=True,
                extraction_error=(
                    "pdf text below OCR threshold; OCR fallback unavailable: "
                    + ("; ".join(errors) if errors else "no OCR text returned")
                ),
            )

        return ExtractionResult(
            text="",
            extraction_source="pdf:none",
            extraction_ok=False,
            extraction_error=(
                "; ".join(errors)
                if errors
                else "pdf extraction failed: no readable text found; document may be scanned or image-only"
            ),
        )

    def _extract_pdf_direct_text(self, payload: bytes) -> ExtractionResult:
        errors: list[str] = []
        candidates: list[PdfTextCandidate] = []

        if self._extractors_enabled("pdf_pdfplumber"):
            try:
                import pdfplumber

                with pdfplumber.open(BytesIO(payload)) as pdf:
                    pages = [self._normalize_pdf_page_text(page.extract_text() or "") for page in pdf.pages]
                text = self._normalize_pdf_text("\n\n".join(page for page in pages if page))
                if self._add_pdf_text_candidate(candidates, text, "pdf:pdfplumber"):
                    if not candidates[-1].usable:
                        errors.append("pdfplumber returned low-quality text")
                else:
                    errors.append("pdfplumber returned empty text")
            except Exception as exc:  # pragma: no cover - environment dependent
                errors.append(f"pdfplumber: {exc}")

        if self._extractors_enabled("pdf_pdfminer"):
            try:
                from pdfminer.high_level import extract_text as pdfminer_extract_text

                text = self._normalize_pdf_text(pdfminer_extract_text(BytesIO(payload)) or "")
                if self._add_pdf_text_candidate(candidates, text, "pdf:pdfminer"):
                    if not candidates[-1].usable:
                        errors.append("pdfminer returned low-quality text")
                else:
                    errors.append("pdfminer returned empty text")
            except Exception as exc:  # pragma: no cover - environment dependent
                errors.append(f"pdfminer: {exc}")

        if self._extractors_enabled("pdf_pypdf"):
            try:
                reader = PdfReader(BytesIO(payload))
                text_chunks: list[str] = []
                page_errors = 0
                for page in reader.pages:
                    try:
                        page_text = self._normalize_pdf_page_text(page.extract_text() or "")
                    except Exception:
                        page_errors += 1
                        page_text = ""
                    if page_text:
                        text_chunks.append(page_text)
                text = self._normalize_pdf_text("\n\n".join(text_chunks))
                if self._add_pdf_text_candidate(candidates, text, "pdf:pypdf"):
                    if not candidates[-1].usable:
                        errors.append("pypdf returned low-quality text")
                else:
                    errors.append("pypdf returned empty text")
                if page_errors:
                    errors.append(f"pypdf skipped {page_errors} page(s) after extraction errors")
            except Exception as exc:  # pragma: no cover - environment dependent
                errors.append(f"pypdf: {exc}")

        usable_candidates = [candidate for candidate in candidates if candidate.usable]
        if usable_candidates:
            best = max(usable_candidates, key=self._pdf_candidate_rank)
            return ExtractionResult(text=best.text, extraction_source=best.extraction_source, extraction_ok=True)

        if candidates:
            best = max(candidates, key=self._pdf_candidate_rank)
            return ExtractionResult(
                text=best.text,
                extraction_source=best.extraction_source,
                extraction_ok=False,
                extraction_error=(
                    "; ".join(errors)
                    if errors
                    else "pdf direct text extraction returned only low-quality text"
                ),
            )

        return ExtractionResult(
            text="",
            extraction_source="pdf:none",
            extraction_ok=False,
            extraction_error=(
                "; ".join(errors)
                if errors
                else "pdf direct text extraction found no readable text; document may be scanned or image-only"
            ),
        )

    def _add_pdf_text_candidate(
        self,
        candidates: list[PdfTextCandidate],
        text: str,
        extraction_source: str,
    ) -> bool:
        if not text.strip():
            return False

        quality_score = self._pdf_text_quality_score(text)
        candidates.append(
            PdfTextCandidate(
                text=text,
                extraction_source=extraction_source,
                quality_score=quality_score,
                usable=quality_score >= self._MIN_PDF_TEXT_QUALITY,
            )
        )
        return True

    @classmethod
    def _normalize_pdf_page_text(cls, text: str) -> str:
        text = text.replace("\x00", "").replace("\xa0", " ").replace("\r", "\n")
        text = re.sub(r"(?<=\w)-\n(?=\w)", "", text)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"[ \t]*\n[ \t]*", "\n", text)
        return text.strip()

    @classmethod
    def _normalize_pdf_text(cls, text: str) -> str:
        paragraphs = [cls._normalize_pdf_page_text(paragraph) for paragraph in re.split(r"\n{2,}", text)]
        text = "\n\n".join(paragraph for paragraph in paragraphs if paragraph)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    @classmethod
    def _pdf_text_quality_score(cls, text: str) -> float:
        compact = re.sub(r"\s+", "", text)
        if not compact:
            return 0.0

        replacement_penalty = min(0.45, compact.count("\ufffd") / len(compact) * 3)
        control_count = sum(1 for char in compact if ord(char) < 32)
        control_penalty = min(0.25, control_count / len(compact) * 2)
        readable_count = sum(1 for char in compact if char.isalnum() or char in ".,;:!?()[]{}№%+-=/\\\"'")
        readable_ratio = readable_count / len(compact)
        letter_ratio = sum(1 for char in compact if char.isalpha()) / len(compact)
        return max(0.0, readable_ratio * 0.75 + min(letter_ratio * 2, 1.0) * 0.25 - replacement_penalty - control_penalty)

    @staticmethod
    def _pdf_candidate_rank(candidate: PdfTextCandidate) -> tuple[float, int, int]:
        source_priority = {
            "pdf:pdfplumber": 3,
            "pdf:pypdf": 2,
            "pdf:pdfminer": 1,
        }.get(candidate.extraction_source, 0)
        return candidate.quality_score, source_priority, len(candidate.text)

    def _has_enough_pdf_text(self, text: str) -> bool:
        normalized = re.sub(r"\s+", "", text)
        return len(normalized) >= self._MIN_PDF_TEXT_CHARS

    def _has_usable_pdf_text(self, text: str) -> bool:
        return self._has_enough_pdf_text(text) and self._pdf_text_quality_score(text) >= self._MIN_PDF_TEXT_QUALITY

    def _extract_scanned_pdf_with_ocr(self, payload: bytes) -> ExtractionResult:
        deadline = time.monotonic() + min(
            self._runtime_config.pipeline.timeouts.ocr_seconds,
            self._ingestion_config.extraction_timeout_seconds,
        )
        rendered_pages, render_errors = self._render_pdf_pages_for_ocr(payload, deadline)
        if not rendered_pages:
            return ExtractionResult(
                text="",
                extraction_source="pdf:ocr:none",
                extraction_ok=False,
                extraction_error=(
                    "pdf OCR fallback unavailable: "
                    + ("; ".join(render_errors) if render_errors else "no pages rendered")
                ),
            )

        text_chunks: list[str] = []
        errors: list[str] = list(render_errors)
        processed_pages = 0
        page_count = rendered_pages[0].page_count
        for rendered_page in rendered_pages:
            if time.monotonic() >= deadline:
                errors.append(f"pdf OCR timeout after {processed_pages}/{page_count} pages")
                break
            processed_pages += 1
            try:
                page_text = self._ocr_image_to_text(rendered_page.image).strip()
            except Exception as exc:  # pragma: no cover - OCR engine dependent
                errors.append(f"pdf OCR page {rendered_page.page_number}/{page_count} failed: {exc}")
                continue
            if page_text:
                text_chunks.append(page_text)

        text = self._collapse_blank_lines("\n".join(text_chunks).strip())
        if text:
            return ExtractionResult(
                text=text,
                extraction_source=f"pdf:ocr:tesseract({processed_pages}/{page_count} pages)",
                extraction_ok=True,
                extraction_error=None,
            )

        return ExtractionResult(
            text="",
            extraction_source="pdf:ocr:none",
            extraction_ok=False,
            extraction_error="; ".join(errors) if errors else "pdf OCR returned empty text",
        )

    def _render_pdf_pages_for_ocr(
        self,
        payload: bytes,
        deadline: float,
    ) -> tuple[list[RenderedPdfPage], list[str]]:
        errors: list[str] = []

        pages, error = self._render_pdf_with_pdfplumber(payload, deadline)
        if pages:
            if error:
                errors.append(error)
            return pages, errors
        if error:
            errors.append(error)

        pages, error = self._render_pdf_with_pymupdf(payload, deadline)
        if pages:
            if error:
                errors.append(error)
            return pages, errors
        if error:
            errors.append(error)

        pages, error = self._render_pdf_with_pdf2image(payload, deadline)
        if pages:
            if error:
                errors.append(error)
            return pages, errors
        if error:
            errors.append(error)

        return [], errors

    def _render_pdf_with_pdfplumber(
        self,
        payload: bytes,
        deadline: float,
    ) -> tuple[list[RenderedPdfPage], str | None]:
        try:
            import pdfplumber
        except Exception as exc:  # pragma: no cover - configured dependency missing
            return [], f"pdfplumber renderer unavailable: {exc}"

        pages: list[RenderedPdfPage] = []
        try:
            with pdfplumber.open(BytesIO(payload)) as pdf:
                page_count = len(pdf.pages)
                for index, page in enumerate(pdf.pages, start=1):
                    if time.monotonic() >= deadline:
                        return pages, f"pdfplumber render timeout after {len(pages)}/{page_count} pages"
                    image = page.to_image(resolution=self._PDF_OCR_DPI).original
                    pages.append(RenderedPdfPage(page_number=index, page_count=page_count, image=image))
            return pages, None
        except Exception as exc:  # pragma: no cover - renderer dependent
            return pages, f"pdfplumber render failed: {exc}"

    def _render_pdf_with_pymupdf(
        self,
        payload: bytes,
        deadline: float,
    ) -> tuple[list[RenderedPdfPage], str | None]:
        try:
            import fitz  # type: ignore[import-not-found]
            from PIL import Image
        except Exception as exc:  # pragma: no cover - optional dependency
            return [], f"PyMuPDF renderer unavailable: {exc}"

        try:
            document = fitz.open(stream=payload, filetype="pdf")
        except Exception as exc:  # pragma: no cover - malformed PDF
            return [], f"PyMuPDF open failed: {exc}"

        pages: list[RenderedPdfPage] = []
        try:
            page_count = len(document)
            zoom = self._PDF_OCR_DPI / 72
            matrix = fitz.Matrix(zoom, zoom)
            for index, page in enumerate(document, start=1):
                if time.monotonic() >= deadline:
                    return pages, f"PyMuPDF render timeout after {len(pages)}/{page_count} pages"
                pixmap = page.get_pixmap(matrix=matrix, alpha=False)
                image = Image.open(BytesIO(pixmap.tobytes("png")))
                pages.append(RenderedPdfPage(page_number=index, page_count=page_count, image=image))
            return pages, None
        except Exception as exc:  # pragma: no cover - renderer dependent
            return pages, f"PyMuPDF render failed: {exc}"
        finally:  # pragma: no cover - cleanup path
            document.close()

    def _render_pdf_with_pdf2image(
        self,
        payload: bytes,
        deadline: float,
    ) -> tuple[list[RenderedPdfPage], str | None]:
        try:
            from pdf2image import convert_from_bytes  # type: ignore[import-not-found]
        except Exception as exc:  # pragma: no cover - optional dependency
            return [], f"pdf2image renderer unavailable: {exc}"

        remaining_seconds = max(1, int(deadline - time.monotonic()))
        try:
            images = convert_from_bytes(
                payload,
                dpi=self._PDF_OCR_DPI,
                fmt="png",
                thread_count=1,
                timeout=remaining_seconds,
            )
        except Exception as exc:  # pragma: no cover - external poppler dependency
            return [], f"pdf2image render failed: {exc}"

        page_count = len(images)
        pages = [
            RenderedPdfPage(page_number=index, page_count=page_count, image=image)
            for index, image in enumerate(images, start=1)
        ]
        return pages, None

    @staticmethod
    def _ocr_image_to_text(image: Any) -> str:
        import pytesseract

        return normalize_contract_text(pytesseract.image_to_string(image))

    def _extract_doc(self, payload: bytes) -> ExtractionResult:
        return ExtractionResult(
            text="",
            extraction_source="doc:unsupported",
            extraction_ok=False,
            extraction_error=(
                "application/msword (.doc) is not supported reliably by this analysis-engine build; "
                "convert the document to DOCX, PDF, or TXT before upload"
            ),
        )

    def _extract_doc_with_optional_tools(self, payload: bytes) -> ExtractionResult:
        errors: list[str] = []
        with tempfile.TemporaryDirectory(prefix="analysis-doc-") as temp_dir_name:
            temp_dir = Path(temp_dir_name)
            input_path = temp_dir / "source.doc"
            input_path.write_bytes(payload)

            strategies = [
                self._extract_doc_via_word_com,
                self._extract_doc_via_soffice,
                self._extract_doc_via_antiword,
                self._extract_doc_via_catdoc,
                self._extract_doc_via_textract,
            ]

            for strategy in strategies:
                try:
                    result = strategy(input_path, temp_dir)
                except Exception as exc:  # pragma: no cover - environment dependent
                    errors.append(f"{strategy.__name__}: {exc}")
                    continue
                if result.extraction_ok and result.text.strip():
                    return result
                if result.extraction_error:
                    errors.append(result.extraction_error)

        return ExtractionResult(
            text="",
            extraction_source="doc:none",
            extraction_ok=False,
            extraction_error="; ".join(errors) if errors else "doc extraction failed",
        )

    def _extract_doc_via_word_com(self, input_path: Path, temp_dir: Path) -> ExtractionResult:
        if not self._extractors_enabled("doc_word_com"):
            return ExtractionResult("", "doc:word_com", False, "Word COM extractor disabled")

        output_docx = temp_dir / "word-com-output.docx"
        document = None
        try:
            word, pythoncom = self._get_word_app()
            document = word.Documents.Open(str(input_path), False, True, False)
            direct_text = self._normalize_word_text(document.Content.Text)
            if direct_text:
                return ExtractionResult(
                    text=direct_text,
                    extraction_source="doc:word_com:text",
                    extraction_ok=True,
                )
            document.SaveAs2(str(output_docx), FileFormat=16)
        except Exception as exc:  # pragma: no cover - environment dependent
            return ExtractionResult("", "doc:word_com", False, f"doc:word_com failed: {exc}")
        finally:  # pragma: no cover - cleanup path
            if document is not None:
                try:
                    document.Close(False)
                except Exception:
                    pass

        if not output_docx.exists():
            return ExtractionResult("", "doc:word_com", False, "doc:word_com failed: no output file")

        payload = output_docx.read_bytes()
        nested = self._extract_docx(payload)
        return ExtractionResult(
            text=nested.text,
            extraction_source=f"doc:word_com->{nested.extraction_source}",
            extraction_ok=nested.extraction_ok,
            extraction_error=nested.extraction_error,
        )

    @classmethod
    def _get_word_app(cls):  # pragma: no cover - environment dependent
        with cls._word_lock:
            if cls._word_app is not None and cls._word_pythoncom is not None:
                return cls._word_app, cls._word_pythoncom

            import pythoncom
            from win32com.client import DispatchEx

            pythoncom.CoInitialize()
            word = DispatchEx("Word.Application")
            word.Visible = False
            word.DisplayAlerts = 0
            cls._word_app = word
            cls._word_pythoncom = pythoncom
            atexit.register(cls._shutdown_word_app)
            return cls._word_app, cls._word_pythoncom

    @classmethod
    def _shutdown_word_app(cls) -> None:  # pragma: no cover - environment dependent
        with cls._word_lock:
            if cls._word_app is not None:
                try:
                    cls._word_app.Quit()
                except Exception:
                    pass
                cls._word_app = None
            if cls._word_pythoncom is not None:
                try:
                    cls._word_pythoncom.CoUninitialize()
                except Exception:
                    pass
                cls._word_pythoncom = None

    def _extract_doc_via_soffice(self, input_path: Path, temp_dir: Path) -> ExtractionResult:
        if not self._extractors_enabled("doc_soffice"):
            return ExtractionResult("", "doc:soffice", False, "LibreOffice extractor disabled")
        if not self._command_exists("soffice"):
            return ExtractionResult("", "doc:soffice", False, "soffice not found")

        completed = subprocess.run(
            ["soffice", "--headless", "--convert-to", "docx", "--outdir", str(temp_dir), str(input_path)],
            capture_output=True,
            text=True,
            timeout=self._ingestion_config.extraction_timeout_seconds,
            check=False,
        )
        output_docx = temp_dir / f"{input_path.stem}.docx"
        if completed.returncode != 0 or not output_docx.exists():
            stderr = (completed.stderr or completed.stdout or "").strip()
            return ExtractionResult("", "doc:soffice", False, f"doc:soffice failed: {stderr or 'no output file'}")

        nested = self._extract_docx(output_docx.read_bytes())
        return ExtractionResult(
            text=nested.text,
            extraction_source=f"doc:soffice->{nested.extraction_source}",
            extraction_ok=nested.extraction_ok,
            extraction_error=nested.extraction_error,
        )

    def _extract_doc_via_antiword(self, input_path: Path, _temp_dir: Path) -> ExtractionResult:
        if not self._extractors_enabled("doc_antiword"):
            return ExtractionResult("", "doc:antiword", False, "antiword extractor disabled")
        if not self._command_exists("antiword"):
            return ExtractionResult("", "doc:antiword", False, "antiword not found")
        completed = subprocess.run(
            ["antiword", str(input_path)],
            capture_output=True,
            text=True,
            timeout=self._ingestion_config.extraction_timeout_seconds,
            check=False,
        )
        text = (completed.stdout or "").strip()
        if text:
            return ExtractionResult(text=text, extraction_source="doc:antiword", extraction_ok=True)
        stderr = (completed.stderr or "").strip()
        return ExtractionResult("", "doc:antiword", False, f"doc:antiword failed: {stderr or 'empty output'}")

    def _extract_doc_via_catdoc(self, input_path: Path, _temp_dir: Path) -> ExtractionResult:
        if not self._extractors_enabled("doc_catdoc"):
            return ExtractionResult("", "doc:catdoc", False, "catdoc extractor disabled")
        if not self._command_exists("catdoc"):
            return ExtractionResult("", "doc:catdoc", False, "catdoc not found")
        completed = subprocess.run(
            ["catdoc", str(input_path)],
            capture_output=True,
            text=True,
            timeout=self._ingestion_config.extraction_timeout_seconds,
            check=False,
        )
        text = (completed.stdout or "").strip()
        if text:
            return ExtractionResult(text=text, extraction_source="doc:catdoc", extraction_ok=True)
        stderr = (completed.stderr or "").strip()
        return ExtractionResult("", "doc:catdoc", False, f"doc:catdoc failed: {stderr or 'empty output'}")

    def _extract_doc_via_textract(self, input_path: Path, _temp_dir: Path) -> ExtractionResult:
        if not self._extractors_enabled("doc_textract"):
            return ExtractionResult("", "doc:textract", False, "textract extractor disabled")
        try:
            import textract
        except Exception as exc:  # pragma: no cover - optional dependency
            return ExtractionResult("", "doc:textract", False, f"textract import failed: {exc}")

        try:
            text = textract.process(str(input_path)).decode("utf-8", errors="ignore").strip()
        except Exception as exc:  # pragma: no cover - optional dependency
            return ExtractionResult("", "doc:textract", False, f"textract failed: {exc}")

        if text:
            return ExtractionResult(text=text, extraction_source="doc:textract", extraction_ok=True)
        return ExtractionResult("", "doc:textract", False, "textract returned empty text")

    @staticmethod
    def _extract_html(payload: bytes) -> ExtractionResult:
        raw = payload.decode("utf-8", errors="ignore")
        without_scripts = re.sub(r"(?is)<(script|style).*?>.*?</\\1>", " ", raw)
        without_tags = re.sub(r"(?is)<[^>]+>", " ", without_scripts)
        normalized = html.unescape(re.sub(r"\s+", " ", without_tags)).strip()
        return ExtractionResult(
            text=normalized,
            extraction_source="html:regex",
            extraction_ok=bool(normalized),
            extraction_error=None if normalized else "html extraction returned empty text",
        )

    @staticmethod
    def _collapse_blank_lines(text: str) -> str:
        return re.sub(r"\n{2,}", "\n", text)

    @staticmethod
    def _normalize_word_text(text: str) -> str:
        cleaned = text.replace("\r", "\n").replace("\x07", " ").replace("\x0b", "\n")
        cleaned = re.sub(r"[ \t]+", " ", cleaned)
        cleaned = re.sub(r"\n{2,}", "\n", cleaned)
        return cleaned.strip()

    def _extractors_enabled(self, key: str) -> bool:
        extractors = self._ingestion_config.extractors_enabled
        if not extractors:
            return True
        return extractors.get(key, True)

    @staticmethod
    def _command_exists(command: str) -> bool:
        completed = subprocess.run(
            ["where.exe", command],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        return completed.returncode == 0

