# Contract Risk Scanner: Analysis Engine

FastAPI service for contract ingestion, extraction, classification, risk scoring, and corpus evaluation.

## Scope

- `POST /analysis/run` starts analysis
- `GET /analysis/{job_id}/status` returns job status
- `GET /analysis/{job_id}/result` returns the final structured result
- `app/services/ingestion.py` extracts text from `.doc`, `.docx`, `.pdf`, `.html`, `.txt`
- `tools/corpus_run.py` runs the engine over a corpus
- `tools/evaluate.py` measures HIGH-risk precision and recall against `tests/golden_set`

## Layout

- `app/main.py` — FastAPI entrypoint
- `app/api/routers/analysis.py` — API routes
- `app/schemas/analysis.py` — request/response schemas
- `app/config/analysis_config.json` — runtime config and taxonomy
- `app/services/ingestion.py` — document extraction and metadata
- `app/services/risk_scoring.py` — rules engine
- `app/services/contract_analysis.py` — contract type detection and role aliasing
- `tools/corpus_run.py` — corpus runner
- `tools/evaluate.py` — evaluator
- `tests/golden_set/cases.json` — canonical golden set manifest
- `reports/corpus_evaluation.json` / `reports/corpus_evaluation.md` — latest evaluation report

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Run the API:

```bash
uvicorn app.main:app --reload --port 8010
```

## Native Dependencies

Preferred Windows setup for legacy `.doc`:

- Microsoft Word installed locally
- `pywin32` installed from `requirements.txt`

Optional fallbacks for `.doc` if Word is unavailable:

- LibreOffice (`soffice`)
- `antiword`
- `catdoc`
- `textract` with its native backends

Optional OCR stack for image-only inputs:

- Tesseract OCR
- `pytesseract`
- `Pillow`

Current behavior:

- `.doc` prefers Word COM, then falls back to `soffice`, `antiword`, `catdoc`, `textract`
- `.docx` prefers `mammoth`, then `python-docx`, then XML fallback
- `.pdf` prefers `pdfplumber`, then `pypdf`
- OCR is used only for `image/*`

## Validation

```bash
python -m pytest -q
```

## Corpus Run

Run against the local corpus folders:

```bash
python corpus_run.py --input-dirs "договоры,договоры 2,договоры 3,договоры 4" --output-dir artifacts/corpus_results --call-analysis-api http://localhost:8010/analysis/run
```

Local in-process mode without the API:

```bash
python corpus_run.py --input-dirs "договоры,договоры 2,договоры 3,договоры 4" --output-dir artifacts/corpus_results
```

Run against the canonical golden set:

```bash
python corpus_run.py --manifest tests/golden_set/cases.json --output-dir artifacts/corpus_results_iter2
```

## Evaluation

```bash
python evaluate.py --golden tests/golden_set --results artifacts/corpus_results_iter2 --out reports/corpus_evaluation.json
```

The Markdown summary is written next to the JSON report as `reports/corpus_evaluation.md`.

`artifacts/corpus_results_iter2` is the checked-in golden-set run used for the published precision/recall metrics.
`artifacts/corpus_results` is the wider 447-file coverage run across `договоры*` and is intended for extraction/coverage inspection, not for the published golden-set scorecard.

## Current Metrics

Latest golden-set evaluation:

- HIGH-risk precision: `0.8642`
- HIGH-risk recall: `0.8974`
- Contract type accuracy: `0.9886`

See:

- `reports/corpus_evaluation.json`
- `reports/corpus_evaluation.md`
