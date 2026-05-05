# Contract Risk Scanner Mobile

Android-клиент на Expo/React Native для предварительного анализа договоров. В проекте больше нет web-контура и клиентского iOS-контура.

## Возможности

- загрузка `PDF`, `DOCX` и `TXT`
- показ сводки, рисков, спорных пунктов и ролевого фокуса
- интерфейс на `ru`, `en`, `it`, `fr`
- запуск в локальном режиме или через backend API

## Runtime

По умолчанию используется локальный режим:

```powershell
$env:API_TRANSPORT="local"
```

Для backend-анализа:

```powershell
$env:API_TRANSPORT="http"
$env:API_BASE_URL="http://10.0.2.2:3000/api/v1/"
```

Для физического устройства вместо `10.0.2.2` используйте LAN IP машины с backend.

## Быстрый старт

```powershell
cd apps\mobile
npm ci
npm run typecheck
npm run lint
npm run smoke
npm run android
```

## Проверки

- `npm run typecheck`
- `npm run lint`
- `npm run smoke`

## Сборка APK

Внутренняя сборка:

```powershell
cd apps\mobile\android
.\gradlew.bat assembleInternal
```

Release-подпись требует:

- `CONTRACT_RISK_RELEASE_STORE_FILE`
- `CONTRACT_RISK_RELEASE_STORE_PASSWORD`
- `CONTRACT_RISK_RELEASE_KEY_ALIAS`
- `CONTRACT_RISK_RELEASE_KEY_PASSWORD`

Перед распространением APK проверьте упакованный `assets/app.config`.
