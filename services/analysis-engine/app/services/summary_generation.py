from __future__ import annotations

from app.config.runtime import get_runtime_config
from app.localization import normalize_analysis_language, resolve_localized_text
from app.schemas.analysis import RiskItem, RoleFocusedSummary
from app.services.clause_segmentation import ClauseSegment


class SummaryGenerationService:
    """Config-driven summary generation with centralized language behavior."""

    def __init__(self) -> None:
        self._config = get_runtime_config().summary_generation

    def generate(
        self,
        document_text: str,
        clauses: list[ClauseSegment],
        risks: list[RiskItem],
        role: str,
        language: str,
    ) -> RoleFocusedSummary:
        resolved_language = normalize_analysis_language(language)
        role_lower = role.lower()

        max_items = self._config.max_items_per_section

        must_do = self._collect_lines(
            document_text,
            self._config.markers["must_do"] + [role_lower],
            max_items=max_items,
        )
        should_review = self._collect_lines(
            document_text,
            self._config.markers["should_review"],
            max_items=max_items,
        )
        payment_terms = self._collect_lines(
            document_text,
            self._config.markers["payment_terms"],
            max_items=max_items,
        )
        deadlines = self._collect_lines(
            document_text,
            self._config.markers["deadlines"],
            max_items=max_items,
        )
        penalties = self._collect_lines(
            document_text,
            self._config.markers["penalties"],
            max_items=max_items,
        )

        overview = resolve_localized_text(
            self._config.overview_templates,
            resolved_language,
        ).format(
            clauses_count=len(clauses),
            risks_count=len(risks),
            role=role,
        )

        fallback_values = self._config.fallback_values

        return RoleFocusedSummary(
            role=role,
            overview=overview,
            must_do=must_do or [resolve_localized_text(fallback_values.must_do, resolved_language)],
            should_review=should_review or [
                resolve_localized_text(fallback_values.should_review, resolved_language)
            ],
            payment_terms=payment_terms or [
                resolve_localized_text(fallback_values.payment_terms, resolved_language)
            ],
            deadlines=deadlines or [resolve_localized_text(fallback_values.deadlines, resolved_language)],
            penalties=penalties or [resolve_localized_text(fallback_values.penalties, resolved_language)],
        )

    def _collect_lines(self, text: str, markers: list[str], max_items: int) -> list[str]:
        lines: list[str] = []

        for raw_line in text.replace("\r", "").split("\n"):
            line = raw_line.strip()
            if not line:
                continue

            normalized = line.lower()
            if any(marker in normalized for marker in markers):
                lines.append(line[: self._config.max_line_length])
                if len(lines) >= max_items:
                    break

        return lines
