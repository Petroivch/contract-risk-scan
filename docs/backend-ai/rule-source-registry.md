# Rule Source Registry (No-Hardcode Compliance)

## Purpose
This registry documents source references for every configurable heuristic/rule used by analysis-engine.

## Authoritative config
- `services/analysis-engine/app/config/analysis_config.json`

## Source policy
1. Rules and localized texts are configuration artifacts, not code constants.
2. Every rule/dispute marker must include `source_ref`.
3. New rules require update of this registry and config in the same change.

## Risk rule sources
- `RSK-001`: Penalty clause heuristic baseline (legal risk pattern taxonomy, internal curation v1).
- `RSK-002`: Liquidated damages heuristic baseline (internal curation v1).
- `RSK-003`: Unilateral change/termination heuristic baseline (internal curation v1).
- `RSK-004`: Confidentiality obligation heuristic baseline (internal curation v1).
- `RSK-005`: Indemnification heuristic baseline (internal curation v1).

## Dispute marker sources
- `DSP-001`: Future-agreement ambiguity marker set (internal curation v1).
- `DSP-002`: Discretionary-right marker set (internal curation v1).
- `DSP-003`: Subjective-timeline marker set (internal curation v1).

## Validation requirements
- All localized maps must include `ru`, `en`, `it`, `fr`.
- Unsupported severity values are rejected at config load time.
- Missing source references are not allowed in production updates.
