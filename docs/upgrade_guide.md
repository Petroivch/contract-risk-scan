# Upgrade Guide

## Scope

This upgrade keeps the existing API shape and adds optional metadata:

- `contract_type`
- `asymmetry_signals`

Existing clients can ignore these fields.

## Config changes

`analysis_config.json` now includes:

- `contract_types[]`
- richer `risk_rules[]`
- `role_escalation_matrix`
- `truncation`

## Rollout order

1. deploy new Python code
2. deploy updated `analysis_config.json`
3. run `pytest services/analysis-engine/tests -q`
4. verify a sample service contract, lease contract, and targeted-education contract

## Rollback

If rollout needs to be reverted:

1. restore previous `analysis_config.json`
2. redeploy previous `app/services/*`
3. clear the runtime config cache by restarting the service
