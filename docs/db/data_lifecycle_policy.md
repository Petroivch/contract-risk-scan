# Политика жизненного цикла данных (Local-First + Config-Driven)

## 1. Принцип
- Политики хранения и лимиты не хардкодятся в приложении.
- Документация должна различать текущий runtime и потенциальную целевую архитектуру.
- Сейчас mobile runtime по умолчанию использует backend-first HTTP path: app-managed SQLite/file cache не создаются, а `core-api` держит сырой файл договора только in-memory на время анализа.

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

4. Mobile runtime:
- языковая настройка сохраняется в AsyncStorage;
- app-managed SQLite cache и файловый cache в текущем runtime выключены feature flags;
- временные копии чтения документа могут появляться в рамках системного picker/runtime-сценария и считаются временными, а не каноническим хранилищем договоров.

5. Backend processing:
- при использовании `core-api` исходный файл договора держится в оперативной памяти только на время активного анализа;
- итоговый нормализованный отчет остается в памяти процесса как runtime state и не должен описываться как device-only `no-history` behavior мобильного клиента;
- если позже появится отдельное persisted storage для backend, его нужно документировать как новый режим хранения, а не как часть текущего runtime.

## 5. Мультиязычность и locale
1. Поддерживаемые языки:
- задаются `language_catalog` как active set.

2. Default/fallback:
- `app_config.language.default` и `language_catalog.is_default`.

3. `users.locale` и `users.timezone`:
- defaults задаются через `app_config.locale.default` и `app_config.timezone.default`.

## 6. Наблюдаемость
- Контроль объема временных runtime-артефактов backend и мобильной сборки, если backend включен.
- Контроль временных runtime-артефактов mobile-сборки и локальных build outputs.
- Контроль доли fallback на default-language.
