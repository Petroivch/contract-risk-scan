# Rule Source Registry

## Purpose

This registry records the provenance for every configurable heuristic rule used by `analysis-engine`.

## Canonical Config

- `services/analysis-engine/app/config/analysis_config.json`

## Policy

1. Rules and localized texts are configuration artifacts, not hardcoded constants.
2. Every `risk_rule` and `dispute_marker` must define `source_ref`.
3. Any new production rule must be added to both the config and this registry in the same change.
4. `dispute_marker` may use legacy `markers[]` or structured `detection_logic`; both remain config-first inputs.

## Risk Rule Sources

- `RSK-001` - baseline heuristic for penalty clauses (internal curation v1)
- `RSK-002` - baseline heuristic for liquidated damages / penalty clauses (internal curation v1)
- `RSK-003` - baseline heuristic for unilateral change or termination (internal curation v1)
- `RSK-004` - baseline heuristic for confidentiality obligations (internal curation v1)
- `RSK-005` - baseline heuristic for indemnity and damages allocation (internal curation v1)

## Dispute Marker Sources

- `DSP-001` - future agreement / later coordination ambiguity markers (internal curation v1)
- `DSP-002` - discretionary one-sided rights markers (internal curation v1)
- `DSP-003` - subjective or open-ended timing markers (internal curation v1)
- `DSP-004` - appendix / schedule dependency markers for missing annex content (internal curation v1)
- `DSP-005` - subjective quality or acceptance criteria markers (internal curation v1)
- `DSP-006` - conflicting obligation / simultaneous condition markers (internal curation v1)

## Validation Requirements

- Every localized map must include `ru`, `en`, `it`, and `fr`
- Unsupported severity values fail config loading
- `dispute_marker` must define `markers` or `detection_logic`
- `fragment_max_chars` must not be smaller than `fragment_window_chars`
- Missing `source_ref` is not acceptable for production changes
