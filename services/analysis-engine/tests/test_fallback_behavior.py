from __future__ import annotations

from app.config.runtime import get_runtime_config
from app.localization import resolve_localized_text
from app.schemas.analysis import RiskSeverity
from app.services.clause_segmentation import ClauseSegment, ClauseSegmentationService
from app.services.contract_analysis import DetectedContractType
from app.services.contract_brief import ContractBriefGenerationService
from app.services.risk_scoring import RiskScoringService
from app.services.summary_generation import SummaryGenerationService


def test_clause_segmentation_returns_localized_fallback_for_blank_text() -> None:
    runtime_config = get_runtime_config()
    service = ClauseSegmentationService()

    clauses = service.segment(" \n\t ", "en")

    assert clauses == [
        ClauseSegment(
            clause_id=runtime_config.pipeline.segmentation.fallback_clause_id,
            text=resolve_localized_text(
                runtime_config.pipeline.segmentation.fallback_clause_text,
                "en",
            ),
        )
    ]


def test_risk_scoring_returns_single_fallback_risk_for_neutral_clause() -> None:
    runtime_config = get_runtime_config()
    service = RiskScoringService()

    risks = service.score(
        clauses=[ClauseSegment(clause_id="clause-1", text="The parties confirm the contract date.")],
        role="Contractor",
        language="en",
        document_text="The parties confirm the contract date.",
    )

    assert len(risks) == 1
    assert risks[0].severity == RiskSeverity.LOW
    assert risks[0].title == resolve_localized_text(runtime_config.risk_scoring.fallback.risk_title, "en")
    assert risks[0].description == resolve_localized_text(
        runtime_config.risk_scoring.fallback.risk_description,
        "en",
    )


def test_extract_disputed_clauses_returns_fallback_item_when_no_marker_matches() -> None:
    runtime_config = get_runtime_config()
    service = RiskScoringService()

    disputed = service.extract_disputed_clauses(
        [ClauseSegment(clause_id="clause-1", text="The parties confirm the contract date.")],
        language="en",
    )

    assert len(disputed) == 1
    assert disputed[0].clause_id == "clause-1"
    assert disputed[0].dispute_reason == resolve_localized_text(
        runtime_config.risk_scoring.fallback.dispute_reason,
        "en",
    )
    assert disputed[0].possible_consequence == resolve_localized_text(
        runtime_config.risk_scoring.fallback.dispute_consequence,
        "en",
    )
    assert disputed[0].confidence == runtime_config.risk_scoring.fallback_dispute_confidence


def test_summary_generation_uses_localized_fallback_sections_when_extractors_find_nothing() -> None:
    runtime_config = get_runtime_config()
    service = SummaryGenerationService()

    summary = service.generate(
        document_text="The parties confirm the contract date.",
        clauses=[ClauseSegment(clause_id="clause-1", text="The parties confirm the contract date.")],
        risks=[],
        role="Contractor",
        counterparty_role="Customer",
        language="en",
    )

    assert summary.must_do == [
        resolve_localized_text(runtime_config.summary_generation.fallback_values.must_do, "en")
    ]
    assert summary.should_review == [
        resolve_localized_text(runtime_config.summary_generation.fallback_values.should_review, "en")
    ]
    assert summary.payment_terms == [
        resolve_localized_text(runtime_config.summary_generation.fallback_values.payment_terms, "en")
    ]
    assert summary.deadlines == [
        resolve_localized_text(runtime_config.summary_generation.fallback_values.deadlines, "en")
    ]
    assert summary.penalties == [
        resolve_localized_text(runtime_config.summary_generation.fallback_values.penalties, "en")
    ]


def test_contract_brief_uses_fallback_template_when_no_sections_are_extracted() -> None:
    runtime_config = get_runtime_config()
    service = ContractBriefGenerationService()

    brief = service.generate(
        document_name="neutral.txt",
        document_text="The parties confirm the contract date.",
        clauses=[ClauseSegment(clause_id="clause-1", text="The parties confirm the contract date.")],
        role="Contractor",
        counterparty_role="Customer",
        language="en",
        disputed_clauses=[],
        detected_contract_type=DetectedContractType(
            type_id="general_contract",
            confidence=0.0,
            ru_name="Contract",
            legal_framework="General",
        ),
    )

    expected = ContractBriefGenerationService._ensure_complete_sentence(
        resolve_localized_text(runtime_config.templates.contract_brief, "en").format(
            document_name="neutral.txt",
            clauses_count=1,
            role="Contractor",
        )
    )

    assert brief == expected
