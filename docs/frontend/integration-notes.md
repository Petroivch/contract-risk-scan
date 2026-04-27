# Заметки по интеграции фронтенда

## Контракты (mobile -> core API)
- Передача языка:
  - Заголовки запроса: `Accept-Language`, `X-Client-Language`
  - Тело запроса: `language` в POST payload
- Поддерживаемые языки интерфейса: `ru`, `en`, `it`, `fr`
- Язык fallback: `ru`

## Контракт local-first
- Поток репозитория:
  1. запрос к remote API
  2. сохранение успешного ответа в SQLite-кэш
  3. при ошибке remote-запроса возврат cached SQLite entity, если она есть
- Поток загрузки:
  1. выбор файла через системный document picker
  2. копирование файла в sandboxed local cache
  3. отправка upload-запроса с метаданными файла и local file URI
  4. если upload не удался, сохранить queued upload локально и показать состояние queued/history item
- Кэшируемые сущности:
  - status анализа
  - payload отчета
  - элементы истории
  - метаданные queued upload

## Визуальный контракт
- Токены темы, screen shells и reusable cards централизованы в `apps/mobile/src/theme` и `apps/mobile/src/components`.
- В screen-level коде не должно быть жестко заданной палитры или типографики.

## Ограничения сборки и релиза
- После установки пользователю не нужны дополнительные загрузки.
- Ожидаемый вклад mobile и план оптимизации: `docs/frontend/package-size-optimization.md`.
