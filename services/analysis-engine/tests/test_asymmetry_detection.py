from app.services.asymmetry_detector import AsymmetryDetector
from app.services.clause_segmentation import ClauseSegment


def test_detects_payment_asymmetry_between_performance_and_payment() -> None:
    detector = AsymmetryDetector()
    clauses = [
        ClauseSegment(clause_id="clause-1", text="Contractor delivers the report within 5 days."),
        ClauseSegment(clause_id="clause-2", text="Customer pays the invoice within 45 days after acceptance."),
    ]

    signals = detector.detect_asymmetries(clauses)

    payment_signal = next(signal for signal in signals if signal.risk_id == "payment_asymmetry")
    assert payment_signal.severity_hint == "high"
    assert "раньше оплаты" in payment_signal.summary


def test_detects_termination_asymmetry() -> None:
    detector = AsymmetryDetector()
    clauses = [
        ClauseSegment(clause_id="clause-1", text="Заказчик вправе в одностороннем порядке отказаться от договора."),
        ClauseSegment(clause_id="clause-2", text="Исполнитель обязан продолжать оказание услуг до получения письменного уведомления."),
    ]

    signals = detector.detect_asymmetries(clauses)

    termination_signal = next(signal for signal in signals if signal.risk_id == "termination_asymmetry")
    assert termination_signal.severity_hint == "critical"
    assert termination_signal.clause_id == "clause-1"
