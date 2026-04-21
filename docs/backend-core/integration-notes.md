# Backend Core: интеграционные заметки

## Текущее состояние архитектуры
- `core-api` больше не держит договоры только в памяти: исходные файлы и JSON-метадата сохраняются локально на диске.
- после `POST /contracts/upload` анализ стартует автоматически, без отдельного обязательного шага от клиента;
- `core-api` синхронизирует статус и результат с `analysis-engine`, а затем сохраняет нормализованный отчет локально;
- при рестарте сервиса история и ранее собранные отчеты не теряются;
- языковая политика централизована и повторно используется во всем flow `upload -> analyze -> status -> report -> history`.

## Что это дает mobile-клиенту
- `analysisId` можно использовать как внешний идентификатор анализа;
- `status` нормализован до mobile-friendly значений:
  - `queued`
  - `processing`
  - `completed`
  - `failed`
- дополнительно возвращается `pipelineStatus`, чтобы UI или отладка видели реальную backend-стадию:
  - `uploaded`
  - `queued`
  - `preprocessing`
  - `analyzing`
  - `report_ready`
  - `failed`
- в ответах на `upload/analyze/status/history` есть `progress`, чтобы UI мог показывать шкалу выполнения без самостоятельной логики.

## Local-first и роль backend
Backend в release-профиле нужен для:
- тяжелого OCR/NLP и анализа рисков;
- компактного JSON-отчета для мобильного UI;
- синхронизации статусов и истории между устройствами, если такой режим будет включен позже.

Backend не должен становиться обязательной зависимостью для старта мобильного приложения. История и уже полученные отчеты должны оставаться доступными локально на устройстве.

## Persistence-контур
Текущий `core-api` использует локальное файловое storage-хранилище:

```text
DATA_DIR/
  contracts/*.json
  uploads/*
```

По умолчанию:

```text
.runtime/core-api-data/
```

Что хранится:
- JSON-метадата договора;
- выбранная роль и `locale`;
- путь к сохраненному исходному файлу;
- `analysisJobId` из `analysis-engine`;
- сохраненный финальный отчет.

## Контракт языков
- поддерживаемые языки: `ru`, `en`, `it`, `fr`;
- default: `ru`;
- fallback: любое невалидное или отсутствующее `locale/language` нормализуется в `ru`.

Точки применения:
1. `upload` фиксирует нормализованный язык договора;
2. `analyze` может переопределить язык перед повторным запуском;
3. `core-api` передает нормализованный язык в `analysis-engine`;
4. `status/report/history` возвращают тот же язык обратно клиенту.

## No-hardcode политика
Централизованные точки конфигурации:
- `src/common/i18n/supported-locale.enum.ts`
- `src/common/i18n/locale.utils.ts`
- `src/common/policies/*.policy.ts`
- `src/config/configuration.ts`
- `src/config/app-config.type.ts`

Через env управляются:
- HTTP/Swagger параметры;
- JWT secret и TTL;
- лимиты upload;
- допустимые MIME type;
- path локального persistence;
- URL и таймауты `analysis-engine`.

## Бюджет релиза 228 МБ
Формула:

```text
TotalReleaseSize = AndroidRelease + iOSRelease + BackendReleaseBundle + SharedRuntimeAssets
```

Что учитывать:
- итоговые `.apk/.aab`;
- итоговые iOS-артефакты;
- backend-артефакты, если они реально входят в набор поставки.

Что не учитывать:
- исходники;
- CI/cache/logs;
- внешние облачные зависимости, не входящие в release-kit.

## Если общий размер > 228 МБ
Варианты на стороне backend:
1. исключить backend-бинарники из пользовательского release-kit и поставлять только mobile;
2. оставить `core-api` тонким orchestration-слоем, а тяжелые ML-компоненты выносить отдельно;
3. использовать managed/cloud deployment для анализа вместо локальной поставки backend;
4. добавить CI-gate, который валит релиз при превышении лимита.

## Что еще не production-ready
- `auth` все еще упрощен и не переведен на полноценное persistent-хранилище;
- нет очереди и retry-механизма уровня production worker;
- нет полноценного PostgreSQL/Redis-контура;
- нет end-to-end regression тестов на реальном `analysis-engine`.
