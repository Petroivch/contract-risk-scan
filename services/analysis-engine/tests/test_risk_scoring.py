import json
import re
from pathlib import Path

from app.services.clause_segmentation import ClauseSegment
from app.services.risk_scoring import RiskScoringService

CYRILLIC_RE = re.compile(r"[\u0400-\u04FF]")


def _risk_by_rule_id(risks, rule_id: str):
    return next((risk for risk in risks if risk.rule_id == rule_id), None)


def test_contract_type_filter_keeps_service_only_rule_scoped() -> None:
    scorer = RiskScoringService()
    clauses = [
        ClauseSegment(
            clause_id="clause-1",
            text=(
                "Исполнитель оказывает услуги, а Заказчик оплачивает их через 45 банковских дней "
                "после подписания акта оказанных услуг."
            ),
        )
    ]

    service_risks = scorer.score(
        clauses=clauses,
        role="исполнитель",
        language="ru",
        contract_type="service_agreement",
    )
    lease_risks = scorer.score(
        clauses=clauses,
        role="исполнитель",
        language="ru",
        contract_type="lease_agreement",
    )

    service_risk = next(risk for risk in service_risks if risk.rule_id == "payment_asymmetry")

    assert service_risk.severity.value == "critical"
    assert all(risk.rule_id != "payment_asymmetry" for risk in lease_risks)


def test_missing_contract_type_preserves_backward_compatible_rule_matching() -> None:
    scorer = RiskScoringService()
    clauses = [
        ClauseSegment(
            clause_id="clause-1",
            text=(
                "Исполнитель оказывает услуги, а Заказчик оплачивает их через 45 банковских дней "
                "после подписания акта оказанных услуг."
            ),
        )
    ]

    generic_risks = scorer.score(
        clauses=clauses,
        role="исполнитель",
        language="ru",
        contract_type=None,
    )

    assert any(risk.rule_id == "payment_asymmetry" for risk in generic_risks)


def test_role_mismatch_keeps_generic_risk_candidates() -> None:
    scorer = RiskScoringService()
    clauses = [
        ClauseSegment(
            clause_id="clause-1",
            text="Seller shall deliver the goods within 5 days.",
        ),
        ClauseSegment(
            clause_id="clause-2",
            text="Buyer must pay the invoice within 10 days.",
        ),
        ClauseSegment(
            clause_id="clause-3",
            text="Penalty 1% applies for delay.",
        ),
    ]

    risks = scorer.score(
        clauses=clauses,
        role="Finance reviewer",
        language="en",
        contract_type=None,
        document_text="\n".join(clause.text for clause in clauses),
        counterparty_role="Seller",
    )

    assert risks
    assert any(risk.rule_id == "payment_asymmetry" for risk in risks)
    assert any(risk.explanation and risk.explanation.classifier_score >= 0.45 for risk in risks)


def test_hybrid_core_detects_payment_sanctions_with_structured_explanations() -> None:
    scorer = RiskScoringService()
    clauses = [
        ClauseSegment(clause_id="clause-1", text="Contractor shall deliver the report within 5 days."),
        ClauseSegment(
            clause_id="clause-2",
            text="Contractor pays a fine of 5% for each day of delayed delivery.",
        ),
    ]

    risks = scorer.score(
        clauses=clauses,
        role="Contractor",
        language="en",
        contract_type=None,
        document_text="\n".join(clause.text for clause in clauses),
        counterparty_role="Customer",
    )

    penalty_risk = _risk_by_rule_id(risks, "uncapped_daily_penalty")
    one_sided_risk = _risk_by_rule_id(risks, "one_sided_penalty")

    assert penalty_risk is not None
    assert one_sided_risk is not None
    assert penalty_risk.severity.value == "critical"
    assert penalty_risk.explanation is not None
    assert penalty_risk.explanation.summary.endswith(".")
    assert penalty_risk.explanation.retrieval_score > 0
    assert penalty_risk.explanation.classifier_score >= 0.45
    assert "payment_sanction_guardrail" in penalty_risk.explanation.guardrails
    assert any(
        guardrail in penalty_risk.explanation.guardrails
        for guardrail in ("semantic_embedding_retrieval", "regex_guardrail")
    )
    assert penalty_risk.description.endswith(".")
    assert penalty_risk.role_relevance.endswith(".")
    assert penalty_risk.mitigation.endswith(".")


def test_role_choice_changes_unilateral_scope_result() -> None:
    scorer = RiskScoringService()
    clauses = [
        ClauseSegment(clause_id="clause-1", text="Contractor shall provide support services."),
        ClauseSegment(
            clause_id="clause-2",
            text="Customer may unilaterally change the price, deadlines and scope without Contractor approval.",
        ),
        ClauseSegment(clause_id="clause-3", text="Contractor pays a 10% penalty for each day of delay."),
    ]
    document_text = "\n".join(clause.text for clause in clauses)

    contractor_risks = scorer.score(
        clauses=clauses,
        role="Contractor",
        language="en",
        contract_type=None,
        document_text=document_text,
        counterparty_role="Customer",
    )
    customer_risks = scorer.score(
        clauses=clauses,
        role="Customer",
        language="en",
        contract_type=None,
        document_text=document_text,
        counterparty_role="Contractor",
    )

    contractor_scope = _risk_by_rule_id(contractor_risks, "unilateral_scope_change")
    customer_scope = _risk_by_rule_id(customer_risks, "unilateral_scope_change")
    customer_price = _risk_by_rule_id(customer_risks, "unilateral_price_change")

    assert contractor_scope is not None
    assert contractor_scope.severity.value == "critical"
    assert customer_scope is None
    assert customer_price is not None
    assert customer_price.severity.value == "high"


def test_disputed_or_ambiguous_clause_is_surfaced_with_evidence() -> None:
    scorer = RiskScoringService()
    clauses = [
        ClauseSegment(
            clause_id="clause-1",
            text="Customer may determine acceptance at its sole discretion without objective quality criteria.",
        )
    ]

    disputed = scorer.extract_disputed_clauses(clauses, language="en")

    assert disputed
    assert disputed[0].clause_id == "clause-1"
    assert disputed[0].text.endswith(".")
    assert disputed[0].clause_excerpt.endswith(".")
    assert disputed[0].provenance.text
    assert disputed[0].provenance.offset.end > disputed[0].provenance.offset.start


def test_non_russian_risk_fields_do_not_leak_cyrillic_outside_quotes() -> None:
    scorer = RiskScoringService()
    clauses = [
        ClauseSegment(clause_id="clause-1", text="Contractor shall deliver the report within 5 days."),
        ClauseSegment(clause_id="clause-2", text="Contractor pays a 10% penalty for each day of delay."),
    ]

    risks = scorer.score(
        clauses=clauses,
        role="Contractor",
        language="en",
        contract_type=None,
        document_text="\n".join(clause.text for clause in clauses),
        counterparty_role="Customer",
    )

    assert risks
    for risk in risks:
        checked_fields = [
            risk.title,
            risk.description,
            risk.role_relevance,
            risk.mitigation,
            risk.explanation.summary if risk.explanation else "",
        ]
        assert not CYRILLIC_RE.search(" ".join(checked_fields))


def test_non_russian_localized_config_fields_do_not_leak_cyrillic() -> None:
    config_path = Path(__file__).resolve().parents[1] / "app" / "config" / "analysis_config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    leaks: list[str] = []

    def visit(node, path: tuple[str, ...] = ()) -> None:
        if isinstance(node, dict):
            for language in ("en", "it", "fr"):
                value = node.get(language)
                if isinstance(value, str) and CYRILLIC_RE.search(value):
                    leaks.append(".".join((*path, language)))
            for key, value in node.items():
                visit(value, (*path, str(key)))
        elif isinstance(node, list):
            for index, value in enumerate(node):
                visit(value, (*path, str(index)))

    visit(config)

    assert leaks == []
