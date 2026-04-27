# Contract Risk Scanner

## Release readiness

Mobile checks are automated in `.github/workflows/mobile-ci.yml`. The workflow runs from `apps/mobile` and executes:

```powershell
npm ci
npm run typecheck
npm run lint
npm run smoke
```

Android release signing is explicit. `apps/mobile/android/app/build.gradle` no longer signs `release` with the debug keystore when release credentials are missing. Production `assembleRelease`/`bundleRelease` require:

- `CONTRACT_RISK_RELEASE_STORE_FILE`
- `CONTRACT_RISK_RELEASE_STORE_PASSWORD`
- `CONTRACT_RISK_RELEASE_KEY_ALIAS`
- `CONTRACT_RISK_RELEASE_KEY_PASSWORD`

For a debug-signed internal Android package, use the separate internal build type:

```powershell
cd apps\mobile\android
.\gradlew.bat assembleInternal
```

iOS release builds are prepared through Expo EAS in `apps/mobile/eas.json`. Commands are available in `apps/mobile/package.json`:

- `npm run eas:build:ios:preview`
- `npm run eas:build:ios:production`
- `npm run eas:submit:ios`

An installable iOS `.ipa` requires Apple Developer credentials and valid signing/provisioning. Without those credentials, EAS configuration can be checked, but a usable `.ipa` should not be promised.

`Contract Risk Scanner` — мобильное приложение для Android и iPhone, которое принимает файл договора и показывает предварительные индикаторы:
- возможные риски
- спорные формулировки
- краткую сводку договора
- ролевой фокус: что должен пользователь и что должна другая сторона

Приложение не выдает юридическое заключение, не заменяет консультацию юриста и не подтверждает, что договор можно подписывать без дополнительной проверки. Базовый режим описывается как local-only/no-history: выбранный договор используется только для текущего анализа; сохраненные копии договоров, сохраненные отчеты и история анализов не должны оставаться после завершения сценария; в настройках доступна очистка временных файлов чтения документа.

Поддерживаемые языки интерфейса и результата:
- `ru` по умолчанию
- `en`
- `it`
- `fr`

## Содержание

- [Что уже сделано](#что-уже-сделано)
- [Текущие приоритеты](#текущие-приоритеты)
- [Структура репозитория](#структура-репозитория)
- [Требования к окружению](#требования-к-окружению)
- [Быстрый запуск интерфейса](#быстрый-запуск-интерфейса)
- [Полный локальный запуск](#полный-локальный-запуск)
- [Команды качества](#команды-качества)
- [Сборка Android и iPhone](#сборка-android-и-iphone)
- [Legal/compliance готовность](#legalcompliance-готовность)
- [Ограничения и текущие блокеры](#ограничения-и-текущие-блокеры)
- [Оглавление документации](#оглавление-документации)

## Что уже сделано

На текущий момент в проекте есть:
- мобильный каркас приложения на `React Native + Expo`
- базовые экраны: авторизация, загрузка договора, статус анализа, отчет и настройки
- мультиязычность `ru/en/it/fr`
- local-first инфраструктура в кодовой базе, при этом пользовательский сценарий для РФ должен описываться как local-only/no-history
- локальный офлайн-анализ договора прямо в mobile-приложении без обязательного обращения к `core-api` или `analysis-engine`
- выбор файла через системный picker
- backend skeleton на `NestJS`
- analysis engine skeleton на `FastAPI`
- схема БД, миграции и документация
- UI/UX документация и визуальное направление
- GitHub-репозиторий с ветками под отдельные зоны работы
- ранее собранный Android `APK` для внутренней проверки в корне репозитория: `contract-risk-scanner-android.apk`

## Текущие приоритеты

Сейчас проект ведется по трем главным направлениям:
1. красивый и сильный mobile UI
2. рабочий пользовательский сценарий, особенно анализ договора
3. дальнейшее усиление качества анализа и release/compliance-пакета, при том что в репозитории уже есть ранее собранный Android `APK` для внутренней проверки

## Структура репозитория

- `apps/mobile` — мобильное приложение
- `services/core-api` — основной backend API
- `services/analysis-engine` — сервис анализа договора
- `db` — схема, миграции, валидация и SQL-артефакты
- `docs` — проектная документация по UI, frontend, backend и БД

## Требования к окружению

Для всех сценариев:
- `Node.js 20 LTS`
- `npm 10+`
- `Python 3.11+`
- `VS Code`

Для Android:
- `Android Studio`
- Android SDK
- `Java 17`
- Android emulator или физическое Android-устройство

Для iPhone:
- `macOS`
- `Xcode`
- `CocoaPods`
- iPhone simulator или физический iPhone

Важно:
- Android можно разрабатывать и запускать с Windows
- локальная нативная iPhone-сборка требует `macOS + Xcode`

## Быстрый запуск интерфейса

Если нужно просто открыть интерфейс на другой машине:

```powershell
cd apps\mobile
npm install
npx expo start --web
```

Дальше открыть локальный адрес, который покажет Expo.

## Полный локальный запуск

### 1. Analysis Engine

```powershell
cd services\analysis-engine
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8010
```

### 2. Core API

```powershell
cd services\core-api
copy .env.example .env
npm install
npm run start:dev
```

### 3. Mobile App

```powershell
cd apps\mobile
npm install
npm run start
```

### 4. Android

```powershell
cd apps\mobile
npm run android
```

### 5. iPhone

```bash
cd apps/mobile
npm run ios
```

## Команды качества

### Mobile

```powershell
cd apps\mobile
npm run lint
npm run typecheck
```

### Core API

```powershell
cd services\core-api
npm install
npm run lint
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

## Сборка Android и iPhone

### Android

Базовый путь для локальной разработки:

```powershell
cd apps\mobile
npm install
npx expo prebuild --platform android
npm run android
```

В корне репозитория лежит ранее собранный `APK` для внутренней проверки:

```text
contract-risk-scanner-android.apk
```

Этот артефакт собран с упакованным `assets/index.android.bundle`, поэтому не требует Metro и не обращается к компьютеру пользователя после установки. Наличие файла в репозитории само по себе не означает legal/compliance readiness для публичного релиза.

Для повторной локальной сборки Android:
- использовать `Node.js 20`
- использовать `Java 17`
- при Windows-пути с не-ASCII символами удобнее собирать через временный `subst`-диск
- при необходимости настроить собственный production signing вместо debug keystore

### iPhone

Базовый путь на macOS:

```bash
cd apps/mobile
npm install
npx expo prebuild --platform ios
npm run ios
```

Для итогового installable iPhone-пакета дополнительно нужны:
- signing
- provisioning profile
- archive/export через Xcode

Облачный путь с Windows через EAS Build:

```powershell
cd apps\mobile
npm install
npx eas-cli@latest login
npx eas-cli@latest init
npm run eas:build:ios:preview
```

Для production/App Store:

```powershell
cd apps\mobile
npm run eas:build:ios:production
npm run eas:submit:ios
```

EAS-конфигурация лежит в `apps/mobile/eas.json`. Для iOS задан bundle identifier `com.contractriskscanner.mobile`.

## Ограничения и текущие блокеры

Текущие известные ограничения:
- в `core-api` еще остались упрощенные части вокруг `auth` и части production-hardening
- `analysis-engine` пока является рабочим skeleton, а не production OCR/NLP пайплайном
- в репозитории есть ранее собранный Android `APK` для внутренней проверки, но публичный РФ-релиз остается заблокированным до закрытия P0 checklist
- iPhone локально по-прежнему не собрать без `macOS`

## Legal/compliance готовность

Перед публичным релизом для РФ нужно закрыть P0 из [`docs/legal/release_checklist_ru.md`](docs/legal/release_checklist_ru.md). До закрытия checklist продукт должен позиционироваться только как инструмент предварительной подсветки рисков, без обещаний юридического заключения, проверки юристом или гарантированного обнаружения всех проблем договора.

Local-only/no-history режим для пользователя означает: выбранный договор используется только для текущего анализа; сохраненные копии договоров, сохраненные отчеты и история анализов не должны оставаться после завершения сценария; очистка временных файлов удаляет оставшийся кэш чтения документов.

Требования к итоговому релизу:
- пользователь устанавливает только готовую сборку
- дополнительных скачиваний после установки быть не должно

## Оглавление документации

### Общая

- [`README.md`](README.md)
- [`docs/legal/release_checklist_ru.md`](docs/legal/release_checklist_ru.md)

### Mobile

- [`apps/mobile/README.md`](apps/mobile/README.md)

### Core API

- [`services/core-api/README.md`](services/core-api/README.md)

### Analysis Engine

- [`services/analysis-engine/README.md`](services/analysis-engine/README.md)

### База данных

- [`docs/db/README.md`](docs/db/README.md)
- [`docs/db/api_contract_impact.md`](docs/db/api_contract_impact.md)
- [`docs/db/config_registry.md`](docs/db/config_registry.md)
- [`docs/db/data_lifecycle_policy.md`](docs/db/data_lifecycle_policy.md)
- [`docs/db/index_strategy.md`](docs/db/index_strategy.md)
- [`docs/db/local_first_architecture.md`](docs/db/local_first_architecture.md)
- [`docs/db/rollback_v1.md`](docs/db/rollback_v1.md)
- [`docs/db/rollback_v2.md`](docs/db/rollback_v2.md)
- [`docs/db/rollback_v3.md`](docs/db/rollback_v3.md)
- [`docs/db/rollback_v4.md`](docs/db/rollback_v4.md)

### Frontend

- [`docs/frontend/integration-notes.md`](docs/frontend/integration-notes.md)
- [`docs/frontend/local-first-architecture.md`](docs/frontend/local-first-architecture.md)
- [`docs/frontend/package-size-optimization.md`](docs/frontend/package-size-optimization.md)
- [`docs/frontend/setup.md`](docs/frontend/setup.md)
- [`docs/frontend/visual-implementation-notes.md`](docs/frontend/visual-implementation-notes.md)

### UI/UX

- [`docs/ui/README.md`](docs/ui/README.md)
- [`docs/ui/01_screen-map-user-flow.md`](docs/ui/01_screen-map-user-flow.md)
- [`docs/ui/02_screen-states.md`](docs/ui/02_screen-states.md)
- [`docs/ui/03_component-spec.md`](docs/ui/03_component-spec.md)
- [`docs/ui/04_microcopy-guide.md`](docs/ui/04_microcopy-guide.md)
- [`docs/ui/05_ui-handoff-requirements.md`](docs/ui/05_ui-handoff-requirements.md)
- [`docs/ui/06_ui-quality-standards.md`](docs/ui/06_ui-quality-standards.md)
- [`docs/ui/07_visual-direction-v1.md`](docs/ui/07_visual-direction-v1.md)
- [`docs/ui/08_visual-themes-and-hifi-spec.md`](docs/ui/08_visual-themes-and-hifi-spec.md)

### Backend Core

- [`docs/backend-core/integration-notes.md`](docs/backend-core/integration-notes.md)
- [`docs/backend-core/short-integration-contract.md`](docs/backend-core/short-integration-contract.md)

### Backend AI

- [`docs/backend-ai/core-api-locale-contract.md`](docs/backend-ai/core-api-locale-contract.md)
- [`docs/backend-ai/no-hardcode-standard.md`](docs/backend-ai/no-hardcode-standard.md)
- [`docs/backend-ai/on-device-offline-feasibility.md`](docs/backend-ai/on-device-offline-feasibility.md)
- [`docs/backend-ai/quality-baseline.md`](docs/backend-ai/quality-baseline.md)
- [`docs/backend-ai/rule-source-registry.md`](docs/backend-ai/rule-source-registry.md)
