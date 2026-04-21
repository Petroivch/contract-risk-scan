# Архитектура local-first (frontend MVP)

## Цель
Обеспечить устойчивый mobile UX при нестабильной сети, не меняя backend-контракт.

## Стек хранения
1. SQLite (обязателен)
   - Таблицы: кэш status, кэш report, кэш history, очередь upload, миграции схемы
   - Миграции запускаются при старте приложения через `SQLiteLocalCache.initialize()`
2. File cache (helper)
   - Хранит локальные файлы, когда они нужны сценариям upload/report
   - Изолированная директория кэша внутри sandbox приложения

## Поток данных
1. Экран вызывает API interface (`useApiClient`).
2. `LocalFirstAdapter` сначала выполняет remote request.
3. При успехе:
   - ответ сохраняется в SQLite-кэш
   - ответ возвращается в UI
4. При ошибке:
   - adapter пытается взять fallback из SQLite для status/report/history
   - если cached payload есть, он возвращается в UI
5. Для новых загрузок:
   - документ выбирается через системный picker
   - файл копируется в app-local cache directory
   - если upload не удается и local file существует, adapter создает локальный queued analysis item
   - queued item сохраняется в SQLite и отображается как `queued`

## Стратегия миграций
- Таблица `schema_migrations` отслеживает примененные migration ID.
- Миграции идут по порядку и должны быть идемпотентными.
- Новые изменения схемы в MVP только добавочные (`v1`, `v2`, ...).

## Ожидания по offline для MVP
- История и ранее полученные отчеты/status доступны offline.
- Новая загрузка может быть сохранена локально и преобразована в queued work item, если remote upload недоступен.
- Queued item сейчас сохраняет метаданные файла, cached file URI, роль, язык и синтетический queued status.
- Автоматический replay queued uploads остается задачей следующего шага.

## TODO на следующий инкремент
- Worker для автоматического replay queued uploads после восстановления connectivity.
- TTL и eviction policy для старых строк кэша.
- Разрешение конфликтов для устаревших report/status версий.
- Encryption-at-rest для чувствительных cached payload.
