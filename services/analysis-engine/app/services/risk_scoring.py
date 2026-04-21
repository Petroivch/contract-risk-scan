from __future__ import annotations

from app.config.runtime import get_runtime_config
from app.localization import normalize_analysis_language, resolve_localized_text
from app.schemas.analysis import DisputedClauseItem, RiskItem, RiskSeverity
from app.services.clause_segmentation import ClauseSegment


class RiskScoringService:
    """Config-driven risk scoring based on configurable lexical heuristics."""

    def __init__(self) -> None:
        runtime_config = get_runtime_config()
        self._language_behavior = runtime_config.language_behavior
        self._config = runtime_config.risk_scoring

    def score(self, clauses: list[ClauseSegment], role: str, language: str) -> list[RiskItem]:
        resolved_language = normalize_analysis_language(language)
        role_lower = role.casefold().strip()
        risks_with_rank: list[tuple[int, int, RiskItem]] = []
        seen_pairs: set[tuple[str, str]] = set()

        for clause_index, clause in enumerate(clauses):
            normalized_clause = clause.text.casefold()
            role_mentioned = bool(role_lower and role_lower in normalized_clause)
            for rule in self._config.risk_rules:
                if not any(keyword in normalized_clause for keyword in rule.keywords):
                    continue
                dedupe_key = (rule.id, clause.clause_id)
                if dedupe_key in seen_pairs:
                    continue
                seen_pairs.add(dedupe_key)

                severity = RiskSeverity(rule.severity)
                risk_title = self._format_risk_title(
                    language=resolved_language,
                    severity=severity,
                    title_fragment=resolve_localized_text(rule.title, resolved_language),
                )

                risks_with_rank.append(
                    (
                        self._severity_rank(severity),
                        clause_index,
                        RiskItem(
                            risk_id="",
                            title=risk_title,
                            severity=severity,
                            clause_id=clause.clause_id,
                            description=resolve_localized_text(rule.description, resolved_language),
                            role_relevance=self._build_role_relevance(
                                language=resolved_language,
                                role=role,
                                role_mentioned=role_mentioned,
                            ),
                            mitigation=resolve_localized_text(rule.mitigation, resolved_language),
                        ),
                    )
                )

        risks_with_rank.sort(key=lambda item: (-item[0], item[1]))
        risks = [
            risk.model_copy(update={"risk_id": f"{self._config.risk_id_prefix}{index}"})
            for index, (_, _, risk) in enumerate(risks_with_rank, start=1)
        ]

        if not risks:
            risks.append(
                RiskItem(
                    risk_id=f"{self._config.risk_id_prefix}1",
                    title=resolve_localized_text(self._config.fallback.risk_title, resolved_language),
                    severity=RiskSeverity.LOW,
                    clause_id=None,
                    description=resolve_localized_text(self._config.fallback.risk_description, resolved_language),
                    role_relevance=resolve_localized_text(
                        self._config.fallback.role_relevance,
                        resolved_language,
                    ).format(role=role),
                    mitigation=resolve_localized_text(self._config.fallback.mitigation, resolved_language),
                )
            )

        return risks

    def extract_disputed_clauses(self, clauses: list[ClauseSegment], language: str) -> list[DisputedClauseItem]:
        resolved_language = normalize_analysis_language(language)
        disputed: list[DisputedClauseItem] = []
        seen_pairs: set[tuple[str, str]] = set()

        for clause in clauses:
            normalized_clause = clause.text.casefold()
            for marker in self._config.dispute_markers:
                if not any(item in normalized_clause for item in marker.markers):
                    continue
                dedupe_key = (clause.clause_id, marker.id)
                if dedupe_key in seen_pairs:
                    continue
                seen_pairs.add(dedupe_key)

                disputed.append(
                    DisputedClauseItem(
                        clause_id=clause.clause_id,
                        clause_excerpt=clause.text[: self._config.max_clause_excerpt_chars],
                        dispute_reason=resolve_localized_text(marker.reason, resolved_language),
                        possible_consequence=resolve_localized_text(marker.consequence, resolved_language),
                        confidence=marker.confidence,
                    )
                )

        if not disputed and clauses:
            disputed.append(
                DisputedClauseItem(
                    clause_id=clauses[0].clause_id,
                    clause_excerpt=clauses[0].text[: self._config.max_clause_excerpt_chars],
                    dispute_reason=resolve_localized_text(self._config.fallback.dispute_reason, resolved_language),
                    possible_consequence=resolve_localized_text(
                        self._config.fallback.dispute_consequence,
                        resolved_language,
                    ),
                    confidence=self._config.fallback_dispute_confidence,
                )
            )

        return disputed

    def _format_risk_title(self, language: str, severity: RiskSeverity, title_fragment: str) -> str:
        severity_label = self._severity_label(language, severity)
        return f"{severity_label}: {title_fragment}"

    def _severity_label(self, language: str, severity: RiskSeverity) -> str:
        if language in self._config.severity_labels:
            localized_labels = self._config.severity_labels[language]
        else:
            localized_labels = self._config.severity_labels[self._language_behavior.fallback_language]

        return localized_labels.get(severity.value, severity.value)

    @staticmethod
    def _severity_rank(severity: RiskSeverity) -> int:
        ranks = {
            RiskSeverity.LOW: 1,
            RiskSeverity.MEDIUM: 2,
            RiskSeverity.HIGH: 3,
            RiskSeverity.CRITICAL: 4,
        }
        return ranks[severity]

    def _build_role_relevance(self, language: str, role: str, role_mentioned: bool) -> str:
        if role_mentioned:
            template_map = self._config.role_relevance_templates.role_mentioned
        else:
            template_map = self._config.role_relevance_templates.role_generic

        return resolve_localized_text(template_map, language).format(role=role)
