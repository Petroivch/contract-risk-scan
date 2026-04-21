# Короткий интеграционный контракт: mobile + core-api + analysis-engine

## Область действия
Это краткий контракт между мобильным клиентом, `core-api` и `analysis-engine` для MVP-потока анализа договора.

## Правила по языкам
- допустимые значения: `ru | en | it | fr`;
- default: `ru`;
- fallback: любое невалидное или пустое `locale/language` приводится к `ru`.

## Эндпоинты, которые использует mobile
1. `POST /auth/register`
2. `POST /auth/login`
3. `POST /contracts/upload`
4. `POST /contracts/{id}/analyze`
5. `GET /contracts/{id}/status`
6. `GET /contracts/{id}/report`
7. `GET /contracts/history`

## Семантика upload/analyze
### `POST /contracts/upload`
Request:
- `multipart/form-data`
- обязательные поля:
  - `role`
  - `file`
- опциональные поля:
  - `locale`
  - `language` (deprecated alias)
  - `counterpartyRole`
  - `contractLabel`

Поведение:
- `core-api` сохраняет файл локально;
- автоматически стартует анализ;
- возвращает внешний `analysisId` сразу в ответе.

### `POST /contracts/{id}/analyze`
Request:
- опциональные поля:
  - `locale`
  - `language` (deprecated alias)
  - `focusNotes`
  - `forceReanalyze`

Поведение:
- если анализ уже идет, возвращается текущее состояние;
- если отчет уже готов и `forceReanalyze=false`, возвращается готовое состояние;
- если `forceReanalyze=true`, запускается новый проход анализа.

## Поля, обязательные для mobile-рендера
### Upload response
- `contractId`
- `analysisId`
- `status`
- `pipelineStatus`
- `locale`
- `selectedRole`
- `progress`
- `originalFileName`
- `uploadedAt`

### Analyze response
- `contractId`
- `analysisId`
- `status`
- `pipelineStatus`
- `locale`
- `selectedRole`
- `progress`
- `message`

### Status response
- `contractId`
- `analysisId`
- `status`
- `pipelineStatus`
- `locale`
- `selectedRole`
- `progress`
- `allowedTransitions`
- `updatedAt`
- опционально `errorCode`
- опционально `errorMessage`

### History item
- `contractId`
- `analysisId`
- `role`
- `selectedRole`
- `locale`
- `status`
- `pipelineStatus`
- `originalFileName`
- `fileName`
- `uploadedAt`
- `createdAt`
- `updatedAt`

### Report response
- `contractId`
- `analysisId`
- `locale`
- `roleFocus`
- `selectedRole`
- `summary` как объект:
  - `title`
  - `contractType`
  - `shortDescription`
  - `obligationsForSelectedRole[]`
- `summaryText`
- `obligations[]`
- `risks[]`
- `disputedClauses[]`
- `generatedAt`
- `generationNotes`

## Нормализованные lifecycle-статусы для mobile
- `queued`
- `processing`
- `completed`
- `failed`

## Внутренние pipeline-статусы backend
- `uploaded`
- `queued`
- `preprocessing`
- `analyzing`
- `report_ready`
- `failed`

## Контракт между core-api и analysis-engine
### Что core-api передает в analysis-engine
- `document_name`
- `role_context.role`
- `role_context.counterparty_role`
- `language`
- `locale`
- одно из:
  - `document_text` для `text/plain`
  - `document_base64` для бинарных форматов
- `mime_type`

### Что core-api ожидает от analysis-engine
- `job_id`
- статус job;
- итоговый `result`, содержащий:
  - `contract_brief`
  - `role_focused_summary`
  - `risks[]`
  - `disputed_clauses[]`
  - `language/locale`
  - `execution_plan`

`core-api` затем нормализует этот payload в mobile-friendly DTO.

## Нефункциональные ограничения
- после установки приложения пользователь не должен скачивать дополнительные model/runtime bundles;
- тяжелые OCR/NLP артефакты остаются только на backend;
- mobile остается local-first;
- backend улучшает анализ и синхронизацию, но не должен быть обязательным условием запуска приложения.
