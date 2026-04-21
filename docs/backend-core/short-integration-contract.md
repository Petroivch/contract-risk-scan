# Short Integration Contract (Frontend + Backend-AI)

## Scope
This is the minimal cross-team contract for mobile frontend and analysis-engine integration.

## Locale rules
- Allowed locale values: `ru | en | it | fr`
- Default locale: `ru`
- Fallback: invalid or missing `locale/language` -> `ru`

## Endpoints used by mobile
1. `POST /auth/register`
2. `POST /auth/login`
3. `POST /contracts/upload` (multipart: `role`, optional `locale/language`, optional `counterpartyRole`, optional `contractLabel`, `file`)
4. `POST /contracts/{id}/analyze` (optional `locale/language`, optional `focusNotes`, optional `forceReanalyze`)
5. `GET /contracts/{id}/status`
6. `GET /contracts/{id}/report`
7. `GET /contracts/history`

## Required response fields for mobile rendering
- Upload/analyze/status/history/report must include `locale`.
- Report must include: `summary`, `obligations[]`, `risks[]`, `disputedClauses[]`, `generatedAt`.
- Status must include: `status`, `allowedTransitions`, `updatedAt`, optional `errorCode/errorMessage`.

## Analysis-engine input contract (from core-api)
Payload passed by core-api:
- `contractId: string`
- `role: string`
- `counterpartyRole?: string`
- `locale: ru|en|it|fr` (already normalized)
- `focusNotes?: string`

## Analysis-engine output contract (to core-api)
Core-api expects structured report payload:
- `contractId`
- `locale`
- `roleFocus`
- `summary`
- `obligations[]`
- `risks[]` where `severity` in `low|medium|high|critical`
- `disputedClauses[]`
- `generatedAt`
- `generationNotes`

## Non-functional constraints
- No model/runtime artifact downloads on mobile after install.
- Heavy OCR/NLP/model assets remain backend-side.
- Mobile flow remains local-first; backend improves sync/analysis but is not app-boot dependency.