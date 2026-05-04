# Analysis Engine Corpus Tooling

This repo includes a service-local corpus workflow for the analysis engine:

- runner: `services/analysis-engine/tools/corpus_run.py`
- evaluator: `services/analysis-engine/tools/evaluate.py`
- canonical golden set manifest: `services/analysis-engine/tests/golden_set/cases.json`
- starter local docs: `services/analysis-engine/golden_set/docs/`
- generated run artifacts:
  - `services/analysis-engine/artifacts/corpus_results_iter2/` for the canonical checked-in golden-set metrics
  - `services/analysis-engine/artifacts/corpus_results/` for wide coverage runs
- evaluation reports: `services/analysis-engine/reports/`

Tracking policy:

- keep `artifacts/corpus_results_iter2/` tracked as the canonical published golden-set run
- keep `reports/corpus_evaluation.json` and `reports/corpus_evaluation.md` tracked as the canonical scorecard outputs
- do not commit fresh timestamped corpus sweeps under `artifacts/corpus_results/**`
- do not commit smoke-only runs, ad hoc exported report bundles, generated corpora, raw document collections, or base64/raw payload dumps
- do not commit artifacts that contain source contract text, `document_base64`, raw request/response payloads, or enough excerpts to reconstruct a source document
- if a new corpus snapshot must be published intentionally, replace the canonical checked-in target instead of adding another parallel run tree

Example commands from `services/analysis-engine`:

```bash
python tools/corpus_run.py
python tools/evaluate.py
```

Useful filters:

```bash
python tools/corpus_run.py --case-id agency_goods_ru --case-id rent_ru
python tools/corpus_run.py --limit 5
python tools/evaluate.py --results artifacts/corpus_results_iter2
```

The runner executes the analysis services directly and does not depend on the API router or production ingestion entrypoint. That keeps the workflow usable even when unrelated work is in flight elsewhere in the service package.

For release reporting, keep the distinction explicit:

- `corpus_results_iter2` + `tests/golden_set/cases.json` => the precision/recall scorecard published in `reports/corpus_evaluation.*`
- `corpus_results` => wide extraction and coverage run across external corpora, useful for ingestion health and aggregate signal review
- repo policy => broad coverage runs are workspace diagnostics, not a growing archive of tracked outputs
