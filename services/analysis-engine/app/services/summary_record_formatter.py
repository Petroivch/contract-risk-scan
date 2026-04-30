from __future__ import annotations

import re
from collections.abc import Mapping

from app.config.models import StructuredSummaryRecordTemplateConfig
from app.config.runtime import get_runtime_config
from app.localization import resolve_localized_text
from app.schemas.analysis import SummaryRecord
from app.services.text_normalization import normalize_contract_text, split_into_sentences

_NON_IMPERATIVE_PREFIXES = (
    "нужно ",
    "следует ",
    "необходимо ",
    "стоит ",
    "рекомендуется ",
)
_SENTENCE_ENDINGS = ".!?"
_ELLIPSIS = "..."


def ensure_sentence(text: str) -> str:
    cleaned = normalize_contract_text(text).strip()
    cleaned = re.sub(r"[,:;\-–—]+$", "", cleaned).strip()
    if not cleaned:
        return ""
    if cleaned.endswith(_ELLIPSIS) or cleaned.endswith("…"):
        return cleaned
    if cleaned[-1] not in _SENTENCE_ENDINGS:
        return f"{cleaned}."
    return cleaned


def sentence_to_fragment(text: str) -> str:
    cleaned = normalize_contract_text(text).strip()
    if not cleaned:
        return ""
    if cleaned.endswith(_ELLIPSIS) or cleaned.endswith("…"):
        return cleaned
    if cleaned[-1] in _SENTENCE_ENDINGS:
        return cleaned[:-1].rstrip()
    return cleaned


def smart_truncate_text(
    text: str,
    max_chars: int,
    *,
    preserve_word_boundary: bool = True,
    prefer_sentence_end: bool = True,
    continuation: str = _ELLIPSIS,
) -> str:
    cleaned = normalize_contract_text(text).strip()
    if not cleaned:
        return ""

    if len(cleaned) <= max_chars:
        return ensure_sentence(cleaned)

    if prefer_sentence_end:
        fitted_sentences: list[str] = []
        for sentence in split_into_sentences(cleaned):
            proposed = " ".join([*fitted_sentences, sentence]).strip()
            if len(proposed) > max_chars:
                break
            fitted_sentences.append(sentence)

        joined_sentences = " ".join(fitted_sentences).strip()
        if joined_sentences and len(joined_sentences) >= int(max_chars * 0.55):
            return ensure_sentence(joined_sentences)

    truncated = cleaned[:max_chars].rstrip()

    punctuation_positions = [
        truncated.rfind(symbol)
        for symbol in (".", "!", "?", ";", ":", ",")
    ]
    punctuation_boundary = max(punctuation_positions)
    if punctuation_boundary >= int(max_chars * 0.6):
        if truncated[punctuation_boundary] in _SENTENCE_ENDINGS:
            return ensure_sentence(truncated[: punctuation_boundary + 1])
        trimmed = truncated[:punctuation_boundary].rstrip()
        if trimmed:
            return f"{trimmed}{continuation}"

    if preserve_word_boundary:
        last_space = truncated.rfind(" ")
        if last_space >= int(max_chars * 0.6):
            truncated = truncated[:last_space].rstrip()

    truncated = truncated.rstrip(" ,;:-")
    return f"{truncated}{continuation}" if truncated else continuation


def build_evidence_sentence(text: str, *, max_chars: int = 280) -> str:
    excerpt = smart_truncate_text(text, max_chars=max_chars)
    return ensure_sentence(f"Фрагмент договора: {sentence_to_fragment(excerpt)}")


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

        headline = ensure_sentence(
            resolve_localized_text(template.headline, self._language).format(**normalized_context)
        )
        description = ensure_sentence(
            resolve_localized_text(template.description, self._language).format(**normalized_context)
        )
        recommendation = self._ensure_imperative_sentence(
            resolve_localized_text(template.recommendation, self._language).format(**normalized_context)
        )

        normalized_evidence = [
            build_evidence_sentence(item)
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

    def _ensure_imperative_sentence(self, text: str) -> str:
        cleaned = ensure_sentence(text)
        lowered = cleaned.casefold()
        for prefix in _NON_IMPERATIVE_PREFIXES:
            if lowered.startswith(prefix):
                cleaned = self._rewrite_to_imperative(cleaned, prefix)
                break
        return ensure_sentence(cleaned)

    @staticmethod
    def _rewrite_to_imperative(text: str, prefix: str) -> str:
        prefix_pattern = re.compile(rf"^{re.escape(prefix)}", re.IGNORECASE)
        rewritten = prefix_pattern.sub("Проверьте и зафиксируйте ", text, count=1)
        return rewritten[0].upper() + rewritten[1:] if rewritten else text
