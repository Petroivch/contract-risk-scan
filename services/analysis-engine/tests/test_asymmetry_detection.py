from app.services.asymmetry_detector import AsymmetryDetector
from app.services.clause_segmentation import ClauseSegment


def test_detects_payment_asymmetry_between_delivery_and_deferred_payment() -> None:
    detector = AsymmetryDetector()
    clauses = [
        ClauseSegment(clause_id="clause-1", text="Contractor delivers the report within 5 days."),
        ClauseSegment(
            clause_id="clause-2",
            text="Customer pays the invoice within 45 days after acceptance.",
        ),
    ]

    signals = detector.detect_asymmetries(clauses)

    payment_signal = next(signal for signal in signals if signal.risk_id == "payment_asymmetry")
    assert payment_signal.clause_id == "clause-1"
    assert payment_signal.severity_hint == "high"
    assert payment_signal.affected_roles == ["executor"]
    assert "45" in payment_signal.details


def test_detects_termination_asymmetry_for_unilateral_exit_right() -> None:
    detector = AsymmetryDetector()
    clauses = [
        ClauseSegment(
            clause_id="clause-1",
            text="Customer may unilaterally terminate this agreement at its sole discretion.",
        ),
        ClauseSegment(
            clause_id="clause-2",
            text="Contractor shall continue providing services until the termination notice date.",
        ),
    ]

    signals = detector.detect_asymmetries(clauses)

    termination_signal = next(signal for signal in signals if signal.risk_id == "termination_asymmetry")
    assert termination_signal.clause_id == "clause-1"
    assert termination_signal.severity_hint == "critical"
    assert "executor" in termination_signal.affected_roles


def test_detects_liability_asymmetry_when_only_one_party_has_unlimited_liability() -> None:
    detector = AsymmetryDetector()
    clauses = [
        ClauseSegment(
            clause_id="clause-1",
            text="Contractor bears full liability and indemnifies Customer for all losses caused by delay.",
        ),
        ClauseSegment(
            clause_id="clause-2",
            text="Customer's aggregate liability is limited to the fees paid under this agreement.",
        ),
    ]

    signals = detector.detect_asymmetries(clauses)

    liability_signal = next(signal for signal in signals if signal.risk_id == "liability_asymmetry")
    assert liability_signal.clause_id == "clause-1"
    assert liability_signal.severity_hint == "high"
    assert liability_signal.affected_roles == ["executor"]


def test_detects_scope_flexibility_asymmetry_for_unilateral_scope_changes() -> None:
    detector = AsymmetryDetector()
    clauses = [
        ClauseSegment(
            clause_id="clause-1",
            text=(
                "Customer may unilaterally change the scope and specifications, "
                "and Contractor shall comply without additional payment."
            ),
        ),
        ClauseSegment(
            clause_id="clause-2",
            text="Contractor delivers the updated work within 3 days.",
        ),
    ]

    signals = detector.detect_asymmetries(clauses)

    scope_signal = next(signal for signal in signals if signal.risk_id == "scope_flexibility_asymmetry")
    assert scope_signal.clause_id == "clause-1"
    assert scope_signal.severity_hint == "high"
    assert "executor" in scope_signal.affected_roles
