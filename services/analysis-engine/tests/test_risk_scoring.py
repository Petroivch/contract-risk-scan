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
