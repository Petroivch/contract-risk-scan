# Contract Type Classification

The classifier is heuristic and config-driven. It scores:

- `keywords`
- `markers`
- `characteristic_clauses`
- exact title matches

## Top-level classes

- `targeted_education_agreement`
- `labor_contract`
- `service_agreement`
- `consulting_agreement`
- `purchase_agreement`
- `supply_agreement`
- `lease_agreement`
- `construction_contract`
- `agency_agreement`
- `loan_security_agreement`
- `insurance_agreement`
- `ip_agreement`
- `partnership_agreement`
- `non_contract_legal_form`

## Fallback behavior

If all classes score `0`, the detector returns `general_contract` with `confidence=0.0`.

That fallback is important because generic documents like `scan.pdf` should still be analyzed for risks instead of being forced into the first configured class.
