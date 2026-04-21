# Contract Risk Scanner DB Docs

## 1. Актуальный стек требований
- Mobile app (Android + iOS), `offline-first`.
- Мультиязычность: `ru`, `en`, `it`, `fr`, default/fallback `ru`.
- Стандарт качества: `no hardcode` (константы/лимиты/политики через schema + config registry + docs).
- Общий лимит финального релизного комплекта: `228 МБ`.

## 2. DB-артефакты
- `db/migrations/v1__init_schema.sql` — базовая схема MVP.
- `db/migrations/v2__optimization_and_guards.sql` — индексы, guardrails, триггеры `updated_at`.
- `db/migrations/v3__language_support.sql` — языковые поля и fallback на `ru`.
- `db/migrations/v4__config_registry_and_invariants.sql` — конфигурационный реестр, language catalog, строгие инварианты.
- `db/schema_mvp.sql` — снимок схемы после `v1..v4`.

## 3. Документация для интеграции
- `docs/db/api_contract_impact.md` — API-контракты для Backend/Frontend.
- `docs/db/local_first_architecture.md` — архитектура local-first (что локально, что серверно-опционально).
- `docs/db/release_size_budget_db_contribution.md` — общий budget 228 МБ и вклад DB-части.
- `docs/db/config_registry.md` — реестр конфиг-ключей и инвариантов.
- `docs/db/index_strategy.md` — индексация (server + mobile).
- `docs/db/data_lifecycle_policy.md` — хранение/очистка данных и retention.

## 4. Rollback
- `docs/db/rollback_v1.md`
- `docs/db/rollback_v2.md`
- `docs/db/rollback_v3.md`
- `docs/db/rollback_v4.md`

## 5. Порядок применения миграций локально
```powershell
createdb contract_risk_scanner
psql -v ON_ERROR_STOP=1 -d contract_risk_scanner -f db/migrations/v1__init_schema.sql
psql -v ON_ERROR_STOP=1 -d contract_risk_scanner -f db/migrations/v2__optimization_and_guards.sql
psql -v ON_ERROR_STOP=1 -d contract_risk_scanner -f db/migrations/v3__language_support.sql
psql -v ON_ERROR_STOP=1 -d contract_risk_scanner -f db/migrations/v4__config_registry_and_invariants.sql
```

## 6. Быстрая проверка consistency
```powershell
psql -d contract_risk_scanner -c "SELECT key, value_json FROM app_config ORDER BY key;"
psql -d contract_risk_scanner -c "SELECT code, is_default, is_active FROM language_catalog ORDER BY code;"
psql -d contract_risk_scanner -c "SELECT column_name, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name IN ('preferred_language','locale','timezone') ORDER BY column_name;"
psql -d contract_risk_scanner -c "SELECT column_name, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='analysis_jobs' AND column_name='report_language';"
```

Ожидания:
- Есть `app_config` и `language_catalog`.
- В `language_catalog` доступно `ru/en/it/fr`, default — `ru`.
- Языковые поля (`preferred_language`, `report_language`, `contracts.language_code`) согласованы.
- Поля `users.locale`, `users.timezone` имеют конфигурируемые default-значения.
