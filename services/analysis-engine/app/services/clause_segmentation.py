from __future__ import annotations

from dataclasses import dataclass
import re

from app.config.runtime import get_runtime_config
from app.localization import resolve_localized_text
from app.services.text_normalization import normalize_contract_text


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
        normalized_text = normalize_contract_text(text)

        chunks = [
            chunk.strip()
            for chunk in normalized_text.split(segmentation_config.primary_separator)
            if chunk.strip()
        ]

        if len(chunks) <= 1:
            numbered_chunks = self._split_numbered_clauses(normalized_text)
            if numbered_chunks:
                chunks = numbered_chunks

        if not chunks:
            chunks = [
                line.strip()
                for line in normalized_text.split(segmentation_config.secondary_separator)
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

    @staticmethod
    def _split_numbered_clauses(text: str) -> list[str]:
        pattern = re.compile(r"(?:(?<=\n)|^)(\d+(?:\.\d+){0,2})[.)]?\s+")
        matches = list(pattern.finditer(text))
        if len(matches) < 2:
            return []

        chunks: list[str] = []
        for index, match in enumerate(matches):
            start = match.start()
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
        return chunks
