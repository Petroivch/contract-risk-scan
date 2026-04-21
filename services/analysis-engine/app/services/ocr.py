from __future__ import annotations

from dataclasses import dataclass

from app.config.runtime import get_runtime_config
from app.services.ingestion import IngestionPayload


@dataclass(slots=True)
class OCRResult:
    text: str
    source: str


class OCRService:
    """Config-driven OCR stub stage. Returns text as-is for skeleton."""

    def __init__(self) -> None:
        self._runtime_config = get_runtime_config()

    async def extract_text(self, payload: IngestionPayload) -> OCRResult:
        return OCRResult(
            text=payload.text,
            source=self._runtime_config.pipeline.ocr.source_label,
        )
