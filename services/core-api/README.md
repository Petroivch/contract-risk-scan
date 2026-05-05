# Core API

NestJS API для Android-клиента. Сервис принимает документ, вызывает `analysis-engine`, отслеживает статус и отдает нормализованный отчет.

Swagger UI из рабочего контура убран. `core-api` используется как JSON API для мобильного приложения.

## Основные маршруты

- `POST /auth/register`
- `POST /auth/login`
- `POST /contracts/upload`
- `POST /contracts/{id}/analyze`
- `GET /contracts/{id}/status`
- `GET /contracts/{id}/report`
- `GET /contracts/history`

## Быстрый старт

```powershell
cd services\core-api
npm ci
npm run lint
npm run test
npm run build
npm run start:dev
```

Перед запуском нужен доступный `analysis-engine` по `ANALYSIS_ENGINE_BASE_URL`.

## Хранение

По умолчанию данные лежат в:

```text
.runtime/core-api-data/
```

- `contracts/*.json` - метаданные и отчет
- `uploads/*` - исходные загруженные файлы

Путь переопределяется через `DATA_DIR`.

## Основные env-переменные

- `JWT_SECRET`
- `PORT`
- `API_PREFIX`
- `PUBLIC_BASE_URL`
- `MAX_UPLOAD_SIZE_MB`
- `ALLOWED_MIME_TYPES`
- `DATA_DIR`
- `ANALYSIS_ENGINE_ENABLED`
- `ANALYSIS_ENGINE_BASE_URL`
- `ANALYSIS_ENGINE_REQUEST_TIMEOUT_MS`
- `ANALYSIS_ENGINE_POLL_INTERVAL_MS`
- `ANALYSIS_ENGINE_MAX_POLLING_DURATION_MS`

## Проверки

- `npm run lint`
- `npm run test`
- `npm run build`
