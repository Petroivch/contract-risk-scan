# Local-First Data Architecture (Mobile)

## 1. Архитектурный принцип
- Базовый пользовательский сценарий должен работать офлайн.
- Пользователь устанавливает только релизную сборку.
- Серверная синхронизация опциональна и прозрачна.

## 2. Что обязательно локально на устройстве
1. Пользовательские настройки:
- `preferred_language`, `locale`, `timezone`, текущая роль.

2. Метаданные договоров:
- id, имя, hash, язык, статусы, timestamps.

3. Результаты анализа:
- summary, risk items, disputed clauses, язык отчета.

4. Локальная очередь синхронизации:
- outbox для отложенной отправки изменений при появлении сети.

## 3. Что серверно-опционально
1. Резервная копия и кросс-девайс синхронизация.
2. Централизованный аудит.
3. Расширенная аналитика при наличии сети.

## 4. Политики без хардкода
- Лимиты/политики задаются через `app_config`, не через magic numbers в коде.
- Ключи:
  - `mobile.cache.max_contracts`
  - `migration.runtime_budget_ms`
  - `data.retention.contract_hard_delete_days`
  - `data.retention.audit_logs_days`
  - `language.default`, `language.supported`
  - `locale.default`, `timezone.default`

## 5. Ограничения для миграций на устройстве
1. Additive-first изменения.
2. Минимум тяжелых rewrite-операций.
3. Backfill только фоново и чанками.
4. Контроль времени миграции по `migration.runtime_budget_ms`.

## 6. Общий release budget
- Контроль на уровне финального релизного комплекта.
- Глобальный лимит задается ключом `build.final_release_size_limit_mb` (текущий default: 228).
- Вклад DB-части контролируется ключами:
  - `build.db_contribution_target_mb`
  - `build.db_contribution_hard_cap_mb`

Подробности в `docs/db/release_size_budget_db_contribution.md`.

## 7. Критерии приемки
1. Offline flow работает: роль -> загрузка -> анализ -> отчет.
2. Язык/локаль консистентны в API и БД.
3. Никакого хардкода лимитов и enum в мобильном коде.
4. Синхронизация не обязательна для базового использования.
