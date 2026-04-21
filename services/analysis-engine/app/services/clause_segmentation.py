from __future__ import annotations

from dataclasses import dataclass

from app.config.runtime import get_runtime_config
from app.localization import resolve_localized_text


@dataclass(slots=True)
class ClauseSegment:
    clause_id: str
    text: str


class ClauseSegmentationService:
    """Config-driven clause segmentation service."""

    def __init__(self) -> None:
        self._runtime_config = get_runtime_config()

    def segment(self, text: str, language: str) -> list[ClauseSegment]:
        segmentation_config = self._runtime_config.pipeline.segmentation

        chunks = [
            chunk.strip()
            for chunk in text.replace("\r", "").split(segmentation_config.primary_separator)
            if chunk.strip()
        ]

        if not chunks:
            chunks = [
                line.strip()
                for line in text.split(segmentation_config.secondary_separator)
                if line.strip()
            ]

        if not chunks:
            fallback_clause_text = resolve_localized_text(segmentation_config.fallback_clause_text, language)
            return [
                ClauseSegment(
                    clause_id=segmentation_config.fallback_clause_id,
                    text=fallback_clause_text,
                )
            ]

        return [
            ClauseSegment(
                clause_id=f"{segmentation_config.clause_id_prefix}{index + 1}",
                text=chunk,
            )
            for index, chunk in enumerate(chunks)
        ]
