from __future__ import annotations

from types import MethodType

from app.services.clause_segmentation import ClauseSegment
from app.services.contract_analysis import ContractTypeDetector
from app.services.risk_scoring import RiskScoringService


def test_contains_pattern_falls_back_to_plain_substring_for_invalid_regex() -> None:
    assert RiskScoringService._contains_pattern(
        "Price adjustment [draft] requires approval.",
        "[draft",
    )


def test_document_match_succeeds_enforces_all_patterns_and_minimum_hits() -> None:
    combined_text = (
        "Buyer pays within 10 days after delivery. "
        "Advance payment is not required."
    )

    assert RiskScoringService._document_match_succeeds(
        combined_text,
        patterns=[r"within\s+\d+\s+days", r"after\s+delivery", r"advance payment"],
        all_patterns=[r"buyer", r"delivery"],
        min_matches=2,
    )
    assert not RiskScoringService._document_match_succeeds(
        combined_text,
        patterns=[r"within\s+\d+\s+days", r"after\s+invoice"],
        all_patterns=[r"buyer", r"acceptance"],
        min_matches=2,
    )


def test_select_best_excerpt_returns_first_matching_clause() -> None:
    service = RiskScoringService()
    clauses = [
        ClauseSegment(clause_id="clause-1", text="The parties confirm the contract date."),
        ClauseSegment(clause_id="clause-2", text="Buyer pays within 10 days after delivery."),
        ClauseSegment(clause_id="clause-3", text="Seller delivers the goods within 5 days."),
    ]

    clause_id, excerpt = service._select_best_excerpt(
        clauses,
        [r"within\s+\d+\s+days", r"after\s+delivery"],
    )

    assert clause_id == "clause-2"
    assert excerpt == "Buyer pays within 10 days after delivery."


def test_contract_type_confidence_reflects_score_dominance() -> None:
    confidence = ContractTypeDetector._normalize_confidence(best_score=9.0, second_best_score=3.0)

    assert confidence == 0.99


def test_score_matches_each_rule_once_instead_of_once_per_clause() -> None:
    service = RiskScoringService()
    service._config = service._config.model_copy(update={"risk_rules": service._config.risk_rules[:2]})
    calls: list[str] = []

    def fake_match_rule(self, rule, clauses, combined_text, preferred_clause):
        calls.append(rule.id)
        return []

    service._match_rule = MethodType(fake_match_rule, service)

    service.score(
        clauses=[
            ClauseSegment(clause_id="clause-1", text="Buyer pays within 10 days."),
            ClauseSegment(clause_id="clause-2", text="Seller delivers the goods within 5 days."),
            ClauseSegment(clause_id="clause-3", text="Penalty applies for delay."),
        ],
        role="buyer",
        language="en",
        document_text=(
            "Buyer pays within 10 days.\n"
            "Seller delivers the goods within 5 days.\n"
            "Penalty applies for delay."
        ),
    )

    assert calls == [rule.id for rule in service._config.risk_rules]
