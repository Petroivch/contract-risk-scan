import re

from app.schemas.analysis import DisputedClauseItem, RiskItem, RiskSeverity
from app.services.clause_segmentation import ClauseSegment
from app.services.contract_brief import ContractBriefGenerationService
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
    assert disputed[0].text
    assert disputed[0].rule_id
    assert disputed[0].offset.start == 0
    assert disputed[0].offset.end > disputed[0].offset.start
    assert disputed[0].provenance.offset.start >= disputed[0].offset.start
    assert disputed[0].provenance.offset.end >= disputed[0].provenance.offset.start
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


def test_role_focused_summary_records_use_structured_russian_format() -> None:
    service = SummaryGenerationService()
    clauses = [
        ClauseSegment(clause_id="clause-1", text="Contractor must deliver the report within 5 business days."),
        ClauseSegment(clause_id="clause-2", text="Customer may change the scope at its sole discretion."),
        ClauseSegment(clause_id="clause-3", text="Customer pays the invoice within 15 days."),
    ]
    risks = [
        RiskItem(
            risk_id="risk-1",
            title="Critical risk: Scope discretion",
            severity=RiskSeverity.CRITICAL,
            clause_id="clause-2",
            description="Counterparty may change the scope unilaterally.",
            role_relevance="This risk directly affects the contractor.",
            mitigation="Limit unilateral scope changes in writing.",
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

    records = service.generate_records(summary, len(clauses), risks)

    assert records
    assert records[0].id == "role-summary-overview"
    assert any(record.id.startswith("role-summary-must-do-") for record in records)
    for record in records:
        assert record.headline.endswith(".")
        assert record.description.endswith(".")
        assert record.recommendation.endswith(".")
        assert record.recommendation.startswith("\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435")
        assert re.search(r"[\u0400-\u04FF]", record.headline)
        assert re.search(r"[\u0400-\u04FF]", record.description)
        assert re.search(r"[\u0400-\u04FF]", record.recommendation)
        assert isinstance(record.evidence, list)


def test_contract_brief_records_use_structured_schema_and_wrapped_evidence() -> None:
    service = ContractBriefGenerationService()
    clauses = [
        ClauseSegment(clause_id="clause-1", text="Contractor must maintain a support desk 24/7."),
        ClauseSegment(clause_id="clause-2", text="Customer pays within 10 business days."),
        ClauseSegment(clause_id="clause-3", text="Penalty 1% applies for delayed delivery."),
    ]
    disputed_clauses = [
        DisputedClauseItem(
            clause_id="clause-4",
            clause_excerpt="Customer may interpret service quality at its sole discretion.",
            dispute_reason="Quality criteria are discretionary.",
            possible_consequence="The contractor may face subjective acceptance disputes.",
            confidence=0.76,
        )
    ]

    records = service.generate_records(
        document_name="services.txt",
        document_text="\n".join(clause.text for clause in clauses),
        clauses=clauses,
        role="Contractor",
        counterparty_role="Customer",
        language="en",
        disputed_clauses=disputed_clauses,
    )

    assert records
    assert records[0].id == "contract-brief-intro"
    assert any(record.id.startswith("contract-brief-role-obligations-") for record in records)
    assert any(record.id == "contract-brief-disputed-clauses" for record in records)
    for record in records:
        assert record.headline.endswith(".")
        assert record.description.endswith(".")
        assert record.recommendation.endswith(".")
        assert record.recommendation.startswith("\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435")
        for evidence in record.evidence:
            assert evidence.endswith(".")
            assert evidence.startswith("\u0424\u0440\u0430\u0433\u043c\u0435\u043d\u0442")
