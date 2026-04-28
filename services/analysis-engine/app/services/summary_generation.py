from __future__ import annotations

from app.config.runtime import get_runtime_config
from app.localization import normalize_analysis_language, resolve_localized_text
from app.schemas.analysis import RiskItem, RoleFocusedSummary
from app.services.clause_segmentation import ClauseSegment
from app.services.contract_analysis import canonicalize_role
from app.services.text_normalization import normalize_contract_text, split_into_sentences


class SummaryGenerationService:
    """Role-aware summary generation with sentence-safe output."""

    def __init__(self) -> None:
        self._config = get_runtime_config().summary_generation

    def generate(
        self,
        document_text: str,
        clauses: list[ClauseSegment],
        risks: list[RiskItem],
        role: str,
        counterparty_role: str | None,
        language: str,
    ) -> RoleFocusedSummary:
        resolved_language = normalize_analysis_language(language)
        candidates = self._candidate_lines(document_text, clauses)
        role_terms = [role]
        counterparty_terms = [counterparty_role] if counterparty_role else []
        max_items = self._config.max_items_per_section

        must_do = self._collect_lines(
            candidates,
            self._config.markers["must_do"],
            prioritized_terms=role_terms,
            max_items=max_items,
        )
        should_review = self._collect_lines(
            candidates,
            self._config.markers["should_review"],
            prioritized_terms=role_terms + counterparty_terms,
            max_items=max_items,
        )
        payment_terms = self._collect_lines(
            candidates,
            self._config.markers["payment_terms"],
            prioritized_terms=role_terms + counterparty_terms,
            max_items=max_items,
        )
        deadlines = self._collect_lines(
            candidates,
            self._config.markers["deadlines"],
            prioritized_terms=role_terms + counterparty_terms,
            max_items=max_items,
        )
        penalties = self._collect_lines(
            candidates,
            self._config.markers["penalties"],
            prioritized_terms=role_terms + counterparty_terms,
            max_items=max_items,
        )

        overview = resolve_localized_text(self._config.overview_templates, resolved_language).format(
            clauses_count=len(clauses),
            risks_count=len(risks),
            role=role,
        )
        overview = self._ensure_complete_summary(overview, risks, resolved_language)

        fallback_values = self._config.fallback_values

        return RoleFocusedSummary(
            role=role,
            overview=overview,
            must_do=must_do or [resolve_localized_text(fallback_values.must_do, resolved_language)],
            should_review=should_review
            or [resolve_localized_text(fallback_values.should_review, resolved_language)],
            payment_terms=payment_terms
            or [resolve_localized_text(fallback_values.payment_terms, resolved_language)],
            deadlines=deadlines or [resolve_localized_text(fallback_values.deadlines, resolved_language)],
            penalties=penalties or [resolve_localized_text(fallback_values.penalties, resolved_language)],
        )

    def _candidate_lines(self, text: str, clauses: list[ClauseSegment]) -> list[str]:
        candidates: list[str] = []
        seen: set[str] = set()

        for raw_block in [text, *(clause.text for clause in clauses)]:
            for sentence in split_into_sentences(raw_block):
                normalized_key = sentence.casefold()
                if normalized_key in seen:
                    continue
                seen.add(normalized_key)
                candidates.append(self._normalize_line(sentence))

        return candidates

    def _collect_lines(
        self,
        candidates: list[str],
        markers: list[str],
        prioritized_terms: list[str],
        max_items: int,
    ) -> list[str]:
        lines: list[str] = []
        markers_normalized = [marker.casefold() for marker in markers]
        prioritized_terms_normalized: list[str] = []
        for term in prioritized_terms:
            if not term or not term.strip():
                continue
            normalized_term = term.casefold().strip()
            prioritized_terms_normalized.append(normalized_term)
            canonical_term = canonicalize_role(term)
            if canonical_term and canonical_term not in prioritized_terms_normalized:
                prioritized_terms_normalized.append(canonical_term)

        def append_matching_lines(require_priority_match: bool) -> None:
            for line in candidates:
                if len(lines) >= max_items:
                    return

                normalized = line.casefold()
                if not any(marker in normalized for marker in markers_normalized):
                    continue

                has_priority_term = any(term in normalized for term in prioritized_terms_normalized)
                if require_priority_match and prioritized_terms_normalized and not has_priority_term:
                    continue
                if not require_priority_match and prioritized_terms_normalized and has_priority_term:
                    continue

                if line not in lines:
                    lines.append(line)

        append_matching_lines(require_priority_match=True)
        if len(lines) < max_items:
            append_matching_lines(require_priority_match=False)

        return [self._normalize_line(line) for line in lines]

    @staticmethod
    def _normalize_line(line: str) -> str:
        cleaned = normalize_contract_text(line)
        if cleaned and cleaned[-1] not in ".!?":
            cleaned = f"{cleaned}."
        return cleaned

    @staticmethod
    def _ensure_complete_summary(summary: str, risks: list[RiskItem], language: str) -> str:
        cleaned = normalize_contract_text(summary)
        if cleaned and cleaned[-1] not in ".!?":
            cleaned = f"{cleaned}."

        high_risks = [risk for risk in risks if risk.severity.value in {"high", "critical"}]
        if not high_risks:
            return cleaned

        recommendations = {
            "ru": f" Обнаружено {len(high_risks)} пунктов с высоким уровнем риска; их стоит перепроверить вручную.",
            "en": f" {len(high_risks)} high-risk clauses were detected and should be reviewed manually.",
            "it": f" Sono stati rilevati {len(high_risks)} punti ad alto rischio da verificare manualmente.",
            "fr": f" {len(high_risks)} clauses a haut risque ont ete detectees et demandent une verification manuelle.",
        }
        return f"{cleaned}{recommendations.get(language, recommendations['ru'])}"
