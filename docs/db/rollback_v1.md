# Откат: v1__init_schema.sql

## Когда использовать
- Неверная первичная инициализация схемы.
- Полный откат MVP-схемы до пустой БД.

## Важно
- Сначала выполните бэкап.
- Выполняйте откат в транзакции в непиковое время.

## SQL для отката v1
```sql
BEGIN;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS summaries;
DROP TABLE IF EXISTS disputed_clauses;
DROP TABLE IF EXISTS risk_items;
DROP TABLE IF EXISTS analysis_jobs;
DROP TABLE IF EXISTS contracts;
DROP TABLE IF EXISTS role_profiles;
DROP TABLE IF EXISTS users;

-- Опционально: только если extension не используется в других схемах.
DROP EXTENSION IF EXISTS pgcrypto;

COMMIT;
```

## Проверка
```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Ожидание: таблицы MVP отсутствуют.
