from app.services.clause_segmentation import ClauseSegment
from app.services.risk_scoring import RiskScoringService


def test_discretionary_right_marker_returns_rule_id_and_offsets() -> None:
    scorer = RiskScoringService()
    clause = ClauseSegment(
        clause_id="clause-1",
        text="Заказчик вправе по своему усмотрению отклонить результат работ без дополнительных критериев.",
        offset=12,
        end_offset=101,
    )

    disputed = scorer.extract_disputed_clauses([clause], language="ru")

    assert disputed[0].rule_id == "dispute_marker_discretionary_right"
    assert disputed[0].offset.start == 12
    assert disputed[0].offset.end >= disputed[0].offset.start
    assert disputed[0].provenance.source_ref == "DSP-002"
    assert disputed[0].provenance.offset.start >= 12


def test_reasonable_time_marker_keeps_clause_text_and_confidence() -> None:
    scorer = RiskScoringService()
    clause = ClauseSegment(
        clause_id="clause-2",
        text="Исполнитель обязан устранить замечания в разумный срок после уведомления.",
    )

    disputed = scorer.extract_disputed_clauses([clause], language="ru")

    assert disputed[0].rule_id == "dispute_marker_reasonable_time"
    assert disputed[0].text.startswith("Исполнитель обязан")
    assert 0.0 <= disputed[0].confidence <= 1.0
    assert disputed[0].provenance.text


def test_appendix_dependency_marker_is_detected_from_configured_phrases() -> None:
    scorer = RiskScoringService()
    clause = ClauseSegment(
        clause_id="clause-3",
        text="Объем работ определяется согласно приложению № 1 и графику, подписываемому сторонами позднее.",
    )

    disputed = scorer.extract_disputed_clauses([clause], language="ru")

    assert disputed[0].rule_id == "dispute_marker_appendix_dependency"
    assert "прилож" in disputed[0].provenance.text.casefold()
    assert disputed[0].provenance.matched_patterns


def test_conflict_marker_detects_competing_conditions() -> None:
    scorer = RiskScoringService()
    clause = ClauseSegment(
        clause_id="clause-4",
        text="Исполнитель обязан завершить работы в течение 5 дней и одновременно обеспечить приемку заказчиком.",
    )

    disputed = scorer.extract_disputed_clauses([clause], language="ru")

    assert disputed[0].rule_id == "dispute_marker_conflict"
    assert disputed[0].provenance.source == "normalized_document_text"
    assert disputed[0].provenance.offset.end > disputed[0].provenance.offset.start
