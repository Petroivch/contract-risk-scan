# Test Golden Set

`cases.json` is the canonical manifest for `tools/corpus_run.py` and `tools/evaluate.py`.

Layout:
- legacy starter docs remain under `services/analysis-engine/golden_set/docs/`
- expanded HTML corpus cases point to the workspace-level contract corpus directories
- the loader resolves relative paths against this directory, so the manifest stays evaluator-compatible

Case contract:
- `case_id`, `document_path`, `role`, `counterparty_role`, `language`, `tags`, `expected`
- `expected` is intentionally conservative for workspace HTML cases: type match, minimum confidence, minimum risk count, minimum disputed clause count, execution mode
