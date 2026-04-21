from __future__ import annotations

from app.config.runtime import get_runtime_config
from app.localization import normalize_analysis_language, resolve_localized_text
from app.schemas.analysis import RiskItem, RoleFocusedSummary
from app.services.clause_segmentation import ClauseSegment


class SummaryGenerationService:
    """Config-driven summary generation with role-aware prioritization."""

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
            prioritized_terms=role_terms,
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
            normalized_block = raw_block.replace("\r", "").replace(";", "\n")
            for raw_line in normalized_block.split("\n"):
                line = raw_line.strip()
                if not line:
                    continue

                normalized_key = line.casefold()
                if normalized_key in seen:
                    continue

                seen.add(normalized_key)
                candidates.append(line[: self._config.max_line_length])

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
        prioritized_terms_normalized = [
            term.casefold().strip() for term in prioritized_terms if term and term.strip()
        ]

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

                lines.append(line)

        append_matching_lines(require_priority_match=True)
        if len(lines) < max_items:
            append_matching_lines(require_priority_match=False)

        return lines
