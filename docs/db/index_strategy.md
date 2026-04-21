# Index Strategy (Server + Mobile)

## 1. Цель
- Обеспечить быстрые запросы для mobile flow:
  - история договоров;
  - статус анализа;
  - отчет (риски/спорные пункты/summary);
  - фильтрация по языкам.

## 2. Server-side индексы (PostgreSQL)
1. Contracts:
- `idx_contracts_user_uploaded_at`
- `idx_contracts_status_uploaded_at`
- `idx_contracts_active_user`
- `idx_contracts_language_uploaded_at`

2. Analysis jobs:
- `idx_analysis_jobs_contract_created`
- `idx_analysis_jobs_status_created`
- `idx_analysis_jobs_requested_by_created`
- `idx_analysis_jobs_queue`
- `idx_analysis_jobs_report_language_created`

3. Report blocks:
- `idx_risk_items_job_severity`
- `idx_risk_items_contract_severity`
- `idx_disputed_clauses_job`
- `idx_disputed_clauses_contract`
- `idx_summaries_contract_id`
- `idx_summaries_report_language`

4. Config/lookup:
- `uq_language_catalog_single_default`

## 3. Mobile local DB (offline-first)
- На устройстве держать минимальный набор индексов для:
  - списка договоров;
  - поиска по статусу/дате;
  - открытия последнего отчета.
- Не копировать все server-side индексы в локальную БД.

## 4. Политика без хардкода
- Индекс-политика хранится в документации и миграциях.
- Если добавляется новый индекс:
  - обосновать паттерном запроса;
  - добавить проверку в review;
  - обновить этот документ.

## 5. Контроль качества
- Каждые 2 спринта:
  - пересмотр `EXPLAIN ANALYZE` топ-запросов;
  - удаление неиспользуемых индексов;
  - оценка write-cost и bloat.
