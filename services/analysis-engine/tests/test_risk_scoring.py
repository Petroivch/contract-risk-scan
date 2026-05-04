from app.services.clause_segmentation import ClauseSegment
from app.services.risk_scoring import RiskScoringService


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


def test_payment_sanctions_are_detected_with_hybrid_guardrail() -> None:
    scorer = RiskScoringService()
    clauses = [
        ClauseSegment(
            clause_id="clause-1",
            text="Contractor pays a 10% penalty for each day of delay and must also compensate full damages.",
        )
    ]

    risks = scorer.score(
        clauses=clauses,
        role="Contractor",
        language="en",
        contract_type="service_agreement",
    )

    sanction_risks = {
        risk.rule_id: risk
        for risk in risks
        if risk.rule_id in {"one_sided_penalty", "uncapped_daily_penalty", "penalty_plus_full_damages"}
    }

    assert {"one_sided_penalty", "uncapped_daily_penalty", "penalty_plus_full_damages"} <= set(sanction_risks)
    assert all(risk.severity.value in {"high", "critical"} for risk in sanction_risks.values())
    assert any(
        risk.explanation and "payment_sanction_guardrail" in risk.explanation.guardrails
        for risk in sanction_risks.values()
    )


def test_semantic_retrieval_requires_rule_specific_anchor_terms() -> None:
    scorer = RiskScoringService()
    clauses = [
        ClauseSegment(
            clause_id="clause-1",
            text="Customer may unilaterally change the price, deadlines and scope of services without Contractor approval.",
        )
    ]

    risks = scorer.score(
        clauses=clauses,
        role="Customer",
        language="en",
        contract_type="service_agreement",
    )

    assert any(risk.rule_id == "unilateral_price_change" for risk in risks)
    assert all(risk.rule_id != "salary_reduction_unilateral" for risk in risks)
    assert all(risk.rule_id != "unlimited_liability" for risk in risks)
