from __future__ import annotations

import re
from dataclasses import dataclass

from app.config.models import RiskRuleConfig, RoleEscalationEntryConfig
from app.config.runtime import get_runtime_config
from app.localization import normalize_analysis_language, resolve_localized_text
from app.schemas.analysis import DisputedClauseItem, RiskItem, RiskSeverity
from app.services.asymmetry_detector import AsymmetrySignal
from app.services.clause_segmentation import ClauseSegment
from app.services.contract_analysis import canonicalize_role
from app.services.text_normalization import normalize_contract_text


@dataclass(slots=True)
class RuleMatch:
    clause_id: str | None
    excerpt: str
    matched_patterns: list[str]
    source: str


class RiskScoringService:
    """Rule engine for legal risk scoring with contract-type and role-aware escalation."""

    def __init__(self) -> None:
        runtime_config = get_runtime_config()
        self._language_behavior = runtime_config.language_behavior
        self._config = runtime_config.risk_scoring

    def score(
        self,
        clauses: list[ClauseSegment],
        role: str,
        language: str,
        contract_type: str | None = None,
        document_text: str | None = None,
        counterparty_role: str | None = None,
        asymmetry_signals: list[AsymmetrySignal] | None = None,
    ) -> list[RiskItem]:
        resolved_language = normalize_analysis_language(language)
        canonical_role = canonicalize_role(role)
        normalized_clauses = [self._normalize_clause(clause) for clause in clauses]
        combined_text = normalize_contract_text(
            document_text if document_text is not None else "\n".join(clause.text for clause in normalized_clauses)
        ).casefold()
        clause_index_by_id = {clause.clause_id: index for index, clause in enumerate(normalized_clauses)}
        risks_with_rank: list[tuple[int, int, RiskItem]] = []
        seen_pairs: set[tuple[str, str | None]] = set()

        signal_map = self._group_asymmetry_signals(asymmetry_signals or [])
        for rule in self._config.risk_rules:
            if not self._rule_applies_to_contract_type(rule, contract_type):
                continue

            matches = self._match_rule(
                rule=rule,
                clauses=normalized_clauses,
                combined_text=combined_text,
                preferred_clause=None,
            )
            if not matches:
                continue

            for match in matches:
                dedupe_key = (rule.id, match.clause_id)
                if dedupe_key in seen_pairs:
                    continue

                severity, escalation_reason = self._escalate_severity(rule, canonical_role, contract_type)
                if self._should_skip_risk(rule, canonical_role, severity, combined_text):
                    continue

                seen_pairs.add(dedupe_key)
                risk_title = self._format_risk_title(
                    language=resolved_language,
                    severity=severity,
                    title_fragment=resolve_localized_text(rule.title, resolved_language),
                )
                description = resolve_localized_text(rule.description, resolved_language)
                if match.excerpt and match.excerpt not in description:
                    description = f"{description} Найденный фрагмент: {match.excerpt}"

                risks_with_rank.append(
                    (
                        self._severity_rank(severity),
                        self._resolve_clause_rank(rule, match.clause_id, clause_index_by_id),
                        RiskItem(
                            risk_id="",
                            rule_id=rule.id,
                            title=risk_title,
                            severity=severity,
                            clause_id=match.clause_id,
                            description=self._ensure_complete_sentence(description),
                            role_relevance=self._build_role_relevance(
                                language=resolved_language,
                                role=role,
                                counterparty_role=counterparty_role,
                                severity=severity,
                                role_mentioned=canonical_role in match.source,
                                escalation_reason=escalation_reason,
                            ),
                            mitigation=self._ensure_complete_sentence(
                                resolve_localized_text(rule.mitigation, resolved_language)
                            ),
                        ),
                    )
                )

        risks_with_rank.extend(
            self._build_asymmetry_risks(
                signal_map=signal_map,
                role=role,
                canonical_role=canonical_role,
                language=resolved_language,
                seen_pairs=seen_pairs,
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
                    rule_id="fallback_low_risk",
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

        signal_map = self._group_asymmetry_signals(asymmetry_signals or [])
        for clause_index, clause in enumerate(normalized_clauses):
            for rule in self._config.risk_rules:
                if not self._rule_applies_to_contract_type(rule, contract_type):
                    continue

                matches = self._match_rule(
                    rule=rule,
                    clauses=normalized_clauses,
                    combined_text=combined_text,
                    preferred_clause=clause,
                )
                if not matches:
                    continue

                for match in matches:
                    dedupe_key = (rule.id, match.clause_id)
                    if dedupe_key in seen_pairs:
                        continue

                    severity, escalation_reason = self._escalate_severity(rule, canonical_role, contract_type)
                    if self._should_skip_risk(rule, canonical_role, severity, combined_text):
                        continue

                    seen_pairs.add(dedupe_key)
                    risk_title = self._format_risk_title(
                        language=resolved_language,
                        severity=severity,
                        title_fragment=resolve_localized_text(rule.title, resolved_language),
                    )
                    description = resolve_localized_text(rule.description, resolved_language)
                    if match.excerpt and match.excerpt not in description:
                        description = f"{description} Найденный фрагмент: {match.excerpt}"

                    risks_with_rank.append(
                        (
                            self._severity_rank(severity),
                            clause_index,
                            RiskItem(
                                risk_id="",
                                rule_id=rule.id,
                                title=risk_title,
                                severity=severity,
                                clause_id=match.clause_id,
                                description=self._ensure_complete_sentence(description),
                                role_relevance=self._build_role_relevance(
                                    language=resolved_language,
                                    role=role,
                                    counterparty_role=counterparty_role,
                                    severity=severity,
                                    role_mentioned=canonical_role in match.source,
                                    escalation_reason=escalation_reason,
                                ),
                                mitigation=self._ensure_complete_sentence(
                                    resolve_localized_text(rule.mitigation, resolved_language)
                                ),
                            ),
                        )
                    )

        risks_with_rank.extend(
            self._build_asymmetry_risks(
                signal_map=signal_map,
                role=role,
                canonical_role=canonical_role,
                language=resolved_language,
                seen_pairs=seen_pairs,
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
                    rule_id="fallback_low_risk",
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
            normalized_clause = normalize_contract_text(clause.text).casefold()
            for marker in self._config.dispute_markers:
                if not any(item.casefold() in normalized_clause for item in marker.markers):
                    continue
                dedupe_key = (clause.clause_id, marker.id)
                if dedupe_key in seen_pairs:
                    continue
                seen_pairs.add(dedupe_key)

                disputed.append(
                    DisputedClauseItem(
                        clause_id=clause.clause_id,
                        clause_excerpt=self._truncate_intelligently(normalize_contract_text(clause.text)),
                        dispute_reason=self._ensure_complete_sentence(
                            resolve_localized_text(marker.reason, resolved_language)
                        ),
                        possible_consequence=self._ensure_complete_sentence(
                            resolve_localized_text(marker.consequence, resolved_language)
                        ),
                        confidence=marker.confidence,
                    )
                )

        if not disputed and clauses:
            first_clause = normalize_contract_text(clauses[0].text)
            disputed.append(
                DisputedClauseItem(
                    clause_id=clauses[0].clause_id,
                    clause_excerpt=self._truncate_intelligently(first_clause),
                    dispute_reason=resolve_localized_text(self._config.fallback.dispute_reason, resolved_language),
                    possible_consequence=resolve_localized_text(
                        self._config.fallback.dispute_consequence,
                        resolved_language,
                    ),
                    confidence=self._config.fallback_dispute_confidence,
                )
            )

        return disputed

    def _match_rule(
        self,
        rule: RiskRuleConfig,
        clauses: list[ClauseSegment],
        combined_text: str,
        preferred_clause: ClauseSegment | None,
    ) -> list[RuleMatch]:
        detection_logic = rule.detection_logic
        if detection_logic is None:
            return self._legacy_keyword_matches(rule, clauses, preferred_clause)

        logic_type = detection_logic.type
        if logic_type == "negative_pattern":
            patterns = detection_logic.patterns or rule.keywords
            if not any(self._contains_pattern(combined_text, pattern) for pattern in patterns):
                return [RuleMatch(clause_id=None, excerpt="", matched_patterns=[], source="document")]
            return []

        if logic_type in {"keyword_any", "pattern_search", "pattern_with_context"}:
            return self._pattern_matches(rule, clauses, combined_text, preferred_clause)

        return self._legacy_keyword_matches(rule, clauses, preferred_clause)

    def _legacy_keyword_matches(
        self,
        rule: RiskRuleConfig,
        clauses: list[ClauseSegment],
        preferred_clause: ClauseSegment | None,
    ) -> list[RuleMatch]:
        matches: list[RuleMatch] = []
        for clause in clauses:
            normalized_clause = normalize_contract_text(clause.text).casefold()
            if not any(keyword.casefold() in normalized_clause for keyword in rule.keywords):
                continue
            matches.append(
                RuleMatch(
                    clause_id=clause.clause_id,
                    excerpt=self._truncate_intelligently(normalize_contract_text(clause.text)),
                    matched_patterns=rule.keywords,
                    source=normalized_clause,
                )
            )
            if preferred_clause is not None and clause.clause_id == preferred_clause.clause_id:
                break
        return matches

    def _pattern_matches(
        self,
        rule: RiskRuleConfig,
        clauses: list[ClauseSegment],
        combined_text: str,
        preferred_clause: ClauseSegment | None,
    ) -> list[RuleMatch]:
        assert rule.detection_logic is not None
        logic = rule.detection_logic
        patterns = logic.patterns or logic.any_patterns or rule.keywords
        all_patterns = logic.all_patterns
        source = logic.source
        matches: list[RuleMatch] = []

        if source == "document":
            if self._document_match_succeeds(combined_text, patterns, all_patterns, logic.min_matches):
                excerpt = self._select_best_excerpt(clauses, patterns or all_patterns)
                matches.append(
                    RuleMatch(
                        clause_id=excerpt[0],
                        excerpt=excerpt[1],
                        matched_patterns=patterns or all_patterns,
                        source=combined_text,
                    )
                )
            return matches

        total_hits = 0
        for clause in clauses:
            normalized_clause = normalize_contract_text(clause.text).casefold()
            hit_patterns = [pattern for pattern in patterns if self._contains_pattern(normalized_clause, pattern)]
            if all_patterns and not all(self._contains_pattern(normalized_clause, pattern) for pattern in all_patterns):
                continue
            if not hit_patterns and not all_patterns:
                continue
            total_hits += len(hit_patterns) or 1
            matches.append(
                RuleMatch(
                    clause_id=clause.clause_id,
                    excerpt=self._truncate_intelligently(normalize_contract_text(clause.text)),
                    matched_patterns=hit_patterns or all_patterns,
                    source=normalized_clause,
                )
            )

        if logic.type == "pattern_with_context" and total_hits < logic.min_matches:
            return []

        if preferred_clause is not None and preferred_clause.clause_id and matches:
            preferred = [match for match in matches if match.clause_id == preferred_clause.clause_id]
            if preferred:
                return preferred + [match for match in matches if match.clause_id != preferred_clause.clause_id]

        return matches

    @staticmethod
    def _resolve_clause_rank(
        rule: RiskRuleConfig,
        clause_id: str | None,
        clause_index_by_id: dict[str, int],
    ) -> int:
        if rule.detection_logic is not None and rule.detection_logic.source == "document":
            return 0
        if clause_id is None:
            return 0
        return clause_index_by_id.get(clause_id, 0)

    @staticmethod
    def _document_match_succeeds(
        combined_text: str,
        patterns: list[str],
        all_patterns: list[str],
        min_matches: int,
    ) -> bool:
        if all_patterns and not all(
            RiskScoringService._contains_pattern(combined_text, pattern) for pattern in all_patterns
        ):
            return False
        if not patterns:
            return bool(all_patterns)
        matches = sum(1 for pattern in patterns if RiskScoringService._contains_pattern(combined_text, pattern))
        return matches >= min_matches

    @staticmethod
    def _contains_pattern(text: str, pattern: str) -> bool:
        try:
            return bool(re.search(pattern, text, flags=re.IGNORECASE))
        except re.error:
            return pattern.casefold() in text

    def _select_best_excerpt(self, clauses: list[ClauseSegment], patterns: list[str]) -> tuple[str | None, str]:
        for clause in clauses:
            normalized_clause = normalize_contract_text(clause.text).casefold()
            if any(self._contains_pattern(normalized_clause, pattern) for pattern in patterns):
                return clause.clause_id, self._truncate_intelligently(normalize_contract_text(clause.text))
        return None, ""

    def _escalate_severity(
        self,
        rule: RiskRuleConfig,
        canonical_role: str,
        contract_type: str | None,
    ) -> tuple[RiskSeverity, str | None]:
        base_severity = RiskSeverity(rule.severity_base or rule.severity or RiskSeverity.MEDIUM.value)
        escalation = self._resolve_escalation(rule, canonical_role, contract_type)
        if escalation is None:
            return base_severity, None
        return RiskSeverity(escalation.escalate_to), self._resolve_escalation_reason(escalation)

    def _resolve_escalation(
        self,
        rule: RiskRuleConfig,
        canonical_role: str,
        contract_type: str | None,
    ) -> RoleEscalationEntryConfig | None:
        if canonical_role and canonical_role in rule.role_escalation:
            return rule.role_escalation[canonical_role]

        if contract_type:
            contract_matrix = self._config.role_escalation_matrix.get(contract_type, {})
            risk_matrix = contract_matrix.get(rule.id, {})
            if canonical_role and canonical_role in risk_matrix:
                return risk_matrix[canonical_role]

        return None

    def _resolve_escalation_reason(self, escalation: RoleEscalationEntryConfig) -> str | None:
        return escalation.reason_ru or escalation.reason_en or escalation.reason_it or escalation.reason_fr

    def _rule_applies_to_contract_type(self, rule: RiskRuleConfig, contract_type: str | None) -> bool:
        if not rule.affected_contract_types:
            return True
        if not contract_type:
            return True
        return contract_type in rule.affected_contract_types

    @staticmethod
    def _severity_rank(severity: RiskSeverity) -> int:
        ranks = {
            RiskSeverity.LOW: 1,
            RiskSeverity.MEDIUM: 2,
            RiskSeverity.HIGH: 3,
            RiskSeverity.CRITICAL: 4,
        }
        return ranks[severity]

    def _severity_label(self, language: str, severity: RiskSeverity) -> str:
        if language in self._config.severity_labels:
            localized_labels = self._config.severity_labels[language]
        else:
            localized_labels = self._config.severity_labels[self._language_behavior.fallback_language]

        return localized_labels.get(severity.value, severity.value)

    def _format_risk_title(self, language: str, severity: RiskSeverity, title_fragment: str) -> str:
        severity_label = self._severity_label(language, severity)
        return f"{severity_label}: {title_fragment}"

    def _build_role_relevance(
        self,
        language: str,
        role: str,
        counterparty_role: str | None,
        severity: RiskSeverity,
        role_mentioned: bool,
        escalation_reason: str | None,
    ) -> str:
        if escalation_reason:
            return self._ensure_complete_sentence(escalation_reason)

        if role_mentioned:
            template_map = self._config.role_relevance_templates.role_mentioned
        else:
            template_map = self._config.role_relevance_templates.role_generic

        result = resolve_localized_text(template_map, language).format(role=role)
        if counterparty_role and severity in {RiskSeverity.HIGH, RiskSeverity.CRITICAL}:
            result += f" Наиболее вероятный конфликт интересов со стороной '{counterparty_role}'."
        return self._ensure_complete_sentence(result)

    def _build_asymmetry_risks(
        self,
        signal_map: dict[str, list[AsymmetrySignal]],
        role: str,
        canonical_role: str,
        language: str,
        seen_pairs: set[tuple[str, str | None]],
    ) -> list[tuple[int, int, RiskItem]]:
        risks_with_rank: list[tuple[int, int, RiskItem]] = []
        for signal_group in signal_map.values():
            for signal in signal_group:
                if canonical_role and signal.affected_roles and canonical_role not in signal.affected_roles:
                    continue
                dedupe_key = (signal.risk_id, signal.clause_id)
                if dedupe_key in seen_pairs:
                    continue
                seen_pairs.add(dedupe_key)
                severity = RiskSeverity(signal.severity_hint)
                title = self._format_risk_title(language, severity, signal.summary)
                risks_with_rank.append(
                    (
                        self._severity_rank(severity),
                        0,
                        RiskItem(
                            risk_id="",
                            rule_id=signal.risk_id,
                            title=title,
                            severity=severity,
                            clause_id=signal.clause_id,
                            description=self._ensure_complete_sentence(signal.details or signal.summary),
                            role_relevance=self._ensure_complete_sentence(
                                f"Сигнал асимметрии затрагивает выбранную роль '{role}'."
                            ),
                            mitigation=self._default_mitigation_for_signal(signal.risk_id),
                        ),
                    )
                )
        return risks_with_rank

    @staticmethod
    def _group_asymmetry_signals(signals: list[AsymmetrySignal]) -> dict[str, list[AsymmetrySignal]]:
        grouped: dict[str, list[AsymmetrySignal]] = {}
        for signal in signals:
            grouped.setdefault(signal.risk_id, []).append(signal)
        return grouped

    def _default_mitigation_for_signal(self, risk_id: str) -> str:
        mitigations = {
            "payment_asymmetry": "Согласуйте аванс, этапные платежи или право приостановить исполнение до оплаты.",
            "termination_asymmetry": "Добавьте зеркальное право на отказ или четкие основания для одностороннего расторжения.",
            "undefined_acceptance_criteria": "Зафиксируйте объективные критерии приемки, сроки проверки и мотивированный отказ.",
        }
        return self._ensure_complete_sentence(
            mitigations.get(risk_id, resolve_localized_text(self._config.fallback.mitigation, "ru"))
        )

    def _truncate_intelligently(self, text: str) -> str:
        truncation = self._config.truncation
        if truncation is None:
            max_chars = self._config.max_clause_excerpt_chars
            return text if len(text) <= max_chars else f"{text[:max_chars].rstrip()}..."

        max_chars = truncation.max_chars
        if len(text) <= max_chars:
            return self._ensure_complete_sentence(text)

        truncated = text[:max_chars]
        if truncation.preserve_word_boundary:
            last_space = truncated.rfind(" ")
            if last_space > max_chars * 0.6:
                truncated = truncated[:last_space]

        if truncation.ensure_sentence_end and truncated[-1:] not in ".!?":
            last_sentence_end = max(truncated.rfind("."), truncated.rfind("!"), truncated.rfind("?"))
            if last_sentence_end > len(truncated) * 0.7:
                truncated = truncated[: last_sentence_end + 1]
            else:
                truncated = f"{truncated.rstrip()}{truncation.fallback_ending}"

        return truncated.strip()

    @staticmethod
    def _normalize_clause(clause: ClauseSegment) -> ClauseSegment:
        return ClauseSegment(clause_id=clause.clause_id, text=normalize_contract_text(clause.text))

    @staticmethod
    def _ensure_complete_sentence(text: str) -> str:
        cleaned = normalize_contract_text(text)
        if not cleaned:
            return cleaned
        if cleaned[-1] not in ".!?":
            return f"{cleaned}."
        return cleaned

    @staticmethod
    def _should_skip_risk(
        rule: RiskRuleConfig,
        canonical_role: str,
        severity: RiskSeverity,
        combined_text: str,
    ) -> bool:
        if severity != RiskSeverity.LOW:
            return False
        if not canonical_role:
            return False
        return canonical_role not in combined_text and bool(rule.role_escalation or rule.affected_contract_types)
