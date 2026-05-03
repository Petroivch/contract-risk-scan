# Disputed Clause Detection

`services/analysis-engine/app/services/disputed_clause_detector.py` implements a lightweight disputed clause detector based on heuristics and config-first rules.

## Output Contract

Each `result.disputed_clauses[]` item returns:

- `clause_id`
- `text`
- `offset`
- `rule_id`
- `confidence`
- legacy fields: `clause_excerpt`, `dispute_reason`, `possible_consequence`
- `provenance`

`text` is the normalized full clause text. `offset` is an object with `start` and `end` in normalized document text. `provenance` stores the matched fragment and its offsets:

- `source`
- `source_ref`
- `text`
- `offset.start`
- `offset.end`
- `matched_patterns`

## Offset Semantics

Offsets are emitted in the `normalized_document_text` coordinate space.

That means:

1. The raw document is normalized by `normalize_contract_text(...)`.
2. Clause segmentation works on the normalized string.
3. `ClauseSegment.offset` and `ClauseSegment.end_offset` point to the clause boundaries in the normalized string.
4. `disputed_clauses[].offset.start/end` reuse those clause boundaries.
5. `provenance.offset.start/end` point to the matched fragment inside that same normalized string.

This keeps offsets deterministic even when ingestion normalizes line breaks, repeated whitespace, or soft hyphenation.

## Detection Flow

For each segmented clause the detector:

1. Normalizes the clause text.
2. Iterates over `risk_scoring.dispute_markers`.
3. Resolves the rule input from:
   - `detection_logic`, when present
   - otherwise legacy `markers[]`
4. Finds matching spans with regex-first search and literal fallback.
5. Builds a bounded provenance fragment around the match.
6. Emits one disputed clause item per `(clause_id, rule_id)`.

If no dispute rule matches, the engine keeps backward compatibility by returning one fallback item based on the first clause, with:

- `rule_id = "fallback_disputed_clause"`
- configured fallback reason and consequence
- provenance covering the fallback clause text

## Config Shape

`dispute_markers[]` now supports both the legacy and structured forms:

```json
{
  "id": "dispute_marker_example",
  "source_ref": "DSP-999",
  "markers": ["by mutual agreement"],
  "detection_logic": {
    "type": "pattern_search",
    "patterns": ["by\\s+mutual\\s+agreement", "at\\s+its\\s+sole\\s+discretion"],
    "all_patterns": [],
    "any_patterns": [],
    "absent_patterns": [],
    "min_matches": 1,
    "source": "clause"
  },
  "fragment_window_chars": 160,
  "fragment_max_chars": 320,
  "reason": {
    "ru": "...",
    "en": "...",
    "it": "...",
    "fr": "..."
  },
  "consequence": {
    "ru": "...",
    "en": "...",
    "it": "...",
    "fr": "..."
  },
  "confidence": 0.8
}
```

## Extending the Detector

To add a new disputed clause rule:

1. Add a new `dispute_marker` entry in `analysis_config.json`.
2. Assign a new `id` and `source_ref`.
3. Prefer `detection_logic.patterns` when the rule needs regex matching or multiple patterns.
4. Use `markers[]` for simple substring rules when regex is unnecessary.
5. Tune `fragment_window_chars` and `fragment_max_chars` to control provenance snippet size.
6. Add the corresponding `DSP-*` entry to `docs/backend-ai/rule-source-registry.md`.
7. Add a focused test covering the emitted `rule_id`, offsets, and provenance.

## Current Rule Families

Current config covers:

- future agreement and later coordination
- discretionary one-sided rights
- open-ended timing
- appendix or schedule dependency
- subjective acceptance or quality criteria
- conflicting simultaneous conditions
