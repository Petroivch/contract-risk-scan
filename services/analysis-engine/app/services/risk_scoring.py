from __future__ import annotations

import re
from dataclasses import dataclass

from app.config.models import RiskRuleConfig, RoleEscalationEntryConfig
from app.config.runtime import get_runtime_config
from app.localization import normalize_analysis_language, resolve_localized_text
from app.schemas.analysis import DisputedClauseItem, RiskExplanation, RiskItem, RiskSeverity
from app.services.asymmetry_detector import AsymmetrySignal
from app.services.clause_segmentation import ClauseSegment
from app.services.contract_analysis import canonicalize_role, extract_roles_from_text, find_role_matches
from app.services.disputed_clause_detector import DisputedClauseDetector
from app.services.text_normalization import normalize_contract_text


@dataclass(slots=True)
class RuleMatch:
    clause_id: str | None
    excerpt: str
    matched_patterns: list[str]
    source: str


@dataclass(slots=True)
class RankedRiskCandidate:
    severity_rank: int
    confidence_rank: float
    clause_rank: int
    risk: RiskItem
    source_has_roles: bool
    role_mentioned: bool


@dataclass(slots=True)
class ClauseFeatures:
    clause_id: str
    raw_text: str
    normalized_text: str
    excerpt: str
    tokens: set[str]
    detected_roles: set[str]
    obligation_markers: list[str]


@dataclass(slots=True)
class HybridMatch:
    clause_id: str | None
    excerpt: str
    source: str
    matched_terms: list[str]
    matched_patterns: list[str]
    retrieval_score: float
    classifier_score: float
    role_mentioned: bool
    source_has_roles: bool
    guardrails: list[str]


class RiskScoringService:
    """Rule engine for legal risk scoring with contract-type and role-aware escalation."""

    def __init__(self) -> None:
        runtime_config = get_runtime_config()
        self._language_behavior = runtime_config.language_behavior
        self._config = runtime_config.risk_scoring
        self._disputed_clause_detector = DisputedClauseDetector()
        self._obligation_markers = (
            "must",
            "shall",
            "обязан",
            "обязуется",
            "должен",
            "обязаны",
            "liable",
            "responsible",
        )

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
        normalized_document_text = normalize_contract_text(
            document_text if document_text is not None else "\n".join(clause.text for clause in normalized_clauses)
        )
        combined_text = normalized_document_text.casefold()
        clause_index_by_id = {clause.clause_id: index for index, clause in enumerate(normalized_clauses)}
        clause_features = [self._build_clause_features(clause) for clause in normalized_clauses]
        risks_with_rank: list[RankedRiskCandidate] = []
        seen_pairs: set[tuple[str, str | None]] = set()
        selected_role_present = bool(find_role_matches(role, normalized_document_text))

        signal_map = self._group_asymmetry_signals(asymmetry_signals or [])
        for rule in self._config.risk_rules:
            if not self._rule_applies_to_contract_type(rule, contract_type):
                continue

            guardrail_matches = self._match_rule(
                rule=rule,
                clauses=normalized_clauses,
                combined_text=combined_text,
                preferred_clause=None,
            )
            matches = self._hybrid_match_rule(
                rule=rule,
                clause_features=clause_features,
                guardrail_matches=guardrail_matches,
                canonical_role=canonical_role,
                selected_role_present=selected_role_present,
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
                    RankedRiskCandidate(
                        severity_rank=self._severity_rank(severity),
                        confidence_rank=match.classifier_score,
                        clause_rank=self._resolve_clause_rank(rule, match.clause_id, clause_index_by_id),
                        risk=RiskItem(
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
                                role_mentioned=match.role_mentioned,
                                escalation_reason=escalation_reason,
                            ),
                            mitigation=self._ensure_complete_sentence(
                                resolve_localized_text(rule.mitigation, resolved_language)
                            ),
                            target_role=role,
                            confidence=match.classifier_score,
                            explanation=RiskExplanation(
                                summary=self._build_risk_explanation_summary(
                                    rule_id=rule.id,
                                    role=role,
                                    selected_role_present=selected_role_present,
                                    role_mentioned=match.role_mentioned,
                                ),
                                matched_terms=match.matched_terms,
                                matched_patterns=match.matched_patterns,
                                retrieval_score=match.retrieval_score,
                                classifier_score=match.classifier_score,
                                guardrails=match.guardrails,
                                source_excerpt=match.excerpt or None,
                            ),
                        ),
                        source_has_roles=match.source_has_roles,
                        role_mentioned=match.role_mentioned,
                    )
                )

        risks_with_rank.extend(
            self._build_asymmetry_risks(
                signal_map=signal_map,
                role=role,
                canonical_role=canonical_role,
                language=resolved_language,
                seen_pairs=seen_pairs,
                selected_role_present=selected_role_present,
            )
        )
        risks_with_rank = self._filter_risks_for_selected_role(
            risks_with_rank,
            canonical_role,
            selected_role_present,
        )
        risks_with_rank.sort(key=lambda item: (-item.severity_rank, -item.confidence_rank, item.clause_rank))
        risks = [
            candidate.risk.model_copy(update={"risk_id": f"{self._config.risk_id_prefix}{index}"})
            for index, candidate in enumerate(risks_with_rank, start=1)
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
                    target_role=role,
                    confidence=0.2,
                    explanation=RiskExplanation(
                        summary="No hybrid risk candidate cleared the classifier threshold; returning fallback.",
                        matched_terms=[],
                        matched_patterns=[],
                        retrieval_score=0.0,
                        classifier_score=0.2,
                        guardrails=["fallback"],
                        source_excerpt=None,
                    ),
                )
            )

        return risks

    def extract_disputed_clauses(self, clauses: list[ClauseSegment], language: str) -> list[DisputedClauseItem]:
        return self._disputed_clause_detector.detect(clauses, language)

    def _build_clause_features(self, clause: ClauseSegment) -> ClauseFeatures:
        normalized_text = normalize_contract_text(clause.text)
        lowered_text = normalized_text.casefold()
        tokens = set(self._tokenize(normalized_text))
        return ClauseFeatures(
            clause_id=clause.clause_id,
            raw_text=clause.text,
            normalized_text=lowered_text,
            excerpt=self._truncate_intelligently(normalized_text),
            tokens=tokens,
            detected_roles={role.canonical_role for role in extract_roles_from_text(normalized_text)},
            obligation_markers=[marker for marker in self._obligation_markers if marker in lowered_text],
        )

    def _hybrid_match_rule(
        self,
        rule: RiskRuleConfig,
        clause_features: list[ClauseFeatures],
        guardrail_matches: list[RuleMatch],
        canonical_role: str,
        selected_role_present: bool,
    ) -> list[HybridMatch]:
        guardrail_by_clause: dict[str | None, RuleMatch] = {
            match.clause_id: match for match in guardrail_matches
        }
        semantic_terms = self._rule_semantic_terms(rule)
        matches: list[HybridMatch] = []

        if not clause_features and guardrail_matches:
            for guardrail in guardrail_matches:
                matches.append(
                    HybridMatch(
                        clause_id=guardrail.clause_id,
                        excerpt=guardrail.excerpt,
                        source=guardrail.source,
                        matched_terms=[],
                        matched_patterns=guardrail.matched_patterns,
                        retrieval_score=0.35,
                        classifier_score=0.55,
                        role_mentioned=False,
                        source_has_roles=False,
                        guardrails=["legacy_match"],
                    )
                )
            return matches

        for feature in clause_features:
            guardrail = guardrail_by_clause.get(feature.clause_id)
            matched_patterns = self._match_patterns_for_clause(rule, feature)
            matched_terms = [
                term for term in semantic_terms if term in feature.tokens or term in feature.normalized_text
            ]
            role_mentioned = bool(canonical_role) and canonical_role in feature.detected_roles
            source_has_roles = bool(feature.detected_roles)
            term_score = len(matched_terms) / max(1, min(len(semantic_terms), 6))
            pattern_score = len(matched_patterns) / max(1, len(self._rule_patterns(rule)))
            retrieval_score = min(
                1.0,
                term_score * 0.55
                + pattern_score * 0.3
                + (0.1 if feature.obligation_markers else 0.0)
                + (0.1 if role_mentioned else 0.0),
            )
            classifier_score = min(
                1.0,
                retrieval_score
                + (0.22 if guardrail is not None else 0.0)
                + (0.08 if matched_patterns else 0.0)
                + (0.05 if source_has_roles and not selected_role_present else 0.0),
            )

            if classifier_score < 0.42 and guardrail is None:
                continue

            matches.append(
                HybridMatch(
                    clause_id=feature.clause_id,
                    excerpt=(guardrail.excerpt if guardrail and guardrail.excerpt else feature.excerpt),
                    source=feature.normalized_text,
                    matched_terms=matched_terms,
                    matched_patterns=matched_patterns or (guardrail.matched_patterns if guardrail else []),
                    retrieval_score=round(retrieval_score, 4),
                    classifier_score=round(max(classifier_score, 0.45 if guardrail else classifier_score), 4),
                    role_mentioned=role_mentioned,
                    source_has_roles=source_has_roles,
                    guardrails=["legacy_match"] if guardrail is not None else [],
                )
            )

        for guardrail in guardrail_matches:
            if any(match.clause_id == guardrail.clause_id for match in matches):
                continue
            matches.append(
                HybridMatch(
                    clause_id=guardrail.clause_id,
                    excerpt=guardrail.excerpt,
                    source=guardrail.source,
                    matched_terms=[],
                    matched_patterns=guardrail.matched_patterns,
                    retrieval_score=0.3,
                    classifier_score=0.5,
                    role_mentioned=bool(find_role_matches(canonical_role, guardrail.source)) if canonical_role else False,
                    source_has_roles=bool(extract_roles_from_text(guardrail.source)),
                    guardrails=["legacy_match"],
                )
            )

        return matches

    def _rule_patterns(self, rule: RiskRuleConfig) -> list[str]:
        if rule.detection_logic is None:
            return list(rule.keywords)
        logic = rule.detection_logic
        return [*logic.patterns, *logic.any_patterns, *logic.all_patterns, *rule.keywords]

    def _rule_semantic_terms(self, rule: RiskRuleConfig) -> list[str]:
        terms: set[str] = set()
        for raw_value in self._rule_patterns(rule):
            terms.update(self._tokenize(raw_value))
        if not terms:
            terms.update(self._tokenize(rule.id.replace("_", " ")))
        return sorted(terms, key=len, reverse=True)

    def _match_patterns_for_clause(self, rule: RiskRuleConfig, feature: ClauseFeatures) -> list[str]:
        return [
            pattern
            for pattern in self._rule_patterns(rule)
            if pattern and self._contains_pattern(feature.normalized_text, pattern)
        ]

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        return [
            token.casefold()
            for token in re.findall(r"[0-9A-Za-zА-Яа-яЁё_]{3,}", text)
            if token
        ]

    @staticmethod
    def _build_risk_explanation_summary(
        *,
        rule_id: str,
        role: str,
        selected_role_present: bool,
        role_mentioned: bool,
    ) -> str:
        if role_mentioned:
            return f"Hybrid classifier matched rule '{rule_id}' on a clause that explicitly mentions role '{role}'."
        if not selected_role_present:
            return (
                f"Hybrid classifier matched rule '{rule_id}' even though the selected role label "
                f"'{role}' was not found in the document text."
            )
        return f"Hybrid classifier matched rule '{rule_id}' on a clause that remains relevant to role '{role}'."

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
        selected_role_present: bool,
    ) -> list[RankedRiskCandidate]:
        risks_with_rank: list[RankedRiskCandidate] = []
        for signal_group in signal_map.values():
            for signal in signal_group:
                if (
                    selected_role_present
                    and canonical_role
                    and signal.affected_roles
                    and canonical_role not in signal.affected_roles
                ):
                    continue
                dedupe_key = (signal.risk_id, signal.clause_id)
                if dedupe_key in seen_pairs:
                    continue
                seen_pairs.add(dedupe_key)
                severity = RiskSeverity(signal.severity_hint)
                title = self._format_risk_title(language, severity, signal.summary)
                role_mentioned = not canonical_role or canonical_role in signal.affected_roles
                classifier_score = 0.86 if role_mentioned else 0.62
                risks_with_rank.append(
                    RankedRiskCandidate(
                        severity_rank=self._severity_rank(severity),
                        confidence_rank=classifier_score,
                        clause_rank=0,
                        risk=RiskItem(
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
                            target_role=role,
                            confidence=classifier_score,
                            explanation=RiskExplanation(
                                summary=f"Asymmetry detector promoted signal '{signal.risk_id}' for role '{role}'.",
                                matched_terms=[],
                                matched_patterns=[],
                                retrieval_score=classifier_score,
                                classifier_score=classifier_score,
                                guardrails=["asymmetry_signal"],
                                source_excerpt=signal.details or signal.summary,
                            ),
                        ),
                        source_has_roles=bool(signal.affected_roles),
                        role_mentioned=role_mentioned,
                    )
                )
        return risks_with_rank

    @staticmethod
    def _filter_risks_for_selected_role(
        risks_with_rank: list[RankedRiskCandidate],
        canonical_role: str,
        selected_role_present: bool,
    ) -> list[RankedRiskCandidate]:
        if not canonical_role or not selected_role_present:
            return risks_with_rank

        return [
            candidate
            for candidate in risks_with_rank
            if candidate.role_mentioned or not candidate.source_has_roles
        ]

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
        normalized_text = normalize_contract_text(clause.text)
        end_offset = clause.end_offset or clause.offset + len(normalized_text)
        return ClauseSegment(
            clause_id=clause.clause_id,
            text=normalized_text,
            offset=clause.offset,
            end_offset=end_offset,
        )

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
