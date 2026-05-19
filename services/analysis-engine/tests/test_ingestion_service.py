from __future__ import annotations

import base64
import sys
from types import SimpleNamespace
from io import BytesIO
from zipfile import ZipFile

from app.config.runtime import get_runtime_config
from app.localization import resolve_localized_text
from app.dto.analysis import AnalysisRunRequest
import app.services.ingestion as ingestion_module
from app.services.ingestion import ExtractionResult, IngestionPayload, IngestionService, RenderedPdfPage
from app.repository.job_store import InMemoryJobStore


def _encode_base64(payload: bytes) -> str:
    return base64.b64encode(payload).decode("ascii")


def _build_docx_bytes(paragraphs: list[str], *, include_document_xml: bool = True) -> bytes:
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    relationships = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="word/document.xml"/>'
        "</Relationships>"
    )
    document_body = "".join(f"<w:p><w:r><w:t>{paragraph}</w:t></w:r></w:p>" for paragraph in paragraphs)
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{document_body}</w:body>"
        "</w:document>"
    )

    buffer = BytesIO()
    with ZipFile(buffer, "w") as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", relationships)
        if include_document_xml:
            archive.writestr("word/document.xml", document_xml)

    return buffer.getvalue()


def _build_simple_pdf_bytes(lines: list[str]) -> bytes:
    def escape_pdf_text(value: str) -> str:
        return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    commands = ["BT", "/F1 12 Tf", "72 720 Td"]
    for index, line in enumerate(lines):
        if index:
            commands.append("0 -18 Td")
        commands.append(f"({escape_pdf_text(line)}) Tj")
    commands.append("ET")

    content = "\n".join(commands).encode("latin-1")
    objects = [
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
        b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
        f"5 0 obj\n<< /Length {len(content)} >>\nstream\n".encode("ascii")
        + content
        + b"\nendstream\nendobj\n",
    ]

    pdf = b"%PDF-1.4\n"
    offsets: list[int] = []
    for obj in objects:
        offsets.append(len(pdf))
        pdf += obj

    xref_offset = len(pdf)
    pdf += b"xref\n0 6\n0000000000 65535 f \n"
    for offset in offsets:
        pdf += f"{offset:010d} 00000 n \n".encode("ascii")
    pdf += (
        b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n"
        + str(xref_offset).encode("ascii")
        + b"\n%%EOF"
    )
    return pdf


def _build_request(**overrides: object) -> AnalysisRunRequest:
    payload = {
        "document_name": "contract.txt",
        "role_context": {"role": "Contractor", "counterparty_role": "Customer"},
        "document_text": "Contractor must deliver the report within 5 days.",
        "language": "en",
        "mime_type": "text/plain",
    }
    payload.update(overrides)
    return AnalysisRunRequest.model_validate(payload)


def test_ingest_preserves_document_metadata_for_text_payload() -> None:
    service = IngestionService()
    request = _build_request(
        document_name="services-contract.txt",
        mime_type="text/plain",
        document_text="Contractor must de-\nliver the report.\n\nCustomer pays within 10 days.",
    )

    payload = service.ingest(request)

    assert payload.document_name == "services-contract.txt"
    assert payload.mime_type == "text/plain"
    assert payload.text == "Contractor must deliver the report.\n\nCustomer pays within 10 days."
    assert payload.extraction_source == "request.document_text"
    assert payload.extraction_ok is True
    assert payload.extraction_error is None
    assert payload.sha256 is not None
    assert payload.binary_payload is None
    assert [(item.role, item.canonical_role) for item in payload.detected_roles] == [
        ("Contractor", "executor"),
        ("Customer", "client"),
    ]
    assert payload.detected_roles[0].offset_start == 0
    assert payload.detected_roles[0].offset_end == len("Contractor")
    assert payload.detected_roles[1].offset_start == payload.text.index("Customer")
    assert payload.detected_roles[1].offset_end == payload.detected_roles[1].offset_start + len("Customer")


def test_ingest_uses_filename_metadata_to_parse_docx_without_explicit_mime_type() -> None:
    service = IngestionService()
    docx_payload = _encode_base64(
        _build_docx_bytes(
            [
                "Customer must pay within 10 business days.",
                "Contractor shall deliver the report within 5 days.",
            ]
        )
    ).rstrip("=")
    request = _build_request(
        document_name="services.DOCX",
        document_text=None,
        document_base64=docx_payload,
        mime_type=None,
    )

    payload = service.ingest(request)

    assert payload.document_name == "services.DOCX"
    assert payload.mime_type is None
    assert payload.text == (
        "Customer must pay within 10 business days.\n"
        "Contractor shall deliver the report within 5 days."
    )
    assert payload.extraction_source.startswith("docx:")
    assert payload.extraction_ok is True
    assert payload.extraction_error is None
    assert payload.sha256 is not None
    assert payload.binary_payload is not None


def test_docx_and_txt_binary_extraction_return_consistent_metadata() -> None:
    service = IngestionService()
    docx_request = _build_request(
        document_name="services.docx",
        document_text=None,
        document_base64=_encode_base64(
            _build_docx_bytes(["Customer must pay within 10 days."])
        ),
        mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    txt_request = _build_request(
        document_name="services.txt",
        document_text=None,
        document_base64=_encode_base64(b"Customer must pay within 10 days."),
        mime_type="text/plain",
    )

    docx_payload = service.ingest(docx_request)
    txt_payload = service.ingest(txt_request)

    assert docx_payload.text == txt_payload.text == "Customer must pay within 10 days."
    assert docx_payload.extraction_source.startswith("docx:")
    assert txt_payload.extraction_source == "txt:utf8"
    assert docx_payload.extraction_ok is True
    assert txt_payload.extraction_ok is True
    assert docx_payload.extraction_error is None
    assert txt_payload.extraction_error is None
    assert docx_payload.sha256
    assert txt_payload.sha256
    assert docx_payload.binary_payload is not None
    assert txt_payload.binary_payload is not None


def test_ingest_uses_localized_placeholder_when_docx_extraction_returns_empty_text() -> None:
    service = IngestionService()
    runtime_config = get_runtime_config()
    request = _build_request(
        document_name="broken.docx",
        document_text=None,
        document_base64=_encode_base64(_build_docx_bytes([], include_document_xml=False)),
        mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        language="en",
    )

    payload = service.ingest(request)

    assert payload.document_name == "broken.docx"
    assert payload.mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    assert payload.text == resolve_localized_text(
        runtime_config.pipeline.ingestion.empty_text_placeholder,
        "en",
    )
    assert payload.extraction_source == "docx:none"
    assert payload.extraction_ok is False
    assert payload.extraction_error
    assert payload.binary_payload is not None
    assert payload.detected_roles == []


def test_doc_payload_returns_explicit_unsupported_policy_error() -> None:
    service = IngestionService()
    runtime_config = get_runtime_config()
    request = _build_request(
        document_name="legacy.doc",
        document_text=None,
        document_base64=_encode_base64(b"\xd0\xcf\x11\xe0 fake legacy doc payload"),
        mime_type="application/msword",
        language="en",
    )

    payload = service.ingest(request)

    assert payload.text == resolve_localized_text(
        runtime_config.pipeline.ingestion.empty_text_placeholder,
        "en",
    )
    assert payload.extraction_source == "doc:unsupported"
    assert payload.extraction_ok is False
    assert payload.extraction_error
    assert "application/msword (.doc) is not supported reliably" in payload.extraction_error
    assert "DOCX, PDF, or TXT" in payload.extraction_error
    assert payload.binary_payload is not None


def test_extract_pdf_skips_pages_that_fail_extraction(monkeypatch) -> None:
    service = IngestionService()

    class FakePage:
        def __init__(self, text: str | None = None, *, raises: bool = False) -> None:
            self._text = text
            self._raises = raises

        def extract_text(self) -> str | None:
            if self._raises:
                raise RuntimeError("page extraction failed")
            return self._text

    class FakeReader:
        def __init__(self, _: BytesIO) -> None:
            self.pages = [
                FakePage("Buyer pays within 10 days."),
                FakePage(raises=True),
                FakePage("Seller delivers the goods within 5 days."),
            ]

    monkeypatch.setattr(ingestion_module, "PdfReader", FakeReader)

    extracted = service._extract_pdf(b"%PDF-1.4 fake payload")

    assert extracted.text == (
        "Buyer pays within 10 days.\n\n"
        "Seller delivers the goods within 5 days."
    )
    assert extracted.extraction_source == "pdf:pypdf"
    assert extracted.extraction_ok is True
    assert extracted.extraction_error is None


def test_extract_pdf_direct_text_preserves_multiline_pdf_text() -> None:
    service = IngestionService()
    pdf_payload = _build_simple_pdf_bytes(
        [
            "Buyer must pay within 10 days.",
            "Seller shall deliver the goods within 5 days.",
            "Penalty applies for delay.",
        ]
    )

    extracted = service._extract_pdf_direct_text(pdf_payload)

    assert extracted.extraction_ok is True
    assert extracted.extraction_source in {"pdf:pdfplumber", "pdf:pdfminer", "pdf:pypdf"}
    assert "Buyer must pay within 10 days." in extracted.text
    assert "Seller shall deliver the goods within 5 days." in extracted.text
    assert "Penalty applies for delay." in extracted.text
    assert "\x00" not in extracted.text


def test_extract_pdf_direct_text_falls_back_when_first_extractor_returns_garbage(monkeypatch) -> None:
    service = IngestionService()

    class FakePdfPage:
        def extract_text(self) -> str:
            return "\ufffd" * 80

    class FakePdf:
        pages = [FakePdfPage()]

        def __enter__(self) -> "FakePdf":
            return self

        def __exit__(self, *_: object) -> None:
            return None

    class FakePypdfPage:
        def extract_text(self) -> str:
            return "Buyer must pay within 10 days. Seller shall deliver goods within 5 days."

    class FakeReader:
        def __init__(self, _: BytesIO) -> None:
            self.pages = [FakePypdfPage()]

    fake_pdfplumber = SimpleNamespace(open=lambda _: FakePdf())
    monkeypatch.setitem(sys.modules, "pdfplumber", fake_pdfplumber)
    monkeypatch.setattr(ingestion_module, "PdfReader", FakeReader)
    monkeypatch.setattr(service, "_extractors_enabled", lambda key: key != "pdf_pdfminer")

    extracted = service._extract_pdf_direct_text(b"%PDF-1.4 fake payload")

    assert extracted.text.startswith("Buyer must pay")
    assert extracted.extraction_source == "pdf:pypdf"
    assert extracted.extraction_ok is True
    assert extracted.extraction_error is None


def test_extract_text_pdf_does_not_run_ocr_when_direct_text_is_sufficient(monkeypatch) -> None:
    service = IngestionService()

    monkeypatch.setattr(
        service,
        "_extract_pdf_direct_text",
        lambda _: ExtractionResult(
            text="Buyer must pay within 10 days. Seller shall deliver goods within 5 days.",
            extraction_source="pdf:pypdf",
            extraction_ok=True,
        ),
    )

    def fail_ocr(_: bytes) -> ExtractionResult:
        raise AssertionError("OCR fallback should not run for text PDFs")

    monkeypatch.setattr(service, "_extract_scanned_pdf_with_ocr", fail_ocr)

    extracted = service._extract_pdf(b"%PDF-1.4 text pdf")

    assert extracted.text.startswith("Buyer must pay")
    assert extracted.extraction_source == "pdf:pypdf"
    assert extracted.extraction_ok is True
    assert extracted.extraction_error is None


def test_extract_pdf_uses_ocr_fallback_when_direct_text_is_empty(monkeypatch) -> None:
    service = IngestionService()
    monkeypatch.setattr(
        service,
        "_extract_pdf_direct_text",
        lambda _: ExtractionResult(
            text="",
            extraction_source="pdf:none",
            extraction_ok=False,
            extraction_error="pdfplumber returned empty text; pypdf returned empty text",
        ),
    )
    monkeypatch.setattr(
        service,
        "_render_pdf_pages_for_ocr",
        lambda *_: ([RenderedPdfPage(page_number=1, page_count=1, image=object())], []),
    )
    monkeypatch.setattr(
        service,
        "_ocr_image_to_text",
        lambda _: "Buyer must pay within 10 days. Seller shall deliver goods within 5 days.",
    )

    extracted = service._extract_pdf(b"%PDF-1.4 scanned pdf")

    assert extracted.text.startswith("Buyer must pay")
    assert extracted.extraction_source == "pdf:ocr:tesseract(1/1 pages)"
    assert extracted.extraction_ok is True
    assert extracted.extraction_error is None


def test_extract_pdf_reports_scanned_or_empty_pdf_when_no_text_backend_succeeds(monkeypatch) -> None:
    service = IngestionService()
    monkeypatch.setattr(
        service,
        "_extract_pdf_direct_text",
        lambda _: ExtractionResult(
            text="",
            extraction_source="pdf:none",
            extraction_ok=False,
            extraction_error="pdf direct text extraction found no readable text; document may be scanned or image-only",
        ),
    )
    monkeypatch.setattr(
        service,
        "_extract_scanned_pdf_with_ocr",
        lambda _: ExtractionResult(
            text="",
            extraction_source="pdf:ocr:none",
            extraction_ok=False,
            extraction_error="pdf OCR fallback unavailable: no pages rendered",
        ),
    )

    extracted = service._extract_pdf(b"%PDF-1.4 scanned or empty pdf")

    assert extracted.text == ""
    assert extracted.extraction_source == "pdf:none"
    assert extracted.extraction_ok is False
    assert extracted.extraction_error
    assert "scanned or image-only" in extracted.extraction_error
    assert "pdf OCR fallback unavailable" in extracted.extraction_error


def test_extract_pdf_uses_ocr_fallback_when_direct_text_is_too_short(monkeypatch) -> None:
    service = IngestionService()
    monkeypatch.setattr(
        service,
        "_extract_pdf_direct_text",
        lambda _: ExtractionResult(
            text="Page 1",
            extraction_source="pdf:pypdf",
            extraction_ok=True,
        ),
    )
    monkeypatch.setattr(
        service,
        "_extract_scanned_pdf_with_ocr",
        lambda _: ExtractionResult(
            text="Buyer must pay within 10 days. Seller shall deliver goods within 5 days.",
            extraction_source="pdf:ocr:tesseract(1/1 pages)",
            extraction_ok=True,
        ),
    )

    extracted = service._extract_pdf(b"%PDF-1.4 low text pdf")

    assert extracted.text.startswith("Buyer must pay")
    assert extracted.extraction_source == "pdf:ocr:tesseract(1/1 pages)"
    assert extracted.extraction_ok is True


def test_pdf_ocr_fallback_reports_renderer_failures_without_raw_payload(monkeypatch) -> None:
    service = IngestionService()
    monkeypatch.setattr(
        service,
        "_render_pdf_pages_for_ocr",
        lambda *_: ([], ["PyMuPDF renderer unavailable", "pdf2image renderer unavailable"]),
    )

    extracted = service._extract_scanned_pdf_with_ocr(b"raw secret pdf bytes")

    assert extracted.extraction_source == "pdf:ocr:none"
    assert extracted.extraction_ok is False
    assert extracted.extraction_error
    assert "pdf OCR fallback unavailable" in extracted.extraction_error
    assert "raw secret pdf bytes" not in extracted.extraction_error


def test_decode_base64_payload_accepts_missing_padding() -> None:
    service = IngestionService()
    encoded = _encode_base64(b"plain-text payload").rstrip("=")

    decoded = service._decode_base64_payload(encoded)

    assert decoded == b"plain-text payload"


def test_ingestion_payload_repr_does_not_include_raw_binary_payload() -> None:
    payload = IngestionPayload(
        document_name="secret.pdf",
        mime_type="application/pdf",
        text="extracted text",
        detected_roles=[],
        extraction_source="pdf:pypdf",
        extraction_ok=True,
        extraction_error=None,
        sha256="abc123",
        binary_payload=b"raw secret contract bytes",
    )

    assert "raw secret contract bytes" not in repr(payload)


def test_job_store_redacts_raw_document_inputs() -> None:
    store = InMemoryJobStore()
    request = _build_request(
        document_name="secret.txt",
        document_text="raw secret contract text",
        document_base64=_encode_base64(b"raw secret contract bytes"),
        mime_type="text/plain",
    )

    record = store.create_job(request)

    assert record.request.document_text == "[redacted]"
    assert record.request.document_base64 == "[redacted]"
    assert "raw secret contract text" not in repr(record)
    assert "raw secret contract bytes" not in repr(record)

