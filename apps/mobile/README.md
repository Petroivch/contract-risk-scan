# Contract Risk Scanner - Mobile App

Мобильный клиент на React Native (Expo) для Android и iPhone.

Клиент показывает предварительные индикаторы риска и спорные формулировки в договоре. Он не выдает юридическое заключение, не заменяет консультацию юриста и не подтверждает, что договор можно подписывать без дополнительной проверки.

## Основные возможности MVP
- Поток экранов: `Auth -> UploadWithRole -> AnalysisStatus -> Report -> Settings`
- i18n: `ru` по умолчанию + `en/it/fr` с fallback на `ru`
- Local-only/no-history copy: выбранный договор используется только для текущего анализа; сохраненные копии договоров, сохраненные отчеты и история анализов не должны оставаться после завершения сценария; очистка в Settings удаляет оставшиеся временные файлы
- Local-first инфраструктура в кодовой базе; для публичного РФ-релиза пользовательский copy и store listing должны оставаться в рамках local-only/no-history
- Реальный выбор документа через системный picker + временный локальный файловый кэш для чтения документа
- Слой темы с design tokens (colors/typography/radius/shadow/motion)
- Переиспользуемые стилизованные компоненты: `RoleBadge`, `RiskCard`, `DisputedCard`

## Правило runtime
- Пользователь устанавливает только релизный пакет.
- После установки приложение не скачивает дополнительные feature/module assets.
- Для публичного РФ-релиза P0 checklist в `docs/legal/release_checklist_ru.md` должен быть закрыт до публикации.
- Любые remote/offload сценарии с передачей договора, извлеченного текста или диагностических данных требуют отдельного legal/compliance решения и не должны маскироваться под local-only режим.

## Быстрый старт
1. `npm install`
2. `npm run start`
3. Android: `npm run android`
4. iPhone: `npm run ios`

## Скрипты качества
- `npm run lint`
- `npm run typecheck`
- `npm run smoke`
- `npm run format`

CI запускает `npm ci`, затем `npm run typecheck`, `npm run lint` и `npm run smoke` из каталога `apps/mobile`.

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
4. Проверить iOS bundle identifier в `app.json`: `com.contractriskscanner.mobile`.

Команды:
- `npm run eas:build:ios:preview` - internal/ad hoc build для тестирования на зарегистрированных устройствах при наличии Apple signing.
- `npm run eas:build:ios:production` - production build для App Store/TestFlight при наличии Apple signing.
- `npm run eas:submit:ios` - отправка production build в App Store Connect.

EAS-конфигурация лежит в `eas.json`; iOS bundle identifier задан в `app.json` как `com.contractriskscanner.mobile`.

## Документация фронтенда
- Настройка: `docs/frontend/setup.md`
- Интеграция: `docs/frontend/integration-notes.md`
- Local-first: `docs/frontend/local-first-architecture.md`
- Визуальные заметки: `docs/frontend/visual-implementation-notes.md`
