from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.clause_segmentation import ClauseSegment
from app.services.contract_analysis import canonicalize_role
from app.services.text_normalization import normalize_contract_text


@dataclass(slots=True, frozen=True)
class DetectorConfig:
    actor_patterns: dict[str, tuple[str, ...]]
    actor_labels: dict[str, str]
    obligation_patterns: dict[str, tuple[str, ...]]
    unilateral_markers: tuple[str, ...]
    acceptance_markers: tuple[str, ...]
    objective_acceptance_markers: tuple[str, ...]
    liability_cap_markers: tuple[str, ...]
    liability_unlimited_markers: tuple[str, ...]
    scope_change_markers: tuple[str, ...]
    mandatory_scope_markers: tuple[str, ...]
    payment_floor_days: int
    payment_gap_days: int


DEFAULT_DETECTOR_CONFIG = DetectorConfig(
    actor_patterns={
        "executor": (
            "исполнитель",
            "подрядчик",
            "поставщик",
            "продавец",
            "agent",
            "contractor",
            "executor",
            "seller",
            "supplier",
            "vendor",
        ),
        "client": (
            "заказчик",
            "покупатель",
            "комитент",
            "принципал",
            "principal",
            "buyer",
            "client",
            "customer",
        ),
        "worker": ("работник", "сотрудник", "employee", "worker"),
        "employer": ("работодатель", "employer"),
        "tenant": ("арендатор", "lessee", "tenant"),
        "landlord": ("арендодатель", "landlord", "lessor"),
        "borrower": ("заемщик", "должник", "borrower"),
        "lender": ("займодавец", "кредитор", "lender"),
    },
    actor_labels={
        "borrower": "заемщик",
        "client": "заказчик",
        "employer": "работодатель",
        "executor": "исполнитель",
        "landlord": "арендодатель",
        "lender": "кредитор",
        "tenant": "арендатор",
        "worker": "работник",
    },
    obligation_patterns={
        "accept": ("accept", "approval", "приемк", "принят"),
        "deliver": ("deliver", "shipment", "ship", "достав", "переда", "постав"),
        "liability": (
            "indemnif",
            "liable",
            "liability",
            "damages",
            "losses",
            "penalt",
            "ответствен",
            "убытк",
            "неустойк",
            "штраф",
            "возмещ",
        ),
        "pay": ("pay", "payment", "invoice", "fee", "оплат", "плат", "вознагражден", "счет"),
        "perform": (
            "perform",
            "provide",
            "render",
            "support",
            "service",
            "выполн",
            "оказ",
            "предостав",
            "сопровож",
            "обеспеч",
        ),
        "scope": (
            "scope",
            "specification",
            "deliverable",
            "requirements",
            "schedule",
            "volume",
            "объем",
            "спецификац",
            "техническ",
            "требован",
            "график",
            "срок",
        ),
        "terminate": (
            "terminate",
            "termination",
            "cancel",
            "withdraw",
            "расторг",
            "отказ",
            "прекращ",
        ),
    },
    unilateral_markers=(
        "at its sole discretion",
        "at sole discretion",
        "unilaterally",
        "without prior consent",
        "sole discretion",
        "в одностороннем порядке",
        "без согласования другой стороны",
        "по своему усмотрению",
    ),
    acceptance_markers=(
        "after acceptance",
        "after approval",
        "upon acceptance",
        "upon approval",
        "после приемки",
        "после подписания акта",
        "после подписания акта приема",
    ),
    objective_acceptance_markers=(
        "acceptance criteria",
        "checklist",
        "service level",
        "sla",
        "specification",
        "technical assignment",
        "criteria",
        "metric",
        "чек-лист",
        "критери",
        "метрик",
        "sla",
        "техническ",
        "приложени",
    ),
    liability_cap_markers=(
        "aggregate liability",
        "capped at",
        "limited to",
        "maximum liability",
        "не более",
        "не превышает",
        "ограничивается",
        "в пределах",
    ),
    liability_unlimited_markers=(
        "all losses",
        "full liability",
        "indemnify all losses",
        "unlimited liability",
        "без ограничения",
        "в полном объеме",
        "полностью возмещает",
        "все убытки",
    ),
    scope_change_markers=(
        "adjust the schedule",
        "change requirements",
        "change the scope",
        "change specifications",
        "modify the scope",
        "replace deliverables",
        "revise requirements",
        "изменять объем",
        "изменить объем",
        "изменять требования",
        "изменять техническое задание",
        "менять объем",
        "корректировать график",
        "менять спецификацию",
    ),
    mandatory_scope_markers=(
        "at its own expense",
        "must implement",
        "shall comply",
        "without additional payment",
        "без дополнительной оплаты",
        "за свой счет",
        "обязан выполнить",
        "обязан внедрить",
        "обязан обеспечить",
    ),
    payment_floor_days=15,
    payment_gap_days=10,
)


@dataclass(slots=True)
class ClauseSignature:
    actor: str | None
    actors: list[str]
    clause_id: str
    clause_text: str
    obligation_types: set[str]
    timeline_days: int | None
    unilateral_right: bool
    mentions_acceptance: bool
    has_objective_acceptance_criteria: bool
    liability_capped: bool
    liability_unlimited: bool
    scope_change: bool
    mandatory_scope_change: bool


@dataclass(slots=True)
class AsymmetrySignal:
    risk_id: str
    clause_id: str | None
    summary: str
    details: str
    severity_hint: str
    affected_roles: list[str]


class AsymmetryDetector:
    def __init__(self, config: DetectorConfig | None = None) -> None:
        self._config = config or DEFAULT_DETECTOR_CONFIG

    def detect_asymmetries(self, clauses: list[ClauseSegment]) -> list[AsymmetrySignal]:
        signatures = [self._build_signature(clause) for clause in clauses]
        signals: list[AsymmetrySignal] = []
        signals.extend(self._detect_payment_asymmetry(signatures))
        signals.extend(self._detect_termination_asymmetry(signatures))
        signals.extend(self._detect_liability_asymmetry(signatures))
        signals.extend(self._detect_scope_flexibility_asymmetry(signatures))
        signals.extend(self._detect_undefined_acceptance_criteria(signatures))
        return self._dedupe(signals)

    def _build_signature(self, clause: ClauseSegment) -> ClauseSignature:
        normalized_text = normalize_contract_text(clause.text)
        lowered_text = normalized_text.casefold()
        actors = self._detect_actors(lowered_text)
        obligation_types = self._detect_obligation_types(lowered_text)

        return ClauseSignature(
            actor=actors[0] if actors else None,
            actors=actors,
            clause_id=clause.clause_id,
            clause_text=normalized_text,
            obligation_types=obligation_types,
            timeline_days=self._extract_timeline_days(lowered_text),
            unilateral_right=self._matches_any(lowered_text, self._config.unilateral_markers),
            mentions_acceptance=self._matches_any(lowered_text, self._config.acceptance_markers)
            or "accept" in obligation_types,
            has_objective_acceptance_criteria=self._matches_any(
                lowered_text,
                self._config.objective_acceptance_markers,
            ),
            liability_capped=self._matches_any(lowered_text, self._config.liability_cap_markers),
            liability_unlimited=self._matches_any(lowered_text, self._config.liability_unlimited_markers),
            scope_change=self._matches_any(lowered_text, self._config.scope_change_markers),
            mandatory_scope_change=self._matches_any(lowered_text, self._config.mandatory_scope_markers),
        )

    def _detect_payment_asymmetry(self, signatures: list[ClauseSignature]) -> list[AsymmetrySignal]:
        payers = [
            signature
            for signature in signatures
            if signature.actor is not None and "pay" in signature.obligation_types
        ]
        performers = [
            signature
            for signature in signatures
            if signature.actor is not None and signature.obligation_types.intersection({"deliver", "perform"})
        ]

        signals: list[AsymmetrySignal] = []
        for performer in performers:
            performer_delay = performer.timeline_days or 0
            for payer in payers:
                if performer.actor == payer.actor or payer.timeline_days is None:
                    continue

                pay_delay = payer.timeline_days
                if pay_delay < max(self._config.payment_floor_days, performer_delay + self._config.payment_gap_days):
                    continue

                performer_label = self._role_label(performer.actor)
                payer_label = self._role_label(payer.actor)
                delay_details = (
                    f"{performer_label} должен исполнить обязательство за {performer_delay} дн., "
                    f"тогда как {payer_label} платит через {pay_delay} дн."
                )
                if payer.mentions_acceptance:
                    delay_details += " Оплата также поставлена в зависимость от приемки результата."

                signals.append(
                    AsymmetrySignal(
                        risk_id="payment_asymmetry",
                        clause_id=performer.clause_id,
                        summary="Исполнение начинается существенно раньше оплаты.",
                        details=delay_details,
                        severity_hint="high",
                        affected_roles=[performer.actor],
                    )
                )
        return signals

    def _detect_termination_asymmetry(self, signatures: list[ClauseSignature]) -> list[AsymmetrySignal]:
        termination_clauses = [
            signature
            for signature in signatures
            if signature.actor is not None and "terminate" in signature.obligation_types
        ]
        actors_with_unilateral_rights = {
            signature.actor for signature in termination_clauses if signature.unilateral_right and signature.actor
        }
        if len(actors_with_unilateral_rights) != 1:
            return []

        actor = next(iter(actors_with_unilateral_rights))
        source = next(
            signature
            for signature in termination_clauses
            if signature.actor == actor and signature.unilateral_right
        )
        return [
            AsymmetrySignal(
                risk_id="termination_asymmetry",
                clause_id=source.clause_id,
                summary="Право на одностороннее расторжение дано только одной стороне.",
                details=source.clause_text,
                severity_hint="critical",
                affected_roles=self._counterpart_roles(signatures, actor),
            )
        ]

    def _detect_liability_asymmetry(self, signatures: list[ClauseSignature]) -> list[AsymmetrySignal]:
        liability_clauses = [
            signature
            for signature in signatures
            if signature.actor is not None and "liability" in signature.obligation_types
        ]
        limited_by_actor = {
            signature.actor: signature
            for signature in liability_clauses
            if signature.actor is not None and signature.liability_capped
        }
        unlimited_by_actor = {
            signature.actor: signature
            for signature in liability_clauses
            if signature.actor is not None and signature.liability_unlimited
        }

        signals: list[AsymmetrySignal] = []
        for actor, source in unlimited_by_actor.items():
            counterpart_roles = [
                role for role in self._counterpart_roles(signatures, actor) if role in limited_by_actor
            ]
            if not counterpart_roles:
                continue

            limited_role = self._role_label(counterpart_roles[0])
            unlimited_role = self._role_label(actor)
            signals.append(
                AsymmetrySignal(
                    risk_id="liability_asymmetry",
                    clause_id=source.clause_id,
                    summary="Ответственность распределена несимметрично между сторонами.",
                    details=(
                        f"{unlimited_role} несет расширенную ответственность, "
                        f"тогда как ответственность стороны '{limited_role}' ограничена."
                    ),
                    severity_hint="high",
                    affected_roles=[actor],
                )
            )
        return signals

    def _detect_scope_flexibility_asymmetry(
        self,
        signatures: list[ClauseSignature],
    ) -> list[AsymmetrySignal]:
        signals: list[AsymmetrySignal] = []
        for signature in signatures:
            if signature.actor is None or "scope" not in signature.obligation_types:
                continue
            if not signature.scope_change:
                continue
            if not (signature.unilateral_right or signature.mandatory_scope_change):
                continue

            counterpart_roles = self._counterpart_roles(signatures, signature.actor)
            if not counterpart_roles:
                continue

            signals.append(
                AsymmetrySignal(
                    risk_id="scope_flexibility_asymmetry",
                    clause_id=signature.clause_id,
                    summary="Одна сторона может менять объем работ или требования без симметричных ограничений.",
                    details=signature.clause_text,
                    severity_hint="high",
                    affected_roles=counterpart_roles,
                )
            )
        return signals

    def _detect_undefined_acceptance_criteria(
        self,
        signatures: list[ClauseSignature],
    ) -> list[AsymmetrySignal]:
        has_acceptance = any(signature.mentions_acceptance for signature in signatures)
        has_objective_criteria = any(
            signature.has_objective_acceptance_criteria for signature in signatures
        )
        if not has_acceptance or has_objective_criteria:
            return []

        source_clause = next((signature for signature in signatures if signature.mentions_acceptance), None)
        return [
            AsymmetrySignal(
                risk_id="undefined_acceptance_criteria",
                clause_id=source_clause.clause_id if source_clause else None,
                summary="Приемка предусмотрена без объективных критериев результата.",
                details=source_clause.clause_text if source_clause else "",
                severity_hint="medium",
                affected_roles=["executor", "client"],
            )
        ]

    def _detect_actors(self, clause_text: str) -> list[str]:
        actor_positions: list[tuple[int, str]] = []
        for canonical_role, markers in self._config.actor_patterns.items():
            earliest_position: int | None = None
            for marker in markers:
                pattern = rf"(?<!\w){re.escape(marker.casefold())}(?!\w)"
                match = re.search(pattern, clause_text)
                if match is None:
                    continue
                if earliest_position is None or match.start() < earliest_position:
                    earliest_position = match.start()

            if earliest_position is not None:
                actor_positions.append((earliest_position, canonicalize_role(canonical_role)))

        actor_positions.sort(key=lambda item: (item[0], item[1]))
        return [actor for _, actor in actor_positions]

    def _detect_obligation_types(self, clause_text: str) -> set[str]:
        obligation_types: set[str] = set()
        for obligation_type, markers in self._config.obligation_patterns.items():
            if self._matches_any(clause_text, markers):
                obligation_types.add(obligation_type)
        return obligation_types

    @staticmethod
    def _extract_timeline_days(clause_text: str) -> int | None:
        if any(marker in clause_text for marker in ("немедленно", "незамедлительно", "immediately")):
            return 0

        match = re.search(
            r"(\d{1,3})\s*(?:business|calendar|working|banking|рабоч|календар|банков|дн|day)",
            clause_text,
        )
        if match is None:
            return None
        return int(match.group(1))

    @staticmethod
    def _matches_any(clause_text: str, markers: tuple[str, ...]) -> bool:
        return any(marker in clause_text for marker in markers)

    def _counterpart_roles(self, signatures: list[ClauseSignature], actor: str) -> list[str]:
        counterpart_roles = sorted(
            {
                matched_actor
                for signature in signatures
                for matched_actor in signature.actors
                if matched_actor != actor
            }
        )
        if counterpart_roles:
            return counterpart_roles

        return sorted(role for role in self._config.actor_patterns if role != actor)

    def _role_label(self, role: str) -> str:
        return self._config.actor_labels.get(role, role)

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
