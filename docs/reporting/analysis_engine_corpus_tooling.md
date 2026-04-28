# Analysis Engine Corpus Tooling

This repo now includes a service-local corpus workflow for the analysis engine:

- runner: `services/analysis-engine/tools/corpus_run.py`
- evaluator: `services/analysis-engine/tools/evaluate.py`
- canonical golden set manifest: `services/analysis-engine/tests/golden_set/cases.json`
- starter local docs: `services/analysis-engine/golden_set/docs/`
- run artifacts:
  - `services/analysis-engine/artifacts/corpus_results_iter2/` for the checked-in golden-set metrics
  - `services/analysis-engine/artifacts/corpus_results/` for the full 447-file coverage run
- evaluation reports: `services/analysis-engine/reports/`

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
- `corpus_results` => wide extraction and coverage run across `договоры*`, useful for ingestion health and aggregate signal review
