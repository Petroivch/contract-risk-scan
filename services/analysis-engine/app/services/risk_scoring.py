from __future__ import annotations

import re
from dataclasses import dataclass
from math import sqrt

from app.config.models import RiskRuleConfig, RoleEscalationEntryConfig
from app.config.runtime import get_runtime_config
from app.localization import normalize_analysis_language, resolve_localized_text
from app.dto.analysis import DisputedClauseItem, RiskExplanation, RiskItem, RiskSeverity
from app.services.asymmetry_detector import AsymmetrySignal
from app.services.clause_segmentation import ClauseSegment
from app.services.contract_analysis import (
    canonicalize_role,
    extract_roles_from_text,
    find_role_matches,
    localize_role_label,
    opposite_canonical_roles,
    role_aliases,
)
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
    applies_to_selected_role: bool


@dataclass(slots=True)
class RoleContextAssessment:
    selected_role_mentioned: bool
    selected_role_burdened: bool
    selected_role_benefited: bool
    counterparty_role_mentioned: bool
    counterparty_role_burdened: bool
    counterparty_role_benefited: bool


@dataclass(slots=True)
class ClauseFeatures:
    clause_id: str
    raw_text: str
    normalized_text: str
    excerpt: str
    tokens: set[str]
    detected_roles: set[str]
    obligation_markers: list[str]
    entity_markers: set[str]
    embedding: dict[str, float]


@dataclass(slots=True)
class RiskTemplate:
    text: str
    tokens: set[str]
    entity_markers: set[str]
    embedding: dict[str, float]


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
        self._semantic_stopwords = {
            "the",
            "and",
            "or",
            "for",
            "with",
            "without",
            "may",
            "shall",
            "must",
            "this",
            "that",
            "contract",
            "clause",
            "selected",
            "role",
            "risk",
            "create",
            "checked",
            "against",
            "context",
            "review",
            "manually",
            "clarify",
            "obligations",
            "limits",
            "remedies",
            "before",
            "signing",
        }
        self._semantic_anchor_noise = {
            "unilateral",
            "unilaterally",
            "without",
            "approval",
            "deadline",
            "deadlines",
            "delay",
            "days",
            "term",
            "period",
        }
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
        self._role_burden_markers = (
            "must",
            "shall",
            "liable",
            "responsible",
            "indemn",
            "damages",
            "penalt",
            "fine",
            "security",
            "deposit",
            "guarantee",
            "pay",
            "payment",
            "обязан",
            "обязуется",
            "должен",
            "уплач",
            "штраф",
            "неустой",
            "возмещ",
            "компенс",
            "обеспеч",
            "залог",
            "поручител",
        )
        self._role_benefit_markers = (
            "may",
            "sole discretion",
            "without approval",
            "limited to",
            "not liable",
            "deemed accepted",
            "automatically renew",
            "automatic renewal",
            "вправе",
            "по своему усмотрению",
            "без согласования",
            "не несет ответственности",
            "не отвечает",
            "ограничена",
            "считается принятым",
            "считаются принятыми",
            "автоматически продлевается",
            "внесудебн",
        )
        self._payment_exposure_roles = {"executor", "landlord", "lender"}
        self._semantic_expansions = {
            "payment": {
                "pay",
                "paid",
                "invoice",
                "settlement",
                "transfer",
                "prepayment",
                "advance",
                "fee",
                "payment",
                "pagamento",
                "pagare",
                "payer",
                "paiement",
                "fattura",
                "facture",
            },
            "sanction": {
                "penalty",
                "penalties",
                "fine",
                "fines",
                "penale",
                "penali",
                "amende",
                "amendes",
                "astreinte",
                "multa",
                "sanction",
                "liquidated",
                "damages",
                "late",
                "fee",
                "forfeit",
            },
            "deadline": {
                "deadline",
                "term",
                "period",
                "days",
                "day",
                "delay",
                "late",
                "overdue",
                "giorni",
                "giorno",
                "jours",
                "jour",
                "termine",
                "delai",
                "retard",
                "ritardo",
            },
            "discretion": {"sole", "discretion", "unilateral", "may", "without", "approval"},
            "acceptance": {"acceptance", "accept", "accepted", "act", "defect", "quality"},
            "termination": {"terminate", "termination", "cancel", "withdraw", "refuse"},
            "liability": {"liable", "liability", "damages", "losses", "indemnity", "cap"},
            "security": {"security", "deposit", "guarantee", "collateral", "retention"},
        }

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
        detected_roles_in_document = extract_roles_from_text(normalized_document_text)
        selected_role_present = bool(find_role_matches(role, normalized_document_text))
        if canonical_role and detected_roles_in_document and not selected_role_present:
            return []

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
                role_context = self._assess_role_context(
                    text=match.source or match.excerpt,
                    role=role,
                    counterparty_role=counterparty_role,
                )
                applies_to_selected_role = self._applies_to_selected_role(
                    rule_id=rule.id,
                    canonical_role=canonical_role,
                    role_context=role_context,
                    source_has_roles=match.source_has_roles,
                    role_mentioned=match.role_mentioned,
                )
                if canonical_role and not applies_to_selected_role:
                    continue

                severity, escalation_reason = self._escalate_severity(
                    rule,
                    canonical_role,
                    contract_type,
                    resolved_language,
                )
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
                    description = (
                        f"{description} {self._localized_evidence_prefix(resolved_language)} {match.excerpt}"
                    )

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
                                role_context=role_context,
                                escalation_reason=escalation_reason,
                            ),
                            mitigation=self._build_contextual_mitigation(
                                rule_id=rule.id,
                                language=resolved_language,
                                base_mitigation=resolve_localized_text(rule.mitigation, resolved_language),
                                excerpt=match.excerpt,
                                role_context=role_context,
                            ),
                            target_role=role,
                            confidence=match.classifier_score,
                            explanation=RiskExplanation(
                                summary=self._build_risk_explanation_summary(
                                    language=resolved_language,
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
                        applies_to_selected_role=applies_to_selected_role,
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
                        summary=self._localized_fallback_summary(resolved_language),
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
        tokens = set(self._filter_semantic_tokens(self._tokenize(normalized_text)))
        return ClauseFeatures(
            clause_id=clause.clause_id,
            raw_text=clause.text,
            normalized_text=lowered_text,
            excerpt=self._truncate_intelligently(normalized_text),
            tokens=tokens,
            detected_roles={role.canonical_role for role in extract_roles_from_text(normalized_text)},
            obligation_markers=[marker for marker in self._obligation_markers if marker in lowered_text],
            entity_markers=self._extract_entity_markers(lowered_text, tokens),
            embedding=self._embed_text(lowered_text),
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
        risk_template = self._build_risk_template(rule)
        semantic_terms = sorted(risk_template.tokens, key=len, reverse=True)
        semantic_available = bool(risk_template.embedding) and any(feature.embedding for feature in clause_features)
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
            entity_score = len(feature.entity_markers & risk_template.entity_markers) / max(
                1,
                len(risk_template.entity_markers),
            )
            semantic_score = (
                self._cosine_similarity(feature.embedding, risk_template.embedding)
                if semantic_available
                else 0.0
            )
            shared_entities = feature.entity_markers & risk_template.entity_markers
            payment_sanction_guardrail = self._is_payment_sanction_guardrail(rule, feature)
            semantic_evidence = (
                semantic_score >= 0.28
                and len(matched_terms) >= 2
                and bool(shared_entities)
            )
            retrieval_score = min(
                1.0,
                (semantic_score * 0.55 if semantic_available else term_score * 0.55)
                + term_score * 0.18
                + entity_score * 0.17
                + pattern_score * 0.22
                + (0.1 if feature.obligation_markers else 0.0)
                + (0.1 if role_mentioned else 0.0),
            )
            role_rerank = 0.0
            if role_mentioned:
                role_rerank += 0.1
            elif selected_role_present and source_has_roles:
                role_rerank -= 0.08

            guardrail_boost = 0.22 if guardrail is not None else 0.0
            if payment_sanction_guardrail:
                guardrail_boost = max(guardrail_boost, 0.24)
                matched_terms = sorted({*matched_terms, "payment_sanction"})

            classifier_score = min(
                1.0,
                retrieval_score
                + guardrail_boost
                + (0.08 if matched_patterns else 0.0)
                + (0.05 if source_has_roles and not selected_role_present else 0.0)
                + role_rerank,
            )

            has_regex_evidence = guardrail is not None or bool(matched_patterns)
            has_semantic_anchor = self._has_semantic_anchor(rule, matched_terms)
            if not (
                has_regex_evidence
                or payment_sanction_guardrail
                or semantic_evidence
                or has_semantic_anchor
            ):
                continue

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
                    guardrails=self._build_guardrail_labels(
                        guardrail=guardrail,
                        semantic_available=semantic_available,
                        payment_sanction=payment_sanction_guardrail,
                    ),
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

    def _build_risk_template(self, rule: RiskRuleConfig) -> RiskTemplate:
        localized_parts: list[str] = [rule.id.replace("_", " ")]
        localized_parts.extend(rule.keywords)
        for localized_map in (rule.title, rule.description, rule.mitigation):
            localized_parts.extend(value for value in localized_map.values() if value)
        if rule.detection_logic is not None:
            localized_parts.extend(self._rule_patterns(rule))

        template_text = " ".join(localized_parts).casefold()
        tokens = set(self._filter_semantic_tokens(self._tokenize(template_text)))
        entity_markers = self._extract_entity_markers(template_text, tokens)
        expanded_text = " ".join([template_text, *entity_markers, *tokens])
        return RiskTemplate(
            text=template_text,
            tokens=tokens,
            entity_markers=entity_markers,
            embedding=self._embed_text(expanded_text),
        )

    def _has_semantic_anchor(self, rule: RiskRuleConfig, matched_terms: list[str]) -> bool:
        anchor_terms = self._semantic_anchor_terms(rule)
        return bool(anchor_terms & set(matched_terms))

    def _semantic_anchor_terms(self, rule: RiskRuleConfig) -> set[str]:
        raw_parts = [rule.id.replace("_", " "), *rule.keywords, *self._rule_patterns(rule)]
        tokens = set(self._filter_semantic_tokens(self._tokenize(" ".join(raw_parts))))
        return {token for token in tokens if token not in self._semantic_anchor_noise}

    def _extract_entity_markers(self, text: str, tokens: set[str]) -> set[str]:
        markers: set[str] = set()
        marker_patterns = {
            "money": r"[$€£₽]|\b(?:rub|eur|usd|amount|price|fee|cost|payment|invoice|pagamento|paiement|prezzo|prix|importo|montant)\b",
            "percent": r"\d+(?:[.,]\d+)?\s*%",
            "deadline": r"\b\d{1,3}\s+(?:business\s+)?(?:days?|giorni?|jours?)\b|\b(?:deadline|delay|overdue|period|term|termine|delai|ritardo|retard)\b",
            "payment": r"\b(?:pay|paid|payment|invoice|prepayment|advance|settlement|transfer|pagamento|pagare|payer|paiement|fattura|facture)\b",
            "sanction": r"\b(?:penalty|penalties|fine|fines|sanction|liquidated\s+damages|late\s+fee|forfeit|penale|penali|amende|amendes|astreinte|multa)\b",
            "discretion": r"\b(?:sole\s+discretion|unilateral|may|without\s+approval|at\s+any\s+time)\b",
            "acceptance": r"\b(?:acceptance|accept|accepted|quality|defect|signed\s+act)\b",
            "termination": r"\b(?:terminate|termination|cancel|withdraw|refuse)\b",
            "liability": r"\b(?:liable|liability|damages|losses|indemnity|cap|uncapped)\b",
            "security": r"\b(?:security|deposit|guarantee|collateral|retention)\b",
        }
        for marker, pattern in marker_patterns.items():
            if re.search(pattern, text, flags=re.IGNORECASE):
                markers.add(marker)

        for marker, expansion_tokens in self._semantic_expansions.items():
            if tokens & expansion_tokens:
                markers.add(marker)

        return markers

    def _embed_text(self, text: str) -> dict[str, float]:
        tokens = self._filter_semantic_tokens(self._tokenize(text))
        if not tokens:
            return {}

        vector: dict[str, float] = {}
        for token in tokens:
            normalized = self._normalize_semantic_token(token)
            if not normalized:
                continue
            vector[normalized] = vector.get(normalized, 0.0) + 1.0
            for concept, expansion_tokens in self._semantic_expansions.items():
                if normalized in expansion_tokens:
                    vector[f"concept:{concept}"] = vector.get(f"concept:{concept}", 0.0) + 1.3
            for index in range(max(0, len(normalized) - 3)):
                gram = normalized[index : index + 4]
                vector[f"gram:{gram}"] = vector.get(f"gram:{gram}", 0.0) + 0.12

        magnitude = sqrt(sum(weight * weight for weight in vector.values()))
        if magnitude <= 0:
            return {}
        return {key: value / magnitude for key, value in vector.items()}

    @staticmethod
    def _normalize_semantic_token(token: str) -> str:
        normalized = token.casefold().strip("_")
        for suffix in ("ing", "ed", "es", "s"):
            if len(normalized) > len(suffix) + 3 and normalized.endswith(suffix):
                return normalized[: -len(suffix)]
        return normalized

    def _filter_semantic_tokens(self, tokens: list[str]) -> list[str]:
        return [
            token
            for token in tokens
            if token not in self._semantic_stopwords and not token.isdigit()
        ]

    @staticmethod
    def _cosine_similarity(left: dict[str, float], right: dict[str, float]) -> float:
        if not left or not right:
            return 0.0
        if len(left) > len(right):
            left, right = right, left
        return min(1.0, sum(weight * right.get(key, 0.0) for key, weight in left.items()))

    @staticmethod
    def _is_payment_sanction_guardrail(rule: RiskRuleConfig, feature: ClauseFeatures) -> bool:
        if rule.id not in {"one_sided_penalty", "uncapped_daily_penalty", "penalty_plus_full_damages"}:
            return False
        return "sanction" in feature.entity_markers and (
            "percent" in feature.entity_markers
            or "deadline" in feature.entity_markers
            or "payment" in feature.entity_markers
        )

    @staticmethod
    def _build_guardrail_labels(
        *,
        guardrail: RuleMatch | None,
        semantic_available: bool,
        payment_sanction: bool,
    ) -> list[str]:
        labels: list[str] = []
        if semantic_available:
            labels.append("semantic_embedding_retrieval")
        if guardrail is not None:
            labels.append("regex_guardrail")
        if payment_sanction:
            labels.append("payment_sanction_guardrail")
        return labels

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
        language: str,
        rule_id: str,
        role: str,
        selected_role_present: bool,
        role_mentioned: bool,
    ) -> str:
        localized_role = localize_role_label(role, language) or role
        templates = {
            "ru": {
                "mentioned": "Гибридный классификатор сопоставил правило '{rule_id}' с пунктом, который прямо упоминает роль '{role}'.",
                "missing": "Гибридный классификатор сопоставил правило '{rule_id}', хотя выбранная роль '{role}' не найдена в тексте договора.",
                "relevant": "Гибридный классификатор сопоставил правило '{rule_id}' с пунктом, который остается релевантным роли '{role}'.",
            },
            "en": {
                "mentioned": "The hybrid classifier matched rule '{rule_id}' on a clause that explicitly mentions role '{role}'.",
                "missing": "The hybrid classifier matched rule '{rule_id}' even though the selected role label '{role}' was not found in the document text.",
                "relevant": "The hybrid classifier matched rule '{rule_id}' on a clause that remains relevant to role '{role}'.",
            },
            "it": {
                "mentioned": "Il classificatore ibrido ha associato la regola '{rule_id}' a una clausola che menziona esplicitamente il ruolo '{role}'.",
                "missing": "Il classificatore ibrido ha associato la regola '{rule_id}' anche se l'etichetta del ruolo selezionato '{role}' non e stata trovata nel testo del contratto.",
                "relevant": "Il classificatore ibrido ha associato la regola '{rule_id}' a una clausola che resta rilevante per il ruolo '{role}'.",
            },
            "fr": {
                "mentioned": "Le classifieur hybride a associe la regle '{rule_id}' a une clause qui mentionne explicitement le role '{role}'.",
                "missing": "Le classifieur hybride a associe la regle '{rule_id}' alors que l'etiquette du role selectionne '{role}' n'a pas ete trouvee dans le texte du contrat.",
                "relevant": "Le classifieur hybride a associe la regle '{rule_id}' a une clause qui reste pertinente pour le role '{role}'.",
            },
        }
        messages = templates.get(language, templates["ru"])
        if role_mentioned:
            return messages["mentioned"].format(rule_id=rule_id, role=localized_role)
        if not selected_role_present:
            return messages["missing"].format(rule_id=rule_id, role=localized_role)
        return messages["relevant"].format(rule_id=rule_id, role=localized_role)

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
        language: str,
    ) -> tuple[RiskSeverity, str | None]:
        base_severity = RiskSeverity(rule.severity_base or rule.severity or RiskSeverity.MEDIUM.value)
        escalation = self._resolve_escalation(rule, canonical_role, contract_type)
        if escalation is None:
            return base_severity, None
        return RiskSeverity(escalation.escalate_to), self._resolve_escalation_reason(escalation, language)

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

    @staticmethod
    def _resolve_escalation_reason(escalation: RoleEscalationEntryConfig, language: str) -> str | None:
        localized_reasons = {
            "ru": escalation.reason_ru,
            "en": escalation.reason_en,
            "it": escalation.reason_it,
            "fr": escalation.reason_fr,
        }
        return localized_reasons.get(language) or escalation.reason_en or escalation.reason_ru

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

    def _assess_role_context(
        self,
        *,
        text: str,
        role: str,
        counterparty_role: str | None,
    ) -> RoleContextAssessment:
        normalized_text = normalize_contract_text(text).casefold()
        selected_aliases = role_aliases(role)
        counterparty_aliases = role_aliases(counterparty_role)

        if not counterparty_aliases:
            for opposite_role in opposite_canonical_roles(role):
                counterparty_aliases.update(role_aliases(opposite_role))

        selected_windows = self._extract_role_windows(normalized_text, selected_aliases)
        counterparty_windows = self._extract_role_windows(normalized_text, counterparty_aliases)

        return RoleContextAssessment(
            selected_role_mentioned=bool(selected_windows),
            selected_role_burdened=any(self._window_has_marker(window, self._role_burden_markers) for window in selected_windows),
            selected_role_benefited=any(self._window_has_marker(window, self._role_benefit_markers) for window in selected_windows),
            counterparty_role_mentioned=bool(counterparty_windows),
            counterparty_role_burdened=any(
                self._window_has_marker(window, self._role_burden_markers) for window in counterparty_windows
            ),
            counterparty_role_benefited=any(
                self._window_has_marker(window, self._role_benefit_markers) for window in counterparty_windows
            ),
        )

    def _extract_role_windows(self, text: str, aliases: set[str]) -> list[str]:
        windows: list[str] = []
        seen: set[tuple[int, int]] = set()

        for alias in sorted({alias.casefold().strip() for alias in aliases if alias and alias.strip()}, key=len, reverse=True):
            for match in re.finditer(rf"(?<!\w){re.escape(alias)}(?!\w)", text):
                start = max(0, match.start() - 72)
                end = min(len(text), match.end() + 180)
                key = (start, end)
                if key in seen:
                    continue
                seen.add(key)
                windows.append(text[start:end])

        return windows

    @staticmethod
    def _window_has_marker(window: str, markers: tuple[str, ...]) -> bool:
        return any(marker in window for marker in markers)

    def _applies_to_selected_role(
        self,
        *,
        rule_id: str,
        canonical_role: str,
        role_context: RoleContextAssessment,
        source_has_roles: bool,
        role_mentioned: bool,
    ) -> bool:
        if not canonical_role:
            return True

        if role_context.selected_role_burdened:
            return True
        if role_context.counterparty_role_benefited:
            return True

        if (
            rule_id == "payment_asymmetry"
            and canonical_role in self._payment_exposure_roles
            and role_context.counterparty_role_burdened
        ):
            return True

        if role_context.selected_role_benefited and not role_context.selected_role_burdened:
            return False
        if role_context.counterparty_role_burdened and not role_context.counterparty_role_benefited:
            return False

        if role_context.selected_role_mentioned:
            return True
        if source_has_roles:
            return role_mentioned
        return True

    def _build_role_relevance(
        self,
        language: str,
        role: str,
        counterparty_role: str | None,
        severity: RiskSeverity,
        role_mentioned: bool,
        role_context: RoleContextAssessment,
        escalation_reason: str | None,
    ) -> str:
        if escalation_reason:
            return self._ensure_complete_sentence(escalation_reason)

        localized_role = localize_role_label(role, language) or role
        localized_counterparty = (
            localize_role_label(counterparty_role, language) or counterparty_role or ""
        )

        if role_context.selected_role_burdened:
            return self._ensure_complete_sentence(
                self._localized_direct_burden(language).format(role=localized_role)
            )
        if localized_counterparty and role_context.counterparty_role_benefited:
            result = self._localized_counterparty_advantage(language).format(
                role=localized_role,
                counterparty_role=localized_counterparty,
            )
            if severity in {RiskSeverity.HIGH, RiskSeverity.CRITICAL}:
                result += " " + self._localized_counterparty_conflict(language).format(
                    counterparty_role=localized_counterparty
                )
            return self._ensure_complete_sentence(result)

        if role_mentioned:
            template_map = self._config.role_relevance_templates.role_mentioned
        else:
            template_map = self._config.role_relevance_templates.role_generic

        result = resolve_localized_text(template_map, language).format(role=localized_role)
        if counterparty_role and severity in {RiskSeverity.HIGH, RiskSeverity.CRITICAL}:
            result += " " + self._localized_counterparty_conflict(language).format(
                counterparty_role=localized_counterparty or counterparty_role
            )
        return self._ensure_complete_sentence(result)

    @staticmethod
    def _localized_evidence_prefix(language: str) -> str:
        prefixes = {
            "ru": "Найденный фрагмент:",
            "en": "Evidence excerpt:",
            "it": "Estratto di prova:",
            "fr": "Extrait probant :",
        }
        return prefixes.get(language, prefixes["ru"])

    @staticmethod
    def _localized_counterparty_conflict(language: str) -> str:
        templates = {
            "ru": "Наиболее вероятный конфликт интересов со стороной '{counterparty_role}'.",
            "en": "The most likely interest conflict is with counterparty '{counterparty_role}'.",
            "it": "Il conflitto di interessi piu probabile e con la controparte '{counterparty_role}'.",
            "fr": "Le conflit d'interets le plus probable concerne la contrepartie '{counterparty_role}'.",
        }
        return templates.get(language, templates["ru"])

    @staticmethod
    def _localized_direct_burden(language: str) -> str:
        templates = {
            "ru": "Пункт прямо возлагает обязанность, санкцию или ответственность на роль '{role}'.",
            "en": "This clause directly places a duty, sanction, or liability on role '{role}'.",
            "it": "Questa clausola impone direttamente un obbligo, una sanzione o una responsabilita al ruolo '{role}'.",
            "fr": "Cette clause impose directement une obligation, une sanction ou une responsabilite au role '{role}'.",
        }
        return templates.get(language, templates["ru"])

    @staticmethod
    def _localized_counterparty_advantage(language: str) -> str:
        templates = {
            "ru": "Пункт дает стороне '{counterparty_role}' одностороннее преимущество против роли '{role}'.",
            "en": "This clause gives counterparty '{counterparty_role}' a one-sided advantage against role '{role}'.",
            "it": "Questa clausola attribuisce alla controparte '{counterparty_role}' un vantaggio unilaterale rispetto al ruolo '{role}'.",
            "fr": "Cette clause accorde a la contrepartie '{counterparty_role}' un avantage unilateral a l'encontre du role '{role}'.",
        }
        return templates.get(language, templates["ru"])

    def _build_contextual_mitigation(
        self,
        *,
        rule_id: str,
        language: str,
        base_mitigation: str,
        excerpt: str,
        role_context: RoleContextAssessment,
    ) -> str:
        base = self._ensure_complete_sentence(base_mitigation)
        detail = self._localized_precision_hint(
            language=language,
            rule_id=rule_id,
            excerpt=excerpt,
            role_context=role_context,
        )
        if not detail or detail.casefold() in base.casefold():
            return base
        return self._ensure_complete_sentence(f"{base} {detail}")

    def _localized_precision_hint(
        self,
        *,
        language: str,
        rule_id: str,
        excerpt: str,
        role_context: RoleContextAssessment,
    ) -> str:
        payment_rules = {"payment_asymmetry"}
        burden_rules = {
            "one_sided_penalty",
            "uncapped_daily_penalty",
            "penalty_plus_full_damages",
            "unlimited_liability",
            "lost_profit_waiver",
            "security_foreclosure",
            "pledge_foreclosure",
            "bank_guarantee_on_demand",
        }
        control_rules = {
            "unilateral_price_change",
            "unilateral_termination",
            "silent_acceptance",
            "undefined_acceptance_criteria",
            "exclusive_jurisdiction",
            "short_claim_window",
            "automatic_renewal",
        }

        if rule_id in payment_rules:
            return self._localized_payment_hint(language)
        if role_context.selected_role_burdened or rule_id in burden_rules:
            return self._localized_burden_hint(language)
        if role_context.counterparty_role_benefited or rule_id in control_rules:
            return self._localized_control_hint(language)
        if excerpt and any(token in excerpt.casefold() for token in ("срок", "deadline", "term", "days", "jours", "giorni")):
            return self._localized_deadline_hint(language)
        return self._localized_generic_precision_hint(language)

    @staticmethod
    def _localized_payment_hint(language: str) -> str:
        templates = {
            "ru": "Зафиксируйте событие оплаты, предельный срок перечисления и право приостановить исполнение при просрочке.",
            "en": "Pin down the payment trigger, the outside payment date, and a right to suspend performance for delay.",
            "it": "Definisci con precisione il trigger del pagamento, la data limite di versamento e il diritto di sospendere la prestazione in caso di ritardo.",
            "fr": "Precisez le declencheur du paiement, la date limite de versement et le droit de suspendre l'execution en cas de retard.",
        }
        return templates.get(language, templates["ru"])

    @staticmethod
    def _localized_burden_hint(language: str) -> str:
        templates = {
            "ru": "Свяжите риск с закрытым перечнем нарушений, лимитом суммы и ясными исключениями из ответственности.",
            "en": "Tie the exposure to a closed list of breaches, a capped amount, and explicit carve-outs.",
            "it": "Collega l'esposizione a un elenco chiuso di violazioni, a un tetto di importo e a esclusioni esplicite.",
            "fr": "Rattachez l'exposition a une liste fermee de manquements, a un plafond de montant et a des exceptions explicites.",
        }
        return templates.get(language, templates["ru"])

    @staticmethod
    def _localized_control_hint(language: str) -> str:
        templates = {
            "ru": "Уберите одностороннее усмотрение: перечислите основания, сроки уведомления и порядок возражений.",
            "en": "Remove one-sided discretion by listing the grounds, notice timing, and objection procedure.",
            "it": "Elimina la discrezionalita unilaterale indicando presupposti, tempi di preavviso e procedura di contestazione.",
            "fr": "Supprimez la discretion unilaterale en listant les motifs, les delais de preavis et la procedure de contestation.",
        }
        return templates.get(language, templates["ru"])

    @staticmethod
    def _localized_deadline_hint(language: str) -> str:
        templates = {
            "ru": "Пропишите дату начала срока, конечный дедлайн и последствия пропуска без оценочных формулировок.",
            "en": "Spell out the start date, the final deadline, and the consequences of delay without subjective wording.",
            "it": "Indica data iniziale, scadenza finale e conseguenze del ritardo senza formulazioni discrezionali.",
            "fr": "Precisez la date de depart, l'echeance finale et les consequences du retard sans formulation subjective.",
        }
        return templates.get(language, templates["ru"])

    @staticmethod
    def _localized_generic_precision_hint(language: str) -> str:
        templates = {
            "ru": "Привяжите формулировку к измеримым критериям, документам-подтверждениям и симметричным правам сторон.",
            "en": "Anchor the clause to measurable criteria, documentary evidence, and balanced rights for both sides.",
            "it": "Ancora la clausola a criteri misurabili, prove documentali e diritti bilanciati per entrambe le parti.",
            "fr": "Ancrez la clause dans des criteres mesurables, des preuves documentaires et des droits equilibres pour les deux parties.",
        }
        return templates.get(language, templates["ru"])

    @staticmethod
    def _localized_asymmetry_relevance(language: str) -> str:
        templates = {
            "ru": "Сигнал асимметрии затрагивает выбранную роль '{role}'.",
            "en": "The asymmetry signal affects selected role '{role}'.",
            "it": "Il segnale di asimmetria riguarda il ruolo selezionato '{role}'.",
            "fr": "Le signal d'asymetrie concerne le role selectionne '{role}'.",
        }
        return templates.get(language, templates["ru"])

    @staticmethod
    def _localized_asymmetry_summary(language: str, risk_id: str, role: str) -> str:
        templates = {
            "ru": "Детектор асимметрии повысил сигнал '{risk_id}' для роли '{role}'.",
            "en": "The asymmetry detector promoted signal '{risk_id}' for role '{role}'.",
            "it": "Il rilevatore di asimmetria ha promosso il segnale '{risk_id}' per il ruolo '{role}'.",
            "fr": "Le detecteur d'asymetrie a promu le signal '{risk_id}' pour le role '{role}'.",
        }
        return templates.get(language, templates["ru"]).format(
            risk_id=risk_id,
            role=localize_role_label(role, language) or role,
        )
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
                applies_to_selected_role = not canonical_role or not signal.affected_roles or canonical_role in signal.affected_roles
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
                            role_relevance=self._localized_asymmetry_relevance(language).format(
                                role=localize_role_label(role, language) or role
                            ),
                            mitigation=self._default_mitigation_for_signal(signal.risk_id, language),
                            target_role=role,
                            confidence=classifier_score,
                            explanation=RiskExplanation(
                                summary=self._localized_asymmetry_summary(language, signal.risk_id, role),
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
                        applies_to_selected_role=applies_to_selected_role,
                    )
                )
        return risks_with_rank

    @staticmethod
    def _filter_risks_for_selected_role(
        risks_with_rank: list[RankedRiskCandidate],
        canonical_role: str,
        selected_role_present: bool,
    ) -> list[RankedRiskCandidate]:
        if not canonical_role:
            return risks_with_rank

        if not selected_role_present:
            return []

        return [
            candidate
            for candidate in risks_with_rank
            if candidate.applies_to_selected_role or not candidate.source_has_roles
        ]

    @staticmethod
    def _group_asymmetry_signals(signals: list[AsymmetrySignal]) -> dict[str, list[AsymmetrySignal]]:
        grouped: dict[str, list[AsymmetrySignal]] = {}
        for signal in signals:
            grouped.setdefault(signal.risk_id, []).append(signal)
        return grouped

    def _default_mitigation_for_signal(self, risk_id: str, language: str) -> str:
        mitigations = {
            "payment_asymmetry": {
                "ru": "Согласуйте аванс, этапные платежи или право приостановить исполнение до оплаты.",
                "en": "Agree an advance, milestone payments, or a right to suspend performance until payment.",
                "it": "Concorda un anticipo, pagamenti a stati di avanzamento o il diritto di sospendere la prestazione fino al pagamento.",
                "fr": "Prevoyez une avance, des paiements par jalons ou le droit de suspendre l'execution jusqu'au paiement.",
            },
            "termination_asymmetry": {
                "ru": "Добавьте зеркальное право на отказ или четкие основания для одностороннего расторжения.",
                "en": "Add a reciprocal termination right or clear grounds for unilateral termination.",
                "it": "Aggiungi un diritto di recesso reciproco o motivi chiari per il recesso unilaterale.",
                "fr": "Ajoutez un droit de resiliation reciproque ou des motifs clairs de resiliation unilaterale.",
            },
            "undefined_acceptance_criteria": {
                "ru": "Зафиксируйте объективные критерии приемки, сроки проверки и мотивированный отказ.",
                "en": "Set objective acceptance criteria, review deadlines, and a reasoned rejection process.",
                "it": "Definisci criteri oggettivi di accettazione, termini di verifica e una procedura di rifiuto motivato.",
                "fr": "Fixez des criteres objectifs d'acceptation, des delais de controle et une procedure de refus motive.",
            },
        }
        localized = mitigations.get(risk_id, {}).get(language)
        return self._ensure_complete_sentence(
            localized or resolve_localized_text(self._config.fallback.mitigation, language)
        )

    @staticmethod
    def _localized_fallback_summary(language: str) -> str:
        templates = {
            "ru": "Ни один гибридный риск-кандидат не прошел порог классификатора, поэтому возвращен запасной вариант.",
            "en": "No hybrid risk candidate cleared the classifier threshold, so the fallback item was returned.",
            "it": "Nessun candidato di rischio ibrido ha superato la soglia del classificatore, quindi e stato restituito il fallback.",
            "fr": "Aucun candidat de risque hybride n'a franchi le seuil du classifieur, donc l'element de repli a ete renvoye.",
        }
        return templates.get(language, templates["ru"])

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

