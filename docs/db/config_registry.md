# Реестр конфигов и инварианты

## 1. Назначение
- Убрать magic numbers и дубли enum/политик из кода.
- Обеспечить единый источник значений через `app_config` и `language_catalog`.

## 2. Базовые ключи `app_config`
1. Язык и локаль:
- `language.default` = `"ru"`
- `language.supported` = `["ru","en","it","fr"]`
- `locale.default` = `"ru-RU"`
- `timezone.default` = `"Europe/Moscow"`

2. Анализ и миграции:
- `analysis.priority.min` = `1`
- `analysis.priority.max` = `9`
- `migration.runtime_budget_ms` = `500`
- `migration.max_complex_ops_per_release` = `1`

3. Retention:
- `data.retention.contract_hard_delete_days` = `30`
- `data.retention.audit_logs_days` = `365`
- `mobile.cache.max_contracts` = `50`

4. Release size:
- `build.final_release_size_limit_mb` = `228`
- `build.db_contribution_target_mb` = `35`
- `build.db_contribution_hard_cap_mb` = `40`

## 3. Инварианты
1. `app_config.key` соответствует шаблону `^[a-z0-9._-]+$`.
2. `value_json` строго соответствует `value_type`.
3. `language_catalog` хранит активный whitelist языков.
4. В `language_catalog` только один `is_default = true`.
5. `users`, `analysis_jobs`, `summaries`, `contracts` ссылаются на `language_catalog(code)` через FK.

## 4. Runtime-функции
1. `get_default_language_code()`:
- определяет default-язык из `language_catalog`.

2. `normalize_supported_language(input_lang)`:
- приводит `NULL` и невалидные значения к default-языку.

3. `get_config_string(cfg_key)`:
- получает строковые default-значения (`locale` и `timezone`) из `app_config`.

## 5. Правила изменения конфигов
1. Все новые лимиты добавлять через `app_config` и миграцию.
2. Любой новый enum-set хранить в lookup-table, либо документировать как schema-level type.
3. Изменения обязательно синхронизировать с `docs/db/api_contract_impact.md`.
