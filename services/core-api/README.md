# Contract Risk Scanner: Core API (NestJS)

`core-api` обслуживает мобильный клиент Contract Risk Scanner и связывает upload/analyze/status/report/history с `analysis-engine`.

## Что уже реализовано
- persistent-контур для договоров: метаданные и загруженные файлы сохраняются локально на диске;
- `POST /contracts/upload` сразу запускает анализ после успешного сохранения файла;
- `POST /contracts/{id}/analyze` поддерживает повторный запуск анализа и смену `locale`;
- `GET /contracts/{id}/status` и `GET /contracts/history` синхронизируют состояние с `analysis-engine`;
- `GET /contracts/{id}/report` отдает сохраненный отчет в mobile-friendly форме;
- поддержка языков `ru | en | it | fr` с `ru` по умолчанию и fallback на `ru`;
- local-first friendly контракт: backend не нужен для запуска приложения и просмотра уже закешированной истории на устройстве;
- все runtime-параметры вынесены в конфиг, без хардкода URL, лимитов и секретов.

## Что еще упрощено
- `auth` пока остается упрощенным контуром без production-ready persistence;
- качество анализа и итоговый контент полностью зависят от доступности `analysis-engine`.

## Структура
- `src/auth/**` - временный auth-контур.
- `src/contracts/**` - upload/analyze/status/report/history, файловое хранилище и интеграция с `analysis-engine`.
- `src/common/i18n/**` - enum языков, нормализация и fallback.
- `src/common/policies/**` - централизованные runtime/domain policy.
- `src/config/**` - типизированный конфиг и разбор env.
- `openapi/contract-risk-scanner-mvp.yaml` - актуальный OpenAPI-контракт.

## Как работает flow договора
1. Клиент отправляет `multipart/form-data` на `POST /contracts/upload`.
2. `core-api` валидирует MIME type и размер файла.
3. Файл сохраняется в локальное storage-хранилище, рядом сохраняется JSON-метадата договора.
4. `core-api` автоматически вызывает `analysis-engine` и получает `job_id`.
5. Статус анализа периодически синхронизируется с `analysis-engine`.
6. После завершения итоговый отчет нормализуется в формат mobile UI и сохраняется локально.
7. История и отчет переживают рестарт `core-api`, потому что лежат на диске.

Текущее соответствие идентификаторов:
- `contractId` - основной идентификатор договора;
- `analysisId` - пока равен `contractId`, чтобы мобильному клиенту не приходилось держать второй внешний id;
- `analysisJobId` - внутренний id job в `analysis-engine`, хранится только внутри `core-api`.

## Storage-модель
По умолчанию данные пишутся в:

```text
.runtime/core-api-data/
```

Структура:
- `.runtime/core-api-data/contracts/*.json` - сохраненные метаданные и отчет;
- `.runtime/core-api-data/uploads/*` - исходные файлы договоров.

Путь можно переопределить через `DATA_DIR`.

## Быстрый старт
Требования:
- `Node.js 20+`
- доступный `analysis-engine` по `ANALYSIS_ENGINE_BASE_URL`

Шаги:
1. Откройте папку `services/core-api` в VS Code.
2. Создайте `.env` на основе `.env.example`.
3. Установите зависимости:

```bash
npm install
```

4. Запустите dev-сервер:

```bash
npm run start:dev
```

Swagger поднимается по пути из `SWAGGER_PATH` (`api/docs` по умолчанию).

## Ключевые переменные окружения
- `JWT_SECRET` - обязателен, placeholder запрещен.
- `MAX_UPLOAD_SIZE_MB` - лимит размера загружаемого файла.
- `ALLOWED_MIME_TYPES` - допустимые MIME type. Текущий default: `pdf`, `docx`, `text/plain`.
- `DATA_DIR` - каталог локального persistence.
- `ANALYSIS_ENGINE_ENABLED` - включение/отключение внешнего анализа.
- `ANALYSIS_ENGINE_BASE_URL` - адрес `analysis-engine`.
- `ANALYSIS_ENGINE_REQUEST_TIMEOUT_MS` - timeout HTTP-запроса к `analysis-engine`.
- `ANALYSIS_ENGINE_POLL_INTERVAL_MS` - интервал фонового polling.
- `ANALYSIS_ENGINE_MAX_POLLING_DURATION_MS` - максимальное окно ожидания результата.

## Smoke-check после сборки
Минимальный smoke:

```bash
npm run build
```

Для runtime-smoke:
1. поднимите `analysis-engine`,
2. запустите `core-api`,
3. отправьте тестовый `txt/pdf/docx` в `POST /contracts/upload`,
4. проверьте `status -> report -> history`.

## Примечания по mobile-контракту
- ответы `upload/analyze/status/history` теперь содержат:
  - `analysisId`
  - `status` (`queued | processing | completed | failed`)
  - `pipelineStatus`
  - `selectedRole`
  - `progress`
- ответ `report` содержит:
  - `summary` как объект,
  - `summaryText`,
  - `risks[]`,
  - `disputedClauses[]`,
  - `obligations[]`,
  - `generatedAt`,
  - `generationNotes`.
