from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

from app.config.runtime import get_runtime_config
from app.services.ingestion import IngestionPayload
from app.services.text_normalization import normalize_contract_text


@dataclass(slots=True)
class OCRResult:
    text: str
    source: str


class OCRService:
    """Runs OCR only for image payloads; non-image documents pass through ingestion text unchanged."""

    def __init__(self) -> None:
        self._runtime_config = get_runtime_config()

    async def extract_text(self, payload: IngestionPayload) -> OCRResult:
        mime_type = (payload.mime_type or "").strip().lower()
        if not mime_type.startswith("image/"):
            return OCRResult(text=payload.text, source=payload.extraction_source)

        if payload.text.strip() and payload.extraction_ok:
            return OCRResult(text=payload.text, source=payload.extraction_source)

        if not payload.binary_payload:
            return OCRResult(text=payload.text, source=payload.extraction_source)

        try:
            from PIL import Image
            import pytesseract
        except Exception:
            return OCRResult(text=payload.text, source=payload.extraction_source)

        try:
            image = Image.open(BytesIO(payload.binary_payload))
            text = normalize_contract_text(pytesseract.image_to_string(image))
        except Exception:
            return OCRResult(text=payload.text, source=payload.extraction_source)

        if not text:
            return OCRResult(text=payload.text, source=payload.extraction_source)

        return OCRResult(text=text, source="ocr:tesseract")
