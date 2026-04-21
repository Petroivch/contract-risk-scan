# Analysis Engine Quality Baseline (Stage 1)

## Goal
Define minimum quality requirements and guardrails for contract-risk analysis before model hardening.

## Quality metrics (MVP baseline)
1. API reliability
- Success rate for valid `/analysis/run` requests: >= 99%
- Non-2xx responses must include explicit machine-readable error message

2. Job lifecycle correctness
- Every created job must finish in terminal state (`completed` or `failed`)
- Status transitions are linear: `queued -> processing -> completed|failed`

3. Output schema validity
- 100% of completed jobs must conform to `AnalysisResultResponse` schema
- API responses must include both locale keys for compatibility:
  - `language`
  - `locale`
- Required sections must never be empty simultaneously:
  - `contract_brief`
  - `risks`
  - `role_focused_summary`

4. Locale behavior quality
- Supported locales: `ru`, `en`, `it`, `fr`
- Invalid/missing locale must fallback to `ru`
- `locale` and `language` must be synchronized in all responses
- Missing-job read endpoints must support localized `404` via query `locale`/`language`
- Localized fields coverage must be 100% for completed jobs:
  - `contract_brief`
  - risk `title`, `description`, `role_relevance`, `mitigation`
  - `dispute_reason`, `possible_consequence`
  - summary `overview` and fallback list items

5. Risk extraction precision baseline (stub stage)
- Keyword-driven precision target for sampled contracts: >= 0.6
- Recall target is not enforced at Stage 1 (heuristic prototype)

6. Role-focus quality
- `role_focused_summary.role` must always match input role label
- At least one role-oriented recommendation in `must_do` or `should_review`

7. Build-size and local-first quality
- Global final project build must be <= 228 MB
- AI contribution must be tracked as a share of total build (`ai_assets_mb / total_build_mb`)
- AI share targets:
  - pass: <= 35%
  - warning: > 35% and <= 40%
  - hard review: > 40%
- Lightweight-first policy is mandatory for AI features
- Every analysis response should expose machine-readable execution routing (`execution_plan`)

8. No-hardcode compliance
- Rules/texts/thresholds/timeouts/fallbacks must come from runtime config
- Rule entries must include source references
- Config load must fail on incomplete locale maps

## Guardrails
1. Safety and legal boundaries
- Service provides risk indicators, not legal advice
- Every generated result must be interpretable and traceable to text fragments

2. Deterministic fallback behavior
- If no risk/dispute marker found, return low-confidence fallback records (never empty arrays)
- If locale input is invalid, force deterministic fallback to `ru`

3. Failure isolation
- Pipeline exceptions must fail only current job, not service process
- Failure must preserve error details in job status

4. Input limits (config-driven)
- Max file size and text limits are controlled only by runtime config
- Time budgets are controlled only by runtime config

5. Observability (to implement next stage)
- Structured logs per pipeline step with `job_id` and locale
- Metrics per step latency: ingestion, OCR, segmentation, scoring, summary
- Error taxonomy for top failure classes
- Build-size telemetry for AI artifacts and total app artifact

6. Over-limit reduction order (> 228 MB)
- First offload: local semantic AI inference
- Second offload/reduction: expanded OCR assets
- Third reduction: secondary AI enrichments (rerankers/explanation layers)
- Preserve local deterministic core (ingestion, segmentation, rules-first risk output)

## Reference documents
- `docs/backend-ai/on-device-offline-feasibility.md`
- `docs/backend-ai/no-hardcode-standard.md`
- `docs/backend-ai/rule-source-registry.md`
- `docs/backend-ai/core-api-locale-contract.md`

## Acceptance for Stage 1 completion
- Endpoints respond according to contract
- Pipeline stubs are connected end-to-end
- Multilingual fallback behavior is validated (`invalid -> ru`)
- Read-path error localization and lightweight/offload execution plan are validated by API tests
- Global build budget gates are documented and enforced in CI/CD
- AI share in total build is measured and reported
- No-hardcode policy is enforced by config and validation
- Quality baseline documented and aligned with backend/core-api integration team
