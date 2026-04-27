# Политика жизненного цикла данных (Local-First + Config-Driven)

## 1. Принцип
- Политики хранения и лимиты не хардкодятся в приложении.
- Все значения берутся из `app_config` и документируются.

## 2. Ключевые policy-ключи
- `data.retention.contract_hard_delete_days`
- `data.retention.audit_logs_days`
- `mobile.cache.max_contracts`

Значения по умолчанию см. в `docs/db/config_registry.md`.

## 3. Классы данных
1. Профиль и настройки:
- `users`, `role_profiles`

2. Договоры и анализ:
- `contracts`, `analysis_jobs`, `risk_items`, `disputed_clauses`, `summaries`

3. Аудит:
- `audit_logs`

4. Конфигурация:
- `app_config`, `language_catalog`

## 4. Хранение и очистка
1. `contracts`:
- soft delete через `deleted_at`;
- hard delete по policy `data.retention.contract_hard_delete_days`.

2. `analysis_jobs` и связанный отчет:
- живут вместе с договором через каскадные связи.

3. `audit_logs`:
- TTL по policy `data.retention.audit_logs_days`.

4. Local-first кэш:
- лимит локального кэша договоров по `mobile.cache.max_contracts`;
- политика вытеснения LRU/TTL задается в клиентской реализации.

## 5. Мультиязычность и locale
1. Поддерживаемые языки:
- задаются `language_catalog` как active set.

2. Default/fallback:
- `app_config.language.default` и `language_catalog.is_default`.

3. `users.locale` и `users.timezone`:
- defaults задаются через `app_config.locale.default` и `app_config.timezone.default`.

## 6. Наблюдаемость
- Контроль размера локальной БД и файлового хранилища на устройстве.
- Контроль доли fallback на default-language.
