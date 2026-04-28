from app.services.clause_segmentation import ClauseSegment
from app.services.risk_scoring import RiskScoringService


def test_unilateral_scope_change_is_more_severe_for_contractor() -> None:
    scorer = RiskScoringService()
    clauses = [
        ClauseSegment(
            clause_id="clause-1",
            text="Customer may unilaterally change the price, deadlines and scope of services without Contractor approval.",
        )
    ]

    contractor_risks = scorer.score(
        clauses,
        role="Contractor",
        language="en",
        contract_type="service_agreement",
    )
    customer_risks = scorer.score(
        clauses,
        role="Customer",
        language="en",
        contract_type="service_agreement",
    )

    contractor_risk = next(risk for risk in contractor_risks if "scope" in risk.description.lower())
    customer_risk = next(risk for risk in customer_risks if "цены" in risk.description.lower() or "price" in risk.description.lower())

    assert contractor_risk.severity.value == "critical"
    assert customer_risk.severity.value != contractor_risk.severity.value
    assert all("спецификации" not in risk.title.casefold() for risk in customer_risks)


def test_targeted_education_reimbursement_escalates_for_citizen() -> None:
    scorer = RiskScoringService()
    clauses = [
        ClauseSegment(
            clause_id="clause-1",
            text=(
                "Гражданин обязан вернуть меры поддержки и возместить расходы при расторжении договора "
                "или неисполнении обязанности отработать после завершения обучения."
            ),
        )
    ]

    citizen_risks = scorer.score(
        clauses,
        role="worker",
        language="en",
        contract_type="targeted_education_agreement",
    )
    customer_risks = scorer.score(
        clauses,
        role="client",
        language="en",
        contract_type="targeted_education_agreement",
    )

    citizen_risk = next(risk for risk in citizen_risks if "меры поддержки" in risk.description.casefold())

    assert citizen_risk.severity.value == "critical"
    assert not any("меры поддержки" in risk.description.casefold() for risk in customer_risks)
