# Backend Core Integration Notes (production alignment)

## Current architecture status
- Core API skeleton is in place with NestJS modules, DTO validation, OpenAPI draft, and job status orchestration.
- Locale policy is centralized and reused by upload/analyze/report flow.
- Runtime policy is config-driven: no environment-specific URL/secret/limits are hardcoded in code paths.

## Mandatory constraints captured
- Local-first mobile behavior: app works from device storage first, backend is optional enhancer.
- Mobile user should not install/download runtime bundles besides store release build.
- Heavy ML artifacts stay server-side only.
- Global release-package budget: total deliverable size must remain `<= 228 MB`.

## No-hardcode standard implementation
Centralized policy/config points:
- `src/common/i18n/supported-locale.enum.ts`
- `src/common/i18n/locale.utils.ts`
- `src/common/policies/*.policy.ts`
- `src/config/configuration.ts`
- `src/config/app-config.type.ts`

Runtime-configured values:
- API prefix, public base URL, swagger path/title/version
- JWT secret and token TTL
- Upload limits and allowed mime types
- Token type

## Locale contract (centralized)
- Supported: `ru`, `en`, `it`, `fr`
- Default: `ru`
- Fallback rule: any missing/unsupported `locale`/`language` is normalized to `ru`
- Normalization point: `normalizeLocale(...)`

Locale propagation path:
1. `POST /contracts/upload` stores normalized locale with contract metadata.
2. `POST /contracts/{id}/analyze` accepts locale override and re-normalizes.
3. Core API passes normalized locale to analysis-engine payload.
4. `status/report/history` include locale in response model.

## Local-first + minimal server role
Minimal server role for release profile:
- optional auth/sync transport,
- heavy analysis orchestration (OCR/NLP/risk extraction),
- compact JSON report generation for mobile UI.

Server is not mandatory for app startup and local history browsing.

## Total budget accounting (228 MB)
Budget formula:
`TotalReleaseSize = AndroidRelease + iOSRelease + BackendReleaseBundle + SharedRuntimeAssets`

Count in budget:
- distributed `.aab/.apk`, `.ipa`, and backend artifacts if shipped in the same release kit.

Exclude from budget:
- source code, CI cache, runtime logs/data, and external artifacts not bundled in release kit.

## If total release size exceeds 228 MB
Backend-oriented options:
1. Managed backend profile: exclude backend binaries from release kit, ship only mobile + endpoint config.
2. Thin core-api profile: ship manifests only, pull backend images at deploy time.
3. Split analysis profile: keep core-api lightweight, move OCR/NLP to separate backend-ai service.
4. Cloud heavy-compute profile: disable offline deep analysis, cache compact reports locally.
5. Hard CI gate: fail release when computed `TotalReleaseSize > 228 MB`.

## Contract source of truth
- OpenAPI: `services/core-api/openapi/contract-risk-scanner-mvp.yaml`
- Short contract for teams: `docs/backend-core/short-integration-contract.md`

## Stage-1 stubs still present
- Mock auth token generation.
- In-memory storage (no DB persistence yet).
- Sync stub analysis pipeline (no external AI worker yet).