# Core-API Locale Contract Sync (analysis-engine)

## Scope
Defines locale compatibility between:
- `services/core-api`
- `services/analysis-engine`

## Supported locale set
Shared locale domain:
- `ru`
- `en`
- `it`
- `fr`

Default/fallback:
- `ru`

## Request contract (analysis run)
`analysis-engine` accepts both fields:
- `language` (primary)
- `locale` (core-api compatible alias)

Normalization rules:
1. If `locale` is provided, it has priority.
2. Else `language` is used.
3. Invalid or missing values fallback to `ru`.
4. After normalization, both values are synchronized to the same normalized locale.

## Response contract
`analysis-engine` returns both fields in all analysis endpoints:
- `/analysis/run`: `language`, `locale`
- `/analysis/{job_id}/status`: `language`, `locale`
- `/analysis/{job_id}/result`: `language`, `locale`, and `result.language`, `result.locale`

It also returns `execution_plan` on run/status/result responses, and inside `result.execution_plan` for completed jobs. This keeps lightweight/offload routing explicit without changing locale semantics.

This keeps backward compatibility with clients using either key.

## Error localization on read endpoints
For `404 job_not_found` on:
- `/analysis/{job_id}/status`
- `/analysis/{job_id}/result`

client may pass query `locale` or `language` to localize the error before a job context exists.

Read-time precedence:
1. `locale` query
2. `language` query
3. fallback `ru`

## Mapping guidance for core-api
Recommended canonical strategy in core-api:
1. Continue using `locale` as external DTO field.
2. Forward `locale` to analysis-engine.
3. Read `locale` from analysis-engine response as canonical, `language` as equivalent alias.

## Compatibility matrix
- core-api sends `locale`, no `language`: supported
- core-api sends `language`, no `locale`: supported
- core-api sends both with different values: `locale` wins
- core-api sends invalid value: fallback to `ru`

## Conformance tests to keep
1. `locale=IT` -> response locale/language both `it`
2. `language=EN` -> response locale/language both `en`
3. `locale=de` -> response locale/language both `ru`
4. No locale/language -> response locale/language both `ru`
5. `GET /analysis/missing/status?locale=en` -> `detail = "Analysis job was not found"`
