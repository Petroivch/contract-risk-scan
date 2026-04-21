from __future__ import annotations

import base64
from dataclasses import dataclass

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
            decoded = self._decode_base64_payload(request.document_base64 or "").decode("utf-8", errors="ignore")
            normalized_text = decoded.strip()

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
