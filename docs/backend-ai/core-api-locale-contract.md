# Синхронизация locale-контракта с core-api (analysis-engine)

## Область документа
Документ фиксирует совместимость по locale/language между:
- `services/core-api`
- `services/analysis-engine`

## Поддерживаемые языки
Общий набор языков:
- `ru`
- `en`
- `it`
- `fr`

Язык по умолчанию и fallback:
- `ru`

## Контракт входящего запроса
`analysis-engine` принимает оба поля:
- `language` — основное поле
- `locale` — alias для совместимости с `core-api`

Правила нормализации:
1. Если передан `locale`, приоритет у него.
2. Иначе используется `language`.
3. Если значение невалидно или отсутствует, сервис принудительно делает fallback в `ru`.
4. После нормализации оба поля синхронизируются и содержат одно и то же нормализованное значение.

## Контракт ответов
`analysis-engine` возвращает оба поля во всех analysis endpoints:
- `POST /analysis/run` -> `language`, `locale`
- `GET /analysis/{job_id}/status` -> `language`, `locale`
- `GET /analysis/{job_id}/result` -> `language`, `locale`, а также `result.language`, `result.locale`

Дополнительно сервис возвращает `execution_plan`:
- в `run`
- в `status`
- в `result`
- в `result.execution_plan` для завершенных задач

Это позволяет mobile/core-api различать `local_first` и `server_assist`, не вводя отдельный ответный контракт.

## Локализация ошибок read-path
Для `404 job_not_found` на endpoint'ах:
- `GET /analysis/{job_id}/status`
- `GET /analysis/{job_id}/result`

клиент может передать query-параметр `locale` или `language`, чтобы локализовать ошибку еще до появления job context.

Приоритет на чтении:
1. `locale`
2. `language`
3. fallback `ru`

## Рекомендации для core-api
Каноническая стратегия для `core-api`:
1. Продолжать использовать `locale` как внешнее DTO-поле.
2. Прокидывать `locale` в `analysis-engine` без переименования.
3. Читать `locale` из ответа как каноническое значение, а `language` считать эквивалентным alias.

## Матрица совместимости
- core-api отправляет только `locale` -> поддерживается
- core-api отправляет только `language` -> поддерживается
- core-api отправляет оба поля с разными значениями -> побеждает `locale`
- core-api отправляет невалидный язык -> ответ принудительно переходит на `ru`

## Обязательные тесты на совместимость
1. `locale=IT` -> ответ содержит `language=it`, `locale=it`
2. `language=EN` -> ответ содержит `language=en`, `locale=en`
3. `locale=de` -> ответ содержит `language=ru`, `locale=ru`
4. Без `locale/language` -> ответ содержит `language=ru`, `locale=ru`
5. `GET /analysis/missing/status?locale=en` -> `detail = "Analysis job was not found"`
