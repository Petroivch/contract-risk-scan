# Настройка frontend (React Native / Expo)

## Рабочая директория
- `C:\Users\user\Documents\Codex\вайбкод\contract-risk-scan-worktrees\agent-frontend\apps\mobile`

## Базовое правило runtime
- Пользователь ставит только готовое мобильное приложение.
- После установки нельзя требовать дополнительную загрузку модулей, словарей, UI-ассетов или локальных схем БД.
- Все словари `ru/en/it/fr`, migration-скрипты SQLite и основной UI bundle должны входить в сборку.

## Что нужно разработчику
- Node.js 20 LTS
- npm 10+
- VS Code
- Android Studio для Android emulator / native build
- Xcode для iOS simulator и native build на macOS

## Быстрый старт
1. Открыть терминал в `apps/mobile`.
2. Установить зависимости: `npm install`
3. Запустить Metro: `npm run start`
4. Запустить платформу:
   - Android: `npm run android`
   - iOS: `npm run ios`

## Проверки качества
- `npm run lint`
- `npm run typecheck`
- `npm run format`

## Конфигурация i18n
- Язык по умолчанию: `ru`
- Поддерживаемые языки: `ru`, `en`, `it`, `fr`
- Fallback язык: `ru`
- Ресурсы перевода лежат в `apps/mobile/src/i18n/resources/*.ts`
- Сохранение выбранного языка: ключ `LANGUAGE_PREFERENCE_KEY`

## Конфигурация API и mobile flow
- Базовый dev URL API: `http://localhost:3000/api/v1`
- Транспорт по умолчанию: `http`
- Если backend недоступен, frontend автоматически переключается на local-first fallback через локальный stub-клиент.
- Рабочий пользовательский путь:
  1. выбор роли;
  2. выбор файла;
  3. `POST /contracts/upload`;
  4. `POST /contracts/:id/analyze`;
  5. `GET /contracts/:id/status`;
  6. `GET /contracts/:id/report`;
  7. история в `GET /contracts/history`.

## Android runtime
- В `apps/mobile/android/app/build.gradle` debug APK настроен так, чтобы JS bundle вшивался в APK.
- Это убирает зависимость debug APK от внешнего Metro bundler на устройстве.

## Local-first
- SQLite обязателен для MVP.
- На frontend уже есть:
  - кэш статусов;
  - кэш отчетов;
  - история;
  - очередь загрузок;
  - fallback на локальный stub-анализ, если backend недоступен.
- Подробности: `docs/frontend/local-first-architecture.md`

## Стандарты
- Никакого runtime-hardcode в UI-компонентах.
- Лимиты, таймауты, transport, role presets и feature flags читаются из config layer.
- Все тексты UI идут только через i18n.
