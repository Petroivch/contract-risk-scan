from __future__ import annotations

import re
from collections.abc import Mapping

from app.config.models import StructuredSummaryRecordTemplateConfig
from app.config.runtime import get_runtime_config
from app.localization import resolve_localized_text
from app.schemas.analysis import SummaryRecord
from app.services.text_normalization import normalize_contract_text

_NON_IMPERATIVE_PREFIXES = (
    "нужно ",
    "следует ",
    "необходимо ",
    "стоит ",
    "рекомендуется ",
)


class SummaryRecordFormatter:
    """Formats additive structured summary records in a stable Russian schema."""

    def __init__(self) -> None:
        self._templates = get_runtime_config().templates.structured_summary_records
        self._language = "ru"

    def build_record(
        self,
        *,
        record_id: str,
        template: StructuredSummaryRecordTemplateConfig,
        context: Mapping[str, str | int | float],
        evidence: list[str] | None = None,
    ) -> SummaryRecord:
        normalized_context = {key: self._stringify(value) for key, value in context.items()}

        headline = self._ensure_sentence(
            resolve_localized_text(template.headline, self._language).format(**normalized_context)
        )
        description = self._ensure_sentence(
            resolve_localized_text(template.description, self._language).format(**normalized_context)
        )
        recommendation = self._ensure_imperative_sentence(
            resolve_localized_text(template.recommendation, self._language).format(**normalized_context)
        )

        normalized_evidence = [
            self._ensure_sentence(f"Фрагмент договора: {normalize_contract_text(item)}")
            for item in (evidence or [])
            if normalize_contract_text(item)
        ]

        return SummaryRecord(
            id=record_id,
            headline=headline,
            description=description,
            recommendation=recommendation,
            evidence=normalized_evidence,
        )

    @property
    def templates(self):  # pragma: no cover - thin property wrapper
        return self._templates

    @staticmethod
    def _stringify(value: str | int | float) -> str:
        if isinstance(value, float) and value.is_integer():
            return str(int(value))
        return str(value)

    @staticmethod
    def _ensure_sentence(text: str) -> str:
        cleaned = normalize_contract_text(text)
        if cleaned and cleaned[-1] not in ".!?":
            cleaned = f"{cleaned}."
        return cleaned

    def _ensure_imperative_sentence(self, text: str) -> str:
        cleaned = self._ensure_sentence(text)
        lowered = cleaned.casefold()
        for prefix in _NON_IMPERATIVE_PREFIXES:
            if lowered.startswith(prefix):
                cleaned = self._rewrite_to_imperative(cleaned, prefix)
                break
        return self._ensure_sentence(cleaned)

    @staticmethod
    def _rewrite_to_imperative(text: str, prefix: str) -> str:
        prefix_pattern = re.compile(rf"^{re.escape(prefix)}", re.IGNORECASE)
        rewritten = prefix_pattern.sub("Проверьте и зафиксируйте ", text, count=1)
        return rewritten[0].upper() + rewritten[1:] if rewritten else text
