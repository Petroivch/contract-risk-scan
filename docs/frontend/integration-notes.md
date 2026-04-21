# Frontend Integration Notes

## Contracts (Mobile -> Core API)
- Language propagation:
  - Request headers: `Accept-Language`, `X-Client-Language`
  - Body: `language` in POST payloads
- Supported UI languages: `ru`, `en`, `it`, `fr`
- Fallback language: `ru`

## Local-First Contract
- Repository flow:
  1. request remote API
  2. cache successful response in SQLite
  3. on remote failure, return cached SQLite entity if exists
- Upload flow:
  1. select file with system document picker
  2. copy file into sandboxed local cache
  3. send upload request with file metadata and local file URI
  4. if upload fails, persist queued upload locally and expose queued status/history item
- Cached entities:
  - analysis status
  - report payload
  - history items
  - queued upload metadata

## Visual Contract
- Theme tokens + screen shells + reusable cards are centralized in `apps/mobile/src/theme` and `apps/mobile/src/components`.
- No screen-level hardcoded palette/typography constants.

## Build/Release Constraints
- No extra user downloads after installation.
- Total project release budget: `228 MB`.
- Frontend mobile expected share and optimization plan: `docs/frontend/package-size-optimization.md`.
