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


def test_role_mismatch_returns_no_selected_role_risks() -> None:
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

    assert risks == []


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
        role="Contractor",
        language="en",
        contract_type="service_agreement",
        counterparty_role="Customer",
    )

    assert any(risk.rule_id == "unilateral_scope_change" for risk in risks)
    assert all(risk.rule_id != "salary_reduction_unilateral" for risk in risks)
    assert all(risk.rule_id != "unlimited_liability" for risk in risks)


def test_unilateral_rights_are_shown_only_for_affected_role() -> None:
    scorer = RiskScoringService()
    clauses = [
        ClauseSegment(
            clause_id="clause-1",
            text="Customer may unilaterally change the price, deadlines and scope of services without Contractor approval.",
        )
    ]

    contractor_risks = scorer.score(
        clauses=clauses,
        role="Contractor",
        language="en",
        contract_type="service_agreement",
        counterparty_role="Customer",
    )
    customer_risks = scorer.score(
        clauses=clauses,
        role="Customer",
        language="en",
        contract_type="service_agreement",
        counterparty_role="Contractor",
    )

    assert any(risk.rule_id == "unilateral_scope_change" for risk in contractor_risks)
    assert all(risk.rule_id != "unilateral_scope_change" for risk in customer_risks)


def test_english_risk_evidence_has_source_excerpt_and_offsets() -> None:
    scorer = RiskScoringService()
    text = "Contractor pays a 10% penalty for each day of delay and must compensate full damages."
    clauses = [ClauseSegment(clause_id="clause-1", text=text, offset=0, end_offset=len(text))]

    risks = scorer.score(
        clauses=clauses,
        role="Contractor",
        language="en",
        contract_type="service_agreement",
    )

    penalty_risk = next(risk for risk in risks if risk.rule_id == "one_sided_penalty")

    assert penalty_risk.evidence
    evidence = penalty_risk.evidence[0]
    assert evidence.source_excerpt
    assert evidence.offset.start >= 0
    assert evidence.offset.end > evidence.offset.start
    assert text[evidence.offset.start : evidence.offset.end] == evidence.source_excerpt
    assert penalty_risk.explanation is not None
    assert penalty_risk.explanation.source_offset == evidence.offset


def test_russian_risk_evidence_has_source_excerpt_and_offsets() -> None:
    scorer = RiskScoringService()
    text = (
        "\u0418\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c "
        "\u0437\u0430 \u043f\u0440\u043e\u0441\u0440\u043e\u0447\u043a\u0443 "
        "\u0443\u043f\u043b\u0430\u0447\u0438\u0432\u0430\u0435\u0442 "
        "\u0448\u0442\u0440\u0430\u0444 5%."
    )
    clauses = [ClauseSegment(clause_id="clause-1", text=text, offset=0, end_offset=len(text))]

    risks = scorer.score(
        clauses=clauses,
        role="\u0418\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c",
        language="ru",
        contract_type="service_agreement",
    )

    penalty_risk = next(risk for risk in risks if risk.rule_id == "one_sided_penalty")
    evidence = penalty_risk.evidence[0]

    assert "\u0448\u0442\u0440\u0430\u0444" in evidence.source_excerpt.casefold()
    assert text[evidence.offset.start : evidence.offset.end] == evidence.source_excerpt


def test_validation_rerank_filters_reference_only_risk_examples() -> None:
    scorer = RiskScoringService()
    text = (
        "Reference only: sample clause is not part of this agreement. "
        "Contractor pays a 10% penalty for each day of delay."
    )
    clauses = [ClauseSegment(clause_id="clause-1", text=text, offset=0, end_offset=len(text))]

    risks = scorer.score(
        clauses=clauses,
        role="Contractor",
        language="en",
        contract_type="service_agreement",
    )

    assert all(risk.rule_id != "one_sided_penalty" for risk in risks)
