from __future__ import annotations

import base64
from io import BytesIO
from zipfile import ZipFile

from app.config.runtime import get_runtime_config
from app.localization import resolve_localized_text
from app.schemas.analysis import AnalysisRunRequest
import app.services.ingestion as ingestion_module
from app.services.ingestion import IngestionService


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
        "Buyer pays within 10 days.\n"
        "Seller delivers the goods within 5 days."
    )
    assert extracted.extraction_source == "pdf:pypdf"
    assert extracted.extraction_ok is True
    assert extracted.extraction_error is None


def test_decode_base64_payload_accepts_missing_padding() -> None:
    service = IngestionService()
    encoded = _encode_base64(b"plain-text payload").rstrip("=")

    decoded = service._decode_base64_payload(encoded)

    assert decoded == b"plain-text payload"
