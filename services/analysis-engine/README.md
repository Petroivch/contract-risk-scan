# Contract Risk Scanner: Analysis Engine

FastAPI service for contract ingestion, extraction, classification, risk scoring, disputed clause detection, and corpus evaluation.

## Scope

- `POST /analysis/run` starts analysis
- `GET /analysis/{job_id}/status` returns job status
- `GET /analysis/{job_id}/result` returns the final structured result
- `app/services/ingestion.py` extracts text from `.doc`, `.docx`, `.pdf`, `.html`, `.txt`
- `app/services/disputed_clause_detector.py` detects disputed and ambiguous clauses from config-driven rules
- `tools/corpus_run.py` runs the engine over a corpus
- `tools/evaluate.py` measures HIGH-risk precision and recall against `tests/golden_set`

## Layout

- `app/main.py` - FastAPI entrypoint
- `app/api/routers/analysis.py` - API routes
- `app/schemas/analysis.py` - request/response schemas
- `app/config/analysis_config.json` - runtime config and taxonomy
- `app/services/ingestion.py` - document extraction and metadata
- `app/services/risk_scoring.py` - risk rules engine
- `app/services/disputed_clause_detector.py` - config-first disputed clause detector with provenance
- `app/services/contract_analysis.py` - contract type detection and role aliasing
- `tools/corpus_run.py` - corpus runner
- `tools/evaluate.py` - evaluator
- `tests/golden_set/cases.json` - canonical golden set manifest
- `reports/corpus_evaluation.json` / `reports/corpus_evaluation.md` - latest evaluation report

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

Legacy `.doc` is not accepted by the analysis-engine extractor because reliable support
depends on desktop applications or native command-line tools outside the Python stack.
Convert `.doc` files to DOCX, PDF, or TXT before upload.

Optional OCR stack for image-only inputs and scanned PDF fallback:

- Tesseract OCR
- `pytesseract`
- `Pillow`
- PDF rendering uses `pdfplumber`/PDFium first; optional fallbacks are PyMuPDF (`fitz`) or `pdf2image` with Poppler

Current behavior:

- `.doc` returns an explicit unsupported-format extraction error
- `.docx` prefers `mammoth`, then `python-docx`, then XML fallback
- `.pdf` prefers `pdfplumber`, then `pypdf`, then scanned-PDF OCR when direct text is empty or too short
- OCR is used for `image/*` and scanned-PDF fallback when native OCR/rendering tools are available

## Validation

```bash
python -m pytest -q
```

## Disputed Clause Payload

`result.disputed_clauses[]` keeps the legacy fields and also exposes:

- `text` - normalized full clause text
- `offset` - clause boundaries as `{start, end}` in normalized document text
- `rule_id` - config rule identifier from `risk_scoring.dispute_markers`
- `confidence` - configured detector confidence
- `provenance` - source fragment metadata with `text`, `offset.{start,end}`, `matched_patterns`, and `source_ref`

Offsets are reported in the normalized document text coordinate space. The exact matched fragment is stored under `provenance`, while `clause_excerpt` remains the backward-compatible preview field.

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

`artifacts/corpus_results_iter2` is the checked-in golden-set run used for the published precision/recall metrics. `artifacts/corpus_results` is the wider coverage run across `договоры*` and is intended for extraction and coverage inspection, not for the published golden-set scorecard.

## Current Metrics

Latest golden-set evaluation:

- HIGH-risk precision: `0.8642`
- HIGH-risk recall: `0.8974`
- Contract type accuracy: `0.9886`

See:

- `reports/corpus_evaluation.json`
- `reports/corpus_evaluation.md`
