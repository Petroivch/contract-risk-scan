# Contract Risk Scanner: Analysis Engine (FastAPI)

## Scope
This service owns contract analysis pipeline for the MVP:
- Receives analysis job request (`/analysis/run`)
- Tracks job lifecycle (`/analysis/{job_id}/status`)
- Returns structured analysis output (`/analysis/{job_id}/result`)

## Current stage
Implemented skeleton with production-oriented configuration principles:
- Multilingual output: `ru`, `en`, `it`, `fr`
- Default/fallback language: `ru`
- Config-driven pipeline (no hardcoded rules/texts/thresholds in code)
- Config-driven execution plan for `local_first` vs `server_assist`
- API routers and response contracts
- Domain schemas for:
  - risks
  - disputed clauses
  - role-focused summary
- In-memory job store
- Stub modules:
  - ingestion
  - ocr
  - clause segmentation
  - risk scoring
  - summary generation

## Configuration contract
All pipeline behavior is centralized in:
- `app/config/analysis_config.json`

Covered by config:
- language behavior
- thresholds and timeouts
- lightweight/offload routing policy
- risk/dispute rules and localized texts
- fallback messages and templates
- service metadata

## Directory structure
- `app/main.py` - FastAPI entrypoint
- `app/api/routers/analysis.py` - API routes
- `app/schemas/analysis.py` - request/response and domain schemas
- `app/localization.py` - centralized locale normalization and localized value resolution
- `app/config/` - runtime config models/loader/payload
- `app/services/` - pipeline orchestration + stage stubs
- `tests/` - API-level contract tests for locale sync, job flow, and execution plan

## Run locally
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8010
```

## Example request
```bash
curl -X POST http://127.0.0.1:8010/analysis/run \
  -H "Content-Type: application/json" \
  -d '{
    "document_name": "contract.txt",
    "role_context": {"role": "executor", "counterparty_role": "employer"},
    "document_text": "Исполнитель обязан выполнить работы в срок 10 дней. Штраф за просрочку 1%.",
    "language": "fr"
  }'
```

## Notes
- This version still uses heuristic stubs and in-memory storage.
- Missing-job localization on GET endpoints can be overridden via query params `language` or `locale`.
- Responses include `execution_plan` so mobile/core-api can distinguish lightweight local-first vs server-assisted handling without schema branching.
- Production rollout requires persistent queue/store, robust OCR/NLP stack, and full integration tests.
