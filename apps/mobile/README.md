# Contract Risk Scanner - Mobile App

Мобильный клиент на React Native (Expo) для Android и iPhone.

Клиент показывает предварительные индикаторы риска и спорные формулировки в договоре. Он не выдает юридическое заключение, не заменяет консультацию юриста и не подтверждает, что договор можно подписывать без дополнительной проверки.

## Основные возможности MVP
- Поток экранов: `Auth -> UploadWithRole -> AnalysisStatus -> Report -> Settings`
- i18n: `ru` по умолчанию + `en/it/fr` с fallback на `ru`
- Runtime по умолчанию использует `API_TRANSPORT=http` и backend path через `core-api`
- `API_BASE_URL` не зашит в репозиторий: его нужно задавать через env/build-time override для dev, preview и production
- `ENABLE_LOCAL_FIRST_CACHE`, `ENABLE_SQLITE_CACHE` и `ENABLE_FILE_CACHE` по умолчанию выключены
- Реальный выбор документа через системный picker; приложение не создает собственный SQLite-кэш или app-managed файловый кэш
- Слой темы с design tokens (colors/typography/radius/shadow/motion)
- Переиспользуемые стилизованные компоненты: `RoleBadge`, `RiskCard`, `DisputedCard`

## Текущее состояние хранения и privacy
- Пользователь устанавливает только релизный пакет.
- После установки приложение не скачивает дополнительные feature/module assets.
- Единственная намеренно сохраняемая пользовательская настройка в текущем клиенте - языковое предпочтение в AsyncStorage.
- Во время чтения документа могут существовать временные копии, созданные системным picker или runtime-сценарием текущей сессии.
- `core-api` обрабатывает загрузку и отчет через backend path, но сырой файл договора по умолчанию держится только in-memory на время анализа и не пишется на диск.
- Любые remote/offload сценарии с передачей договора, извлеченного текста или диагностических данных требуют отдельного legal/compliance решения и не должны описываться как полностью device-only.

## Быстрый старт
1. `npm install`
2. Задайте backend endpoint для своей среды:
   - Android emulator: `$env:API_BASE_URL="http://10.0.2.2:3000/api/v1/"`
   - Android device / Expo Go в одной сети: `$env:API_BASE_URL="http://<your-lan-ip>:3000/api/v1/"`
   - Production/release build: задайте публичный backend URL в CI/EAS/local shell до сборки
3. `npm run start`
4. Android: `npm run android`
5. iPhone: `npm run ios`

`API_TRANSPORT` по умолчанию остается `http`. Для локальных экспериментов его можно переопределить через `API_TRANSPORT` или `EXPO_PUBLIC_API_TRANSPORT`, но release-поток должен задавать реальный `API_BASE_URL`, а не полагаться на emulator-only host.

## Скрипты качества
- `npm run lint`
- `npm run typecheck`
- `npm run smoke`
- `npm run format`

CI запускает `npm ci`, затем `npm run typecheck`, `npm run lint` и `npm run smoke` из каталога `apps/mobile`.

## Release transport checklist
- Backend-assisted APK: set `API_TRANSPORT=http` and a non-empty public `https://` `API_BASE_URL` before building.
- Offline-local/internal APK: use an empty `API_BASE_URL` only when the release note explicitly says the build does not exercise backend analysis quality.
- Run `npm run smoke` and the runtime config smoke before distributing an APK; record the packaged `assets/app.config` values for `API_TRANSPORT` and `API_BASE_URL`.
- Do not describe a locally built APK with empty backend URL as backend-first, server-assisted, or production-ready.
- Upload consent and report copy must keep the preliminary automated review disclaimer: this is not legal advice and does not certify that a contract is safe to sign.

## Android release signing
`release` APK/AAB должен быть подписан production keystore. Если signing env vars не заданы, `assembleRelease` и `bundleRelease` завершаются понятной ошибкой и не fallback-ятся на debug keystore.

Обязательные env vars:
- `CONTRACT_RISK_RELEASE_STORE_FILE` - путь к `.jks`/`.keystore` файлу.
- `CONTRACT_RISK_RELEASE_STORE_PASSWORD` - пароль keystore.
- `CONTRACT_RISK_RELEASE_KEY_ALIAS` - alias ключа.
- `CONTRACT_RISK_RELEASE_KEY_PASSWORD` - пароль ключа.

Локальная release-сборка:
```powershell
cd apps\mobile\android
$env:CONTRACT_RISK_RELEASE_STORE_FILE="C:\secure\contract-risk-release.jks"
$env:CONTRACT_RISK_RELEASE_STORE_PASSWORD="<store-password>"
$env:CONTRACT_RISK_RELEASE_KEY_ALIAS="<key-alias>"
$env:CONTRACT_RISK_RELEASE_KEY_PASSWORD="<key-password>"
.\gradlew.bat assembleRelease
```

Для внутренней проверки без production keystore используйте отдельный debug-signed вариант:
```powershell
cd apps\mobile\android
.\gradlew.bat assembleInternal
```

## iOS через EAS Build
Локальная `.ipa`-сборка на Windows невозможна, поэтому для iPhone подготовлен облачный путь через Expo EAS. EAS может собрать installable iOS artifact только при наличии Apple Developer credentials и корректного signing/provisioning. Без Apple credentials можно проверить конфигурацию, но нельзя обещать готовую `.ipa`.

Перед первой сборкой:
1. Создать или войти в Expo account: `npx eas-cli@latest login`
2. При необходимости связать проект с Expo: `npx eas-cli@latest init`
3. Убедиться, что Apple Developer account доступен для signing/provisioning.
4. Проверить iOS bundle identifier в `app.config.ts`: `com.contractriskscanner.mobile`.
5. Задать `API_BASE_URL` и другие runtime overrides в EAS environment или локальном shell до `eas build`.

Команды:
- `npm run eas:build:ios:preview` - internal/ad hoc build для тестирования на зарегистрированных устройствах при наличии Apple signing.
- `npm run eas:build:ios:production` - production build для App Store/TestFlight при наличии Apple signing.
- `npm run eas:submit:ios` - отправка production build в App Store Connect.

EAS-конфигурация лежит в `eas.json`; iOS bundle identifier и runtime `extra` задаются через `app.config.ts`.

## Документация фронтенда
- Настройка: `docs/frontend/setup.md`
- Интеграция: `docs/frontend/integration-notes.md`
- Local-first: `docs/frontend/local-first-architecture.md`
- Визуальные заметки: `docs/frontend/visual-implementation-notes.md`
