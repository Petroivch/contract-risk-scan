from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.services.clause_segmentation import ClauseSegment
from app.services.contract_analysis import canonicalize_role
from app.services.text_normalization import normalize_contract_text


@dataclass(slots=True)
class ObligationSignature:
    actor: str
    obligation_type: str
    timeline_days: int | None
    clause_id: str
    clause_text: str
    conditions: list[str] = field(default_factory=list)


@dataclass(slots=True)
class AsymmetrySignal:
    risk_id: str
    clause_id: str | None
    summary: str
    details: str
    severity_hint: str
    affected_roles: list[str]


class AsymmetryDetector:
    _ACTOR_PATTERNS: dict[str, tuple[str, ...]] = {
        "executor": ("исполнитель", "подрядчик", "поставщик", "seller", "vendor", "contractor", "executor"),
        "client": ("заказчик", "покупатель", "customer", "buyer", "client"),
        "worker": ("работник", "сотрудник", "гражданин", "employee", "worker"),
        "employer": ("работодатель", "employer"),
        "tenant": ("арендатор", "tenant", "lessee"),
        "landlord": ("арендодатель", "landlord", "lessor"),
    }

    _OBLIGATION_PATTERNS: dict[str, tuple[str, ...]] = {
        "pay": ("оплат", "плат", "перечисл", "invoice", "pay"),
        "perform": ("выполн", "оказ", "предостав", "осво", "perform"),
        "deliver": ("постав", "достав", "переда", "deliver", "ship"),
        "accept": ("прин", "приемк", "accept"),
        "terminate": ("расторг", "отказ", "terminate"),
        "support": ("гарант", "исправ", "поддерж", "support"),
    }

    def detect_asymmetries(self, clauses: list[ClauseSegment]) -> list[AsymmetrySignal]:
        obligations = self._extract_obligations(clauses)
        return self._find_asymmetries(obligations, clauses)

    def _extract_obligations(self, clauses: list[ClauseSegment]) -> list[ObligationSignature]:
        obligations: list[ObligationSignature] = []
        for clause in clauses:
            normalized = normalize_contract_text(clause.text).casefold()
            actor = self._detect_actor(normalized)
            obligation_type = self._detect_obligation_type(normalized)
            if not actor or not obligation_type:
                continue
            obligations.append(
                ObligationSignature(
                    actor=actor,
                    obligation_type=obligation_type,
                    timeline_days=self._extract_timeline_days(normalized),
                    clause_id=clause.clause_id,
                    clause_text=normalize_contract_text(clause.text),
                    conditions=self._extract_conditions(normalized),
                )
            )
        return obligations

    def _find_asymmetries(
        self,
        obligations: list[ObligationSignature],
        clauses: list[ClauseSegment],
    ) -> list[AsymmetrySignal]:
        signals: list[AsymmetrySignal] = []
        payers = [item for item in obligations if item.obligation_type == "pay"]
        performers = [item for item in obligations if item.obligation_type in {"perform", "deliver"}]
        terminations = [item for item in obligations if item.obligation_type == "terminate"]

        for performer in performers:
            for payer in payers:
                if performer.actor == payer.actor:
                    continue
                pay_delay = payer.timeline_days or 0
                perform_delay = performer.timeline_days or 0
                if pay_delay >= max(15, perform_delay + 10):
                    signals.append(
                        AsymmetrySignal(
                            risk_id="payment_asymmetry",
                            clause_id=performer.clause_id,
                            summary="Исполнение начинается существенно раньше оплаты.",
                            details=(
                                f"{performer.actor} обязан исполнить условие в срок {perform_delay or 0} дн., "
                                f"тогда как {payer.actor} платит через {pay_delay} дн."
                            ),
                            severity_hint="high",
                            affected_roles=[performer.actor],
                        )
                    )

        unilateral_markers = ("вправе в одностороннем порядке", "может в одностороннем порядке", "unilaterally")
        actors_with_unilateral_rights = {
            item.actor
            for item in terminations
            if any(marker in item.clause_text.casefold() for marker in unilateral_markers)
        }
        if len(actors_with_unilateral_rights) == 1 and terminations:
            actor = next(iter(actors_with_unilateral_rights))
            source = next(item for item in terminations if item.actor == actor)
            signals.append(
                AsymmetrySignal(
                    risk_id="termination_asymmetry",
                    clause_id=source.clause_id,
                    summary="Право на одностороннее расторжение дано только одной стороне.",
                    details=source.clause_text,
                    severity_hint="critical",
                    affected_roles=[role for role in self._ACTOR_PATTERNS if role != actor],
                )
            )

        clauses_by_text = [normalize_contract_text(clause.text).casefold() for clause in clauses]
        has_acceptance = any("приемк" in clause_text or "accept" in clause_text for clause_text in clauses_by_text)
        has_objective_criteria = any(
            "чек-лист" in clause_text
            or "техническ" in clause_text
            or "метрик" in clause_text
            or "критери" in clause_text
            for clause_text in clauses_by_text
        )
        if has_acceptance and not has_objective_criteria:
            source_clause = next((clause for clause in clauses if "прием" in clause.text.casefold()), None)
            signals.append(
                AsymmetrySignal(
                    risk_id="undefined_acceptance_criteria",
                    clause_id=source_clause.clause_id if source_clause else None,
                    summary="Приемка предусмотрена без объективных критериев результата.",
                    details=normalize_contract_text(source_clause.text) if source_clause else "",
                    severity_hint="medium",
                    affected_roles=["executor", "client"],
                )
            )

        return self._dedupe(signals)

    def _detect_actor(self, clause_text: str) -> str | None:
        for canonical_role, markers in self._ACTOR_PATTERNS.items():
            if any(marker in clause_text for marker in markers):
                return canonicalize_role(canonical_role)
        return None

    def _detect_obligation_type(self, clause_text: str) -> str | None:
        for obligation_type, markers in self._OBLIGATION_PATTERNS.items():
            if any(marker in clause_text for marker in markers):
                return obligation_type
        return None

    @staticmethod
    def _extract_timeline_days(clause_text: str) -> int | None:
        if any(marker in clause_text for marker in ("немедленно", "незамедлительно", "immediately")):
            return 0

        match = re.search(r"(\d{1,3})\s*(?:рабоч|календар|банков|дн|days?)", clause_text)
        if not match:
            return None
        return int(match.group(1))

    @staticmethod
    def _extract_conditions(clause_text: str) -> list[str]:
        conditions = []
        if "по согласованию" in clause_text:
            conditions.append("по согласованию сторон")
        if "при отсутствии" in clause_text:
            conditions.append("при отсутствии специальных исключений")
        if "после подписания" in clause_text:
            conditions.append("после подписания акта/документа")
        return conditions

    @staticmethod
    def _dedupe(signals: list[AsymmetrySignal]) -> list[AsymmetrySignal]:
        deduped: list[AsymmetrySignal] = []
        seen: set[tuple[str, str | None]] = set()
        for signal in signals:
            key = (signal.risk_id, signal.clause_id)
            if key in seen:
                continue
            seen.add(key)
            deduped.append(signal)
        return deduped

