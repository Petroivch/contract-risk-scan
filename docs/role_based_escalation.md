# Role-Based Escalation

Severity is no longer static.

## Flow

1. A rule matches a clause or document context.
2. The engine starts from `severity_base`.
3. It canonicalizes the selected role:
   - `customer` -> `client`
   - `contractor` -> `executor`
   - `гражданин` -> `worker`
   - `работодатель` -> `employer`
4. It applies rule-local `role_escalation`.
5. If present, it also applies `role_escalation_matrix[contract_type][risk_id][role]`.

## Examples

- `payment_asymmetry`
  - `executor` -> `critical`
  - `client` -> `low`

- `unilateral_termination_no_cause`
  - `worker` / `executor` -> `critical`
  - `employer` / `client` -> `low`

- `support_reimbursement_after_withdrawal`
  - `worker` -> `critical`
  - `client` -> `low`

This is the main fix for the old bug where the engine reported a counterparty-favorable clause as if it were equally risky for the beneficiary.
