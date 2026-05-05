# Contract Risk Scanner

Android-проект для предварительного анализа договоров. В репозитории оставлены Android-клиент, backend API и движок анализа. Веб-клиент и iOS-клиент из рабочего контура убраны.

Приложение показывает сводку, риски, спорные пункты и ролевой фокус по договору. Это автоматическая предварительная проверка, а не юридическое заключение.

## Состав репозитория

- `apps/mobile` - Android-клиент на Expo/React Native
- `services/core-api` - NestJS API для загрузки документа, статуса и отчета
- `services/analysis-engine` - FastAPI сервис извлечения текста и анализа
- `db` - служебные SQL-артефакты

## Текущий режим

- клиент поддерживает `ru`, `en`, `it`, `fr`, язык по умолчанию - `ru`
- runtime по умолчанию собран как `API_TRANSPORT=local`
- для backend-анализа нужно явно задать `API_TRANSPORT=http` и `API_BASE_URL`
- по умолчанию отключены локальный SQLite-кэш и файловый кэш
- единственная намеренно сохраняемая пользовательская настройка - язык интерфейса

## Проверки

### Android-клиент

```powershell
cd apps\mobile
npm ci
npm run typecheck
npm run lint
npm run smoke
```

### Core API

```powershell
cd services\core-api
npm ci
npm run lint
npm run test
npm run build
```

### Analysis Engine

```powershell
cd services\analysis-engine
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m pytest -q
```

## Сборка Android

Внутренняя сборка:

```powershell
cd apps\mobile\android
.\gradlew.bat assembleInternal
```

Для release signing нужны:

- `CONTRACT_RISK_RELEASE_STORE_FILE`
- `CONTRACT_RISK_RELEASE_STORE_PASSWORD`
- `CONTRACT_RISK_RELEASE_KEY_ALIAS`
- `CONTRACT_RISK_RELEASE_KEY_PASSWORD`

## Документация

- `apps/mobile/README.md`
- `services/core-api/README.md`
- `services/analysis-engine/README.md`
