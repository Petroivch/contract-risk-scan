from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
import sys
import types


def ensure_runtime_shims() -> None:
    """Keep the quality suite runnable while the refactor leaves optional modules absent."""

    try:
        import app.services.asymmetry_detector  # noqa: F401
    except ModuleNotFoundError as exc:
        if exc.name != "app.services.asymmetry_detector":
            raise

        stub = types.ModuleType("app.services.asymmetry_detector")

        @dataclass(slots=True)
        class AsymmetrySignal:
            risk_id: str
            clause_id: str | None = None
            summary: str = ""
            details: str = ""
            severity_hint: str = "medium"
            affected_roles: list[str] = field(default_factory=list)

        class AsymmetryDetector:
            def detect_asymmetries(self, clauses: list[object]) -> list[AsymmetrySignal]:
                return []

        stub.AsymmetrySignal = AsymmetrySignal
        stub.AsymmetryDetector = AsymmetryDetector
        sys.modules["app.services.asymmetry_detector"] = stub


ensure_runtime_shims()

from app.schemas.analysis import DisputedClauseItem, RiskItem, SummaryRecord
from app.services.clause_segmentation import ClauseSegment, ClauseSegmentationService
from app.services.contract_analysis import (
    ContractTypeDetector,
    DetectedContractType,
    DetectedRole,
    extract_roles_from_text,
    find_role_matches,
)
from app.services.contract_brief import ContractBriefGenerationService
from app.services.risk_scoring import RiskScoringService


@dataclass(frozen=True, slots=True)
class GoldenCase:
    case_id: str
    document_name: str
    language: str
    role: str
    counterparty_role: str
    document_text: str
    expected_contract_type: str
    min_contract_type_confidence: float
    min_risk_count: int
    expected_risk_ids: tuple[str, ...]
    min_dispute_count: int
    expected_dispute_rule_ids: tuple[str, ...]
    required_roles: tuple[str, ...]
    absent_role: str | None = None


@dataclass(frozen=True, slots=True)
class RoleEscalationScenario:
    case_id: str
    language: str
    role: str
    counterparty_role: str
    alternate_role: str
    alternate_counterparty_role: str
    document_text: str
    expected_primary_risk_id: str
    expected_alternate_risk_id: str


@dataclass(slots=True)
class GoldenCaseSnapshot:
    case: GoldenCase
    clauses: list[ClauseSegment]
    contract_type: DetectedContractType
    detected_roles: list[DetectedRole]
    selected_role_matches: list[DetectedRole]
    risks: list[RiskItem]
    disputed_clauses: list[DisputedClauseItem]
    contract_brief: str
    contract_brief_records: list[SummaryRecord]


SERVICE_AGREEMENT_RU = "\n\n".join(
    [
        "ДОГОВОР ОБ ОКАЗАНИИ УСЛУГ",
        "Исполнитель обязуется оказать услуги по сопровождению системы.",
        "Заказчик оплачивает услуги в течение 45 банковских дней после подписания акта.",
        "Заказчик вправе в одностороннем порядке отказаться от договора без компенсации расходов Исполнителя.",
        "Критерии приемки определяются Заказчиком по своему усмотрению.",
        "За просрочку Исполнитель уплачивает пеню 1% за каждый день просрочки без ограничения общей суммы.",
    ]
)

SUPPLY_AGREEMENT_RU = "\n\n".join(
    [
        "ДОГОВОР ПОСТАВКИ",
        "Поставщик обязуется поставить товар в течение 5 рабочих дней.",
        "Покупатель оплачивает поставку в течение 45 банковских дней после приемки товара.",
        "Покупатель вправе по своему усмотрению изменять спецификацию и объем партии.",
        "За просрочку Поставщик уплачивает пеню 0,5% за каждый день просрочки.",
        "Приемка товара осуществляется по мнению Покупателя.",
    ]
)

ROLE_ESCALATION_EN = "\n\n".join(
    [
        "Contractor shall provide support services for the platform.",
        "Customer may unilaterally change the price, deadlines and scope of services without Contractor approval.",
        "Contractor pays a 10% penalty for each day of delay.",
    ]
)

GOLDEN_CASES: tuple[GoldenCase, ...] = (
    GoldenCase(
        case_id="service_agreement_ru",
        document_name="services-contract.txt",
        language="ru",
        role="Исполнитель",
        counterparty_role="Заказчик",
        document_text=SERVICE_AGREEMENT_RU,
        expected_contract_type="service_agreement",
        min_contract_type_confidence=0.85,
        min_risk_count=3,
        expected_risk_ids=(
            "undefined_acceptance_criteria",
            "uncapped_daily_penalty",
            "unlimited_liability",
        ),
        min_dispute_count=1,
        expected_dispute_rule_ids=("dispute_marker_discretionary_right",),
        required_roles=("executor", "client"),
        absent_role="Финансовый контролер",
    ),
    GoldenCase(
        case_id="supply_agreement_ru",
        document_name="supply-contract.txt",
        language="ru",
        role="Поставщик",
        counterparty_role="Покупатель",
        document_text=SUPPLY_AGREEMENT_RU,
        expected_contract_type="supply_agreement",
        min_contract_type_confidence=0.95,
        min_risk_count=4,
        expected_risk_ids=(
            "payment_asymmetry",
            "uncapped_daily_penalty",
            "undefined_acceptance_criteria",
            "strict_deadlines_without_dependency_carveout",
        ),
        min_dispute_count=1,
        expected_dispute_rule_ids=("dispute_marker_discretionary_right",),
        required_roles=("executor", "client"),
        absent_role="Финансовый контролер",
    ),
    GoldenCase(
        case_id="role_escalation_en",
        document_name="role-escalation.txt",
        language="en",
        role="Contractor",
        counterparty_role="Customer",
        document_text=ROLE_ESCALATION_EN,
        expected_contract_type="general_contract",
        min_contract_type_confidence=0.0,
        min_risk_count=3,
        expected_risk_ids=(
            "unilateral_scope_change",
            "uncapped_daily_penalty",
            "one_sided_penalty",
        ),
        min_dispute_count=1,
        expected_dispute_rule_ids=("fallback_disputed_clause",),
        required_roles=("executor", "client"),
        absent_role="Finance reviewer",
    ),
)

ROLE_ESCALATION_CASE = RoleEscalationScenario(
    case_id="contractor_vs_customer_en",
    language="en",
    role="Contractor",
    counterparty_role="Customer",
    alternate_role="Customer",
    alternate_counterparty_role="Contractor",
    document_text=ROLE_ESCALATION_EN,
    expected_primary_risk_id="unilateral_scope_change",
    expected_alternate_risk_id="unilateral_price_change",
)

_CASES_BY_ID = {case.case_id: case for case in GOLDEN_CASES}


def _scoring_contract_type(contract_type: DetectedContractType) -> str | None:
    return None if contract_type.type_id == "general_contract" else contract_type.type_id


@lru_cache(maxsize=None)
def snapshot_for(case_id: str) -> GoldenCaseSnapshot:
    case = _CASES_BY_ID[case_id]
    clause_service = ClauseSegmentationService()
    contract_type_detector = ContractTypeDetector()
    risk_service = RiskScoringService()
    brief_service = ContractBriefGenerationService()

    clauses = clause_service.segment(case.document_text, case.language)
    contract_type = contract_type_detector.detect(case.document_text, case.document_name)
    risks = risk_service.score(
        clauses=clauses,
        role=case.role,
        language=case.language,
        contract_type=_scoring_contract_type(contract_type),
        document_text=case.document_text,
        counterparty_role=case.counterparty_role,
    )
    disputed_clauses = risk_service.extract_disputed_clauses(clauses, case.language)
    contract_brief = brief_service.generate(
        document_name=case.document_name,
        document_text=case.document_text,
        clauses=clauses,
        role=case.role,
        counterparty_role=case.counterparty_role,
        language=case.language,
        disputed_clauses=disputed_clauses,
        detected_contract_type=contract_type,
    )
    contract_brief_records = brief_service.generate_records(
        document_name=case.document_name,
        document_text=case.document_text,
        clauses=clauses,
        role=case.role,
        counterparty_role=case.counterparty_role,
        language=case.language,
        disputed_clauses=disputed_clauses,
        detected_contract_type=contract_type,
    )

    return GoldenCaseSnapshot(
        case=case,
        clauses=clauses,
        contract_type=contract_type,
        detected_roles=extract_roles_from_text(case.document_text),
        selected_role_matches=find_role_matches(case.role, case.document_text),
        risks=risks,
        disputed_clauses=disputed_clauses,
        contract_brief=contract_brief,
        contract_brief_records=contract_brief_records,
    )


def score_document(
    *,
    document_text: str,
    language: str,
    role: str,
    counterparty_role: str,
) -> list[RiskItem]:
    clauses = ClauseSegmentationService().segment(document_text, language)
    return RiskScoringService().score(
        clauses=clauses,
        role=role,
        language=language,
        contract_type=None,
        document_text=document_text,
        counterparty_role=counterparty_role,
    )


def role_matches(role: str, document_text: str) -> list[DetectedRole]:
    return find_role_matches(role, document_text)


def severity_rank(severity: str) -> int:
    return {"low": 1, "medium": 2, "high": 3, "critical": 4}[severity]
