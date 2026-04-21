# Local-First Architecture (Frontend MVP)

## Goal
Provide resilient mobile UX when network is unstable while keeping backend contract unchanged.

## Storage Stack
1. SQLite (mandatory)
   - Tables: status cache, report cache, history cache, upload queue, schema migrations
   - Migrations run on app start via `SQLiteLocalCache.initialize()`
2. File cache (helper)
   - Stores local file artifacts when needed by upload/report flows
   - Isolated cache directory in app sandbox

## Data Flow
1. Screen calls API interface (`useApiClient`).
2. `LocalFirstAdapter` executes remote request first.
3. On success:
   - response is persisted to SQLite cache
   - response is returned to UI
4. On failure:
   - adapter attempts SQLite fallback for status/report/history
   - cached payload is returned if available
5. For new uploads:
   - document is selected via system picker
   - file is copied into app-local cache directory
   - if upload request fails and local file exists, adapter creates queued local analysis item
   - queued item is persisted to SQLite and shown as `queued`

## Migration Strategy
- `schema_migrations` table tracks applied migration IDs.
- Migrations are ordered and idempotent.
- New schema changes are additive in MVP (`v1`, `v2`, ...).

## Offline Expectations for MVP
- History and previously fetched reports/status are available offline.
- New upload can be captured locally and converted into queued work item when immediate remote upload is unavailable.
- Queued item currently preserves file metadata, cached file URI, role, language, and synthetic queued status.
- Automatic replay of queued uploads is still a next-step item.

## TODO (next increment)
- Automatic replay worker for queued uploads when connectivity returns.
- TTL and eviction policy for old cache rows.
- Conflict resolution for stale report/status versions.
- Encryption-at-rest for sensitive cached payloads.
