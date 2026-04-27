# Базовый quality baseline для Analysis Engine (Stage 1)

## Наша цель
Мы хотим определить минимальные, но достаточные требования к качеству и рамки безопасности (guardrails) для движка анализа рисков. Это наш ориентир до перехода к следующему этапу (model hardening).

## Метрики качества (MVP baseline)
1. Надежность API
- Мы ожидаем, что как минимум `99%` валидных запросов к `POST /analysis/run` будут успешными.
- Если что-то пошло не так (ответ отличный от 2xx), мы обязательно возвращаем понятную для системы ошибку (machine-readable).

2. Корректность жизненного цикла задачи
- Любая созданная задача должна гарантированно дойти до конечного статуса: `completed` или `failed`. Никаких зависаний.
- Мы используем строгий линейный переход статусов: `queued -> processing -> completed | failed`.

3. Валидность схемы ответа
- `100%` завершенных задач должны соответствовать `AnalysisResultResponse`
- все API-ответы обязаны содержать оба ключа для совместимости:
  - `language`
  - `locale`
- обязательные секции не должны одновременно быть пустыми:
  - `contract_brief`
  - `risks`
  - `role_focused_summary`

4. Качество locale behavior
- поддерживаемые языки: `ru`, `en`, `it`, `fr`
- невалидный/пустой locale -> fallback в `ru`
- `locale` и `language` синхронизированы во всех ответах
- read-endpoints обязаны поддерживать локализованный `404` через query `locale`/`language`
- покрытие локализованных полей для completed jobs должно быть `100%`:
  - `contract_brief`
  - risk `title`, `description`, `role_relevance`, `mitigation`
  - `dispute_reason`, `possible_consequence`
  - summary `overview` и fallback-элементы списков

5. Базовая точность извлечения рисков (эвристическая стадия)
- precision target для keyword/rules-first анализа на выборке договоров: `>= 0.6`
- recall target на Stage 1 пока не вводится

6. Качество role-focus
- `role_focused_summary.role` всегда совпадает с входной ролью
- хотя бы одна role-oriented рекомендация должна быть в `must_do` или `should_review`
- `contract_brief` должен объяснять, что важно для выбранной роли и по возможности показывать обязанности обеих сторон

7. Ограничение размера сборки и local-first quality
- вклад AI должен отслеживаться как доля общего build (`ai_assets_mb / total_build_mb`)
- пороги по доле AI:
  - pass: `<= 35%`
  - warning: `> 35%` и `<= 40%`
  - hard review: `> 40%`
- lightweight-first policy для AI-функций обязательна
- каждый analysis response должен содержать machine-readable `execution_plan`

8. Соответствие no-hardcode
- правила, тексты, пороги, timeout'ы и fallback'и приходят только из runtime config
- rule entries обязаны содержать `source_ref`
- загрузка конфига должна падать на неполных locale maps

## Guardrails
1. Безопасность и юридические границы
- сервис выдает индикаторы риска, а не юридическое заключение
- результат должен быть интерпретируемым и привязанным к текстовым фрагментам договора

2. Детерминированный fallback
- если не найдено ни одного risk/dispute marker, сервис все равно возвращает fallback-объекты, а не пустые массивы
- если locale невалиден, fallback всегда детерминированно идет в `ru`

3. Изоляция сбоев
- падение пайплайна должно ломать только конкретную задачу, а не весь процесс сервиса
- ошибка обязана сохраняться в job status

4. Input limits
- лимиты на размер текста и binary payload управляются только конфигом

5. Наблюдаемость (следующий этап)
- structured logs по шагам пайплайна с `job_id` и locale
- метрики latency по этапам: ingestion, OCR, segmentation, scoring, summary
- error taxonomy для основных классов сбоев
- size telemetry для AI-артефактов и общего app artifact

- первым offload'ится локальный semantic AI inference
- затем сокращаются расширенные OCR assets
- затем убираются вторичные AI enrichments
- deterministic local core должен сохраняться

## Ссылки на связанные документы
- `docs/backend-ai/on-device-offline-feasibility.md`
- `docs/backend-ai/no-hardcode-standard.md`
- `docs/backend-ai/rule-source-registry.md`
- `docs/backend-ai/core-api-locale-contract.md`

## Критерии завершения Stage 1
- endpoints отвечают по согласованному контракту
- pipeline stubs связаны end-to-end
- multilingual fallback поведение проверено (`invalid -> ru`)
- read-path error localization и lightweight/offload execution plan покрыты API-тестами
- доля AI в общем build измеряется и репортится
- no-hardcode policy обеспечивается конфигом и валидацией
- quality baseline согласован с backend/core-api/mobile интеграцией
