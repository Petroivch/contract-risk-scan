from app.schemas.analysis import RiskItem, RiskSeverity
from app.services.clause_segmentation import ClauseSegment
from app.services.risk_scoring import RiskScoringService
from app.services.summary_generation import SummaryGenerationService


def test_disputed_clause_excerpt_keeps_sentence_boundary() -> None:
    scorer = RiskScoringService()
    clause = ClauseSegment(
        clause_id="clause-1",
        text=(
            "Стороны согласуют сроки по дополнительному соглашению сторон, при необходимости допускается "
            "продление в разумный срок, а критерии приемки определяются по мнению заказчика после тестирования."
        ),
    )

    disputed = scorer.extract_disputed_clauses([clause], language="ru")

    assert disputed
    assert disputed[0].clause_excerpt[-1] in ".!?"
    assert "заказчика" in disputed[0].clause_excerpt.casefold()


def test_summary_overview_ends_with_recommendation_for_high_risks() -> None:
    service = SummaryGenerationService()
    clauses = [
        ClauseSegment(clause_id="clause-1", text="Contractor must provide the service within 5 days."),
        ClauseSegment(clause_id="clause-2", text="Customer pays the invoice 45 days after acceptance."),
    ]
    risks = [
        RiskItem(
            risk_id="risk-1",
            title="Critical risk: Payment asymmetry",
            severity=RiskSeverity.CRITICAL,
            clause_id="clause-2",
            description="Payment is delayed after performance.",
            role_relevance="The contractor effectively finances the customer.",
            mitigation="Add an advance payment.",
        )
    ]

    summary = service.generate(
        document_text="\n".join(clause.text for clause in clauses),
        clauses=clauses,
        risks=risks,
        role="Contractor",
        counterparty_role="Customer",
        language="en",
    )

    assert summary.overview.endswith("should be reviewed manually.")
    assert any("45 days" in line for line in summary.payment_terms)
