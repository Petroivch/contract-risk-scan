# Contract Risk Scanner

Мобильный проект для Android и iPhone, который анализирует файл договора и возвращает:
- риски
- спорные пункты
- краткое описание договора
- акценты по выбранной роли пользователя

Поддерживаемые языки интерфейса и ответа:
- `ru` по умолчанию
- `en`
- `it`
- `fr`

## Структура репозитория

- `apps/mobile` - мобильное приложение на React Native + Expo
- `services/core-api` - основной API-сервис на NestJS
- `services/analysis-engine` - сервис анализа на FastAPI
- `db` - SQL-схема, миграции и проверки
- `docs` - проектная документация, UX/UI, frontend/backend/db handoff

## Кратко о выполненной работе

На текущий момент в проекте уже сделано:
- собран мобильный каркас приложения под Android и iPhone
- реализованы основные экраны: авторизация, загрузка договора, статус анализа, отчет, история, настройки
- добавена мультиязычность `ru/en/it/fr` с `ru` как языком по умолчанию
- реализован local-first подход: локальный кэш, SQLite, очередь загрузок и fallback-сценарии
- подключен системный выбор файла через `expo-document-picker`
- подготовлена визуальная система, дизайн-токены и UI-документация
- собран `core-api` skeleton на NestJS с DTO, маршрутами и OpenAPI-контрактом
- собран `analysis-engine` skeleton на FastAPI с тестами и базовой логикой пайплайна
- подготовлены SQL-миграции и документация по БД
- репозиторий и ветки уже загружены на GitHub

## Текущий режим разработки

Сейчас мобильное приложение поддерживает два режима работы:

1. `stub`  
   Интерфейс работает без реального backend. Подходит для UX/UI-проверки и демонстрации экранов.

2. `api`  
   Мобильное приложение обращается в `core-api`, а тот дальше интегрируется с `analysis-engine`.

По умолчанию проект пока ориентирован на interface-first разработку. Для полноценного end-to-end запуска нужно поднимать оба backend-сервиса.

## Требования к окружению

Для всех сценариев:
- `Node.js 20 LTS`
- `npm 10+`
- `Python 3.11+`
- `VS Code`

Для локального запуска и сборки Android:
- `Android Studio`
- Android SDK
- `Java 17`
- Android-эмулятор или физическое Android-устройство

Для локального запуска и сборки iPhone:
- `macOS`
- `Xcode`
- `CocoaPods`
- iPhone simulator или физический iPhone

Важно:
- Android можно разрабатывать и запускать с Windows.
- Нативную iPhone-сборку нельзя штатно собирать локально с Windows через `expo run:ios`; для этого нужен `macOS + Xcode`.

## Работа через VS Code

Открыть проект:

```powershell
cd C:\path\to\contract-risk-scan
code .
```

Рекомендуемые расширения VS Code:
- `dbaeumer.vscode-eslint`
- `esbenp.prettier-vscode`
- `ms-python.python`
- `ms-python.vscode-pylance`
- `ms-azuretools.vscode-docker`

## Быстрый запуск интерфейса на другом компьютере

Если нужно просто открыть и потыкать интерфейс:

```powershell
cd apps\mobile
npm install
npx expo start --web
```

После этого открыть локальный адрес, который покажет Expo. Обычно это:

```text
http://localhost:8081
```

или:

```text
http://localhost:19006
```

В зависимости от занятого порта.

## Запуск мобильного интерфейса

### 1. Установить зависимости mobile-приложения

```powershell
cd apps\mobile
npm install
```

### 2. Запустить Expo

```powershell
npm run start
```

### 3. Запустить Android

```powershell
npm run android
```

Подходит для:
- Android emulator
- подключенного Android-телефона

### 4. Запустить iPhone

```bash
cd apps/mobile
npm install
npm run ios
```

Для этого обязательно нужны:
- `macOS`
- `Xcode`

Если разработчик работает на Windows, он может запускать:
- web preview
- Android

Но не локальную нативную iPhone-сборку.

## Полный локальный запуск всех сервисов

### 1. Запуск analysis-engine

```powershell
cd services\analysis-engine
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8010
```

### 2. Запуск core-api

В другом терминале:

```powershell
cd services\core-api
copy .env.example .env
npm install
npm run start:dev
```

### 3. Запуск mobile-приложения

В еще одном терминале:

```powershell
cd apps\mobile
npm install
npm run start
```

## Отдельный запуск только web-интерфейса

Если дизайнеру, тестировщику или заказчику нужен только интерфейс:

```powershell
cd apps\mobile
npm install
npx expo start --web
```

Это самый простой и воспроизводимый набор команд для запуска интерфейса на другом компьютере.

## Команды проверки качества

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

## Команды для нативной mobile-сборки

### Android

Для Android-машины с настроенным Android Studio:

```powershell
cd apps\mobile
npm install
npx expo prebuild --platform android
npm run android
```

Для полноценного release `APK/AAB` еще нужно финализировать Android signing и release pipeline.

### iPhone

Для iPhone-сборки на `macOS`:

```bash
cd apps/mobile
npm install
npx expo prebuild --platform ios
npm run ios
```

Для итогового installable iPhone-пакета еще нужны:
- signing
- provisioning profile
- archive/export через Xcode

## Ожидаемые требования к релизу

Целевые требования проекта:
- пользователь должен устанавливать только готовую release-сборку
- после установки не должно требоваться скачивание дополнительных модулей
- общий бюджет финальной сборки: не более `228 МБ`

Текущее направление реализации:
- local-first
- мультиязычность
- конфигурируемое поведение без хардкода

## Текущие ограничения

- в `core-api` еще остаются stage-1 stub/in-memory части
- `analysis-engine` пока является рабочим skeleton, а не полноценным production OCR/NLP пайплайном
- release packaging для Android/iPhone еще не доведен до финального состояния
- локальная нативная iPhone-сборка требует `macOS`
- Android native toolchain на Windows сейчас упирается в проблему с non-ASCII путем проекта, потому release-артефакт еще не получен

## Ключевые документы

- `docs/ui/README.md`
- `docs/ui/08_visual-themes-and-hifi-spec.md`
- `docs/frontend/setup.md`
- `docs/frontend/integration-notes.md`
- `docs/backend-core/integration-notes.md`
- `docs/backend-ai/core-api-locale-contract.md`
- `docs/db/README.md`
