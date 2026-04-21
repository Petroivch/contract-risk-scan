# Contract Risk Scanner - Core API (NestJS)

Core API for Contract Risk Scanner mobile clients and backend-ai integration.

## Stage-1 scope
- NestJS skeleton with module structure.
- OpenAPI draft for MVP endpoints.
- Controllers + DTO validation + job status orchestration.
- Multilingual locale contract (`ru|en|it|fr`, default/fallback `ru`).
- Local-first and release-size integration docs.

## Project structure
- `src/auth/**` - registration/login stubs.
- `src/contracts/**` - upload/analyze/status/report/history endpoints.
- `src/common/i18n/**` - locale enum + normalization/fallback.
- `src/common/policies/**` - centralized runtime and domain policies.
- `src/config/**` - typed runtime config.
- `openapi/contract-risk-scanner-mvp.yaml` - API draft.

## Quick start (VS Code)
1. Open folder: `services/core-api`
2. Create local env file from `.env.example`
3. Install deps:
   ```bash
   npm install
   ```
4. Run dev server:
   ```bash
   npm run start:dev
   ```

Swagger URL is config-driven by `SWAGGER_PATH` (default `api/docs`).

## Configuration policy
- No runtime URL/secret/limits are hardcoded in service logic.
- Required secret: `JWT_SECRET` (placeholder value is rejected at runtime).
- Upload limits/mime policy and API URL pathing are controlled via env config.

## Notes
- Business logic is still stubbed for stage-1.
- Auth token and analysis output are mock implementations.
- File persistence/DB/worker integration are next-stage items.