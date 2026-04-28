# Golden Set

`docs/` stores the starter local documents used by the corpus tooling.

The canonical manifest now lives at `services/analysis-engine/tests/golden_set/cases.json`.
`tools/corpus_run.py` prefers that path and falls back to `golden_set/cases.json` only for legacy compatibility.

Each manifest case points to a document in `docs/` or to a workspace corpus file and defines:

- `case_id`
- `document_path`
- `role`
- `counterparty_role`
- `language`
- `tags`
- `expected`

The current evaluation contract checks exact `contract_type`, minimum risk/dispute counts, optional risk title fragments, optional asymmetry signals, and basic output health checks.
