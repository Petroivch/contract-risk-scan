from __future__ import annotations

import pytest

from tests.golden_set import (
    GOLDEN_CASES,
    ROLE_ESCALATION_CASE,
    role_matches,
    score_document,
    severity_rank,
    snapshot_for,
)


def _assert_structured_records(records: list[object]) -> None:
    assert records
    for record in records:
        assert record.id
        assert record.headline.endswith(".")
        assert record.description.endswith(".")
        assert record.recommendation.endswith(".")
        assert record.recommendation.startswith("Проверьте")
        assert isinstance(record.evidence, list)


def _find_risk_by_rule_id(risks: list[object], rule_id: str) -> object | None:
    for risk in risks:
        if risk.rule_id == rule_id:
            return risk
    return None


@pytest.mark.parametrize("case", GOLDEN_CASES, ids=lambda case: case.case_id)
def test_golden_cases_expose_expected_quality_signals(case) -> None:
    snapshot = snapshot_for(case.case_id)

    assert snapshot.contract_type.type_id == case.expected_contract_type
    assert snapshot.contract_type.confidence >= case.min_contract_type_confidence
    assert len(snapshot.risks) >= case.min_risk_count
    assert len(snapshot.disputed_clauses) >= case.min_dispute_count
    assert snapshot.contract_brief
    assert snapshot.selected_role_matches

    detected_roles = {detected_role.canonical_role for detected_role in snapshot.detected_roles}
    risk_ids = {risk.rule_id for risk in snapshot.risks}
    dispute_rule_ids = {item.rule_id for item in snapshot.disputed_clauses}
    record_ids = {record.id for record in snapshot.contract_brief_records}

    assert detected_roles.issuperset(case.required_roles)
    assert risk_ids.issuperset(case.expected_risk_ids)
    assert dispute_rule_ids.issuperset(case.expected_dispute_rule_ids)
    assert snapshot.contract_brief_records[0].id == "contract-brief-intro"
    assert "contract-brief-disputed-clauses" in record_ids
    _assert_structured_records(snapshot.contract_brief_records)

    if case.absent_role is not None:
        assert not role_matches(case.absent_role, case.document_text)


def test_quality_metrics_thresholds_hold_for_compact_golden_set() -> None:
    matched_contract_types = 0
    matched_missing_roles = 0
    matched_risk_rules = 0
    matched_dispute_rules = 0
    total_contract_types = 0
    total_missing_roles = 0
    total_risk_rules = 0
    total_dispute_rules = 0

    for case in GOLDEN_CASES:
        snapshot = snapshot_for(case.case_id)
        total_contract_types += 1
        matched_contract_types += int(
            snapshot.contract_type.type_id == case.expected_contract_type
            and snapshot.contract_type.confidence >= case.min_contract_type_confidence
        )

        risk_ids = {risk.rule_id for risk in snapshot.risks}
        dispute_rule_ids = {item.rule_id for item in snapshot.disputed_clauses}
        total_risk_rules += len(case.expected_risk_ids)
        total_dispute_rules += len(case.expected_dispute_rule_ids)
        matched_risk_rules += len(risk_ids.intersection(case.expected_risk_ids))
        matched_dispute_rules += len(dispute_rule_ids.intersection(case.expected_dispute_rule_ids))

        if case.absent_role is not None:
            total_missing_roles += 1
            matched_missing_roles += int(not role_matches(case.absent_role, case.document_text))

    contract_type_accuracy = matched_contract_types / total_contract_types
    missing_role_accuracy = matched_missing_roles / total_missing_roles
    risk_rule_recall = matched_risk_rules / total_risk_rules
    dispute_rule_recall = matched_dispute_rules / total_dispute_rules

    assert contract_type_accuracy >= 1.0
    assert missing_role_accuracy >= 1.0
    assert risk_rule_recall >= 1.0
    assert dispute_rule_recall >= 1.0


def test_role_escalation_keeps_harmed_party_at_higher_severity() -> None:
    primary_risks = score_document(
        document_text=ROLE_ESCALATION_CASE.document_text,
        language=ROLE_ESCALATION_CASE.language,
        role=ROLE_ESCALATION_CASE.role,
        counterparty_role=ROLE_ESCALATION_CASE.counterparty_role,
    )
    alternate_risks = score_document(
        document_text=ROLE_ESCALATION_CASE.document_text,
        language=ROLE_ESCALATION_CASE.language,
        role=ROLE_ESCALATION_CASE.alternate_role,
        counterparty_role=ROLE_ESCALATION_CASE.alternate_counterparty_role,
    )

    primary_risk = _find_risk_by_rule_id(primary_risks, ROLE_ESCALATION_CASE.expected_primary_risk_id)
    alternate_risk = _find_risk_by_rule_id(alternate_risks, ROLE_ESCALATION_CASE.expected_alternate_risk_id)

    assert primary_risk is not None
    assert alternate_risk is not None
    assert severity_rank(primary_risk.severity.value) > severity_rank(alternate_risk.severity.value)
    assert any(risk.rule_id == "one_sided_penalty" for risk in primary_risks)
    assert all(risk.rule_id != ROLE_ESCALATION_CASE.expected_primary_risk_id for risk in alternate_risks)
