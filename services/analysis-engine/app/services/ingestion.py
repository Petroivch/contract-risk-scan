from __future__ import annotations

import base64
from dataclasses import dataclass
from io import BytesIO
from xml.etree import ElementTree as ET
from zipfile import BadZipFile, ZipFile

from pypdf import PdfReader

from app.config.runtime import get_runtime_config
from app.localization import resolve_localized_text
from app.schemas.analysis import AnalysisRunRequest


@dataclass(slots=True)
class IngestionPayload:
    document_name: str
    mime_type: str | None
    text: str


class IngestionService:
    """Config-driven ingestion stage with limit guards and localized fallback text."""

    def __init__(self) -> None:
        self._runtime_config = get_runtime_config()

    def ingest(self, request: AnalysisRunRequest) -> IngestionPayload:
        limits = self._runtime_config.pipeline.limits
        errors = self._runtime_config.pipeline.errors

        if request.document_text and len(request.document_text) > limits.max_document_text_chars:
            raise ValueError(resolve_localized_text(errors.document_text_too_long, request.language))

        if request.document_base64 and len(request.document_base64) > limits.max_document_base64_chars:
            raise ValueError(resolve_localized_text(errors.document_base64_too_long, request.language))

        if request.document_text:
            normalized_text = request.document_text.strip()
        else:
            normalized_text = self._extract_text_from_binary_payload(
                payload=self._decode_base64_payload(request.document_base64 or ''),
                mime_type=request.mime_type,
                document_name=request.document_name,
            ).strip()

        if not normalized_text:
            normalized_text = resolve_localized_text(
                self._runtime_config.pipeline.ingestion.empty_text_placeholder,
                request.language,
            )

        return IngestionPayload(
            document_name=request.document_name,
            mime_type=request.mime_type,
            text=normalized_text,
        )

    def _decode_base64_payload(self, payload: str) -> bytes:
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
    ) -> str:
        normalized_mime_type = (mime_type or '').strip().lower()
        normalized_name = document_name.strip().lower()

        if (
            normalized_mime_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            or normalized_name.endswith('.docx')
        ):
            return self._extract_docx_text(payload)

        if normalized_mime_type == 'application/pdf' or normalized_name.endswith('.pdf'):
            return self._extract_pdf_text(payload)

        return payload.decode('utf-8', errors='ignore')

    def _extract_docx_text(self, payload: bytes) -> str:
        try:
            with ZipFile(BytesIO(payload)) as archive:
                document_xml = archive.read('word/document.xml')
        except (BadZipFile, KeyError, ValueError):
            return ''

        try:
            root = ET.fromstring(document_xml)
        except ET.ParseError:
            return ''

        namespace = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        paragraphs: list[str] = []

        for paragraph in root.findall('.//w:p', namespace):
            text_chunks = [node.text or '' for node in paragraph.findall('.//w:t', namespace)]
            merged = ''.join(text_chunks).strip()
            if merged:
                paragraphs.append(merged)

        return '\n'.join(paragraphs)

    def _extract_pdf_text(self, payload: bytes) -> str:
        try:
            reader = PdfReader(BytesIO(payload))
        except Exception:
            return ''

        text_chunks: list[str] = []
        for page in reader.pages:
            try:
                page_text = (page.extract_text() or '').strip()
            except Exception:
                page_text = ''

            if page_text:
                text_chunks.append(page_text)

        return '\n'.join(text_chunks)
