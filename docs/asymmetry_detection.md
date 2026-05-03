# Asymmetry Detection

`app/services/asymmetry_detector.py` extracts simple obligation signatures and compares them.

## Signals

- `payment_asymmetry`
  - one side performs now
  - the other side pays materially later

- `termination_asymmetry`
  - unilateral termination right exists for only one side

- `undefined_acceptance_criteria`
  - acceptance exists
  - objective criteria do not

## Current extraction model

Each clause is normalized and mapped to:

- `actor`
- `obligation_type`
- `timeline_days`
- `conditions`

The detector is intentionally lightweight. It is designed to enrich the rule engine, not replace it with a full NLP parser.
