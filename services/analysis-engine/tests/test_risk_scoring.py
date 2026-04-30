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
