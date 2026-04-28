# Legal Risk Taxonomy v2

`analysis-engine` now uses role-aware legal risks instead of generic keyword labels.

## Core families

1. Payment balance
2. Acceptance and quality
3. Liability and sanctions
4. Termination and change control
5. Security and collateral
6. Lease-specific operating burdens
7. IP and confidentiality
8. Education and labor-linked obligations

## Current rules

- `payment_asymmetry`
- `long_payment_delay_no_security`
- `payment_conditioned_on_signed_act`
- `invoice_dependency_for_payment`
- `unilateral_price_change`
- `unilateral_scope_change`
- `one_sided_penalty`
- `uncapped_daily_penalty`
- `penalty_plus_full_damages`
- `unlimited_liability`
- `no_liability_cap_for_indirect_losses`
- `undefined_acceptance_criteria`
- `no_acceptance_deadline`
- `silent_acceptance`
- `no_warranty_period`
- `unlimited_defect_cure`
- `strict_deadlines_without_dependency_carveout`
- `missing_schedule_or_appendix`
- `unilateral_termination_no_cause`
- `vague_material_breach`
- `retention_or_deposit_discretion`
- `broad_access_rights`
- `operating_expenses_shift`
- `early_risk_transfer`
- `uncontrolled_subcontracting`
- `confidentiality_without_exceptions`
- `ip_transfer_without_scope`
- `royalty_reduction_unclear`
- `all_obligations_security`
- `favorable_jurisdiction_or_dispute_clause`
- `conflicting_obligations`
- `post_training_employment_obligation`
- `support_reimbursement_after_withdrawal`
- `salary_reduction_unilateral`
- `trial_period_abuse`
- `bank_guarantee_on_demand`

## Design principles

- a risk is not “there is a penalty clause”; a risk is the legal imbalance created by that clause
- severity starts from `severity_base`, then moves through role escalation
- detection is config-first through `patterns`, `all_patterns`, `negative_pattern`, and contract-type filters
- English and Russian patterns are supported where that materially improves coverage
