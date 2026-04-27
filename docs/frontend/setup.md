# Настройка фронтенда (React Native / Expo)

## Рабочая директория
- `C:\Users\user\Documents\Codex\вайбкод\contract-risk-scan-worktrees\agent-ui\apps\mobile`

## Правило запуска без догрузок после установки
- Пользователь устанавливает только финальный релизный пакет приложения.
- После установки приложение должно работать без скачивания дополнительных модулей, ассетов или функций.
- MVP-сборка должна содержать все UI-ассеты, словари (`ru/en/it/fr`) и локальные миграции схемы данных.

## Требования к окружению разработчика
- Node.js 20 LTS
- npm 10+
- VS Code
- Android Studio (эмулятор Android)
- Xcode (симулятор iPhone на macOS)

## Установка и запуск
1. Откройте терминал в `apps/mobile`.
2. Установите зависимости: `npm install`
3. Запустите приложение: `npm run start`
4. Запуск платформы:
   - Android: `npm run android`
   - iPhone: `npm run ios`

## Конфигурация i18n
- Язык по умолчанию: `ru`
- Поддерживаемые языки: `ru`, `en`, `it`, `fr`
- Язык fallback: `ru`
- Ресурсы переводов: `apps/mobile/src/i18n/resources/*.ts`
- Сохранение языка: ключ AsyncStorage из runtime config (`LANGUAGE_PREFERENCE_KEY`)

## Local-first
- Локальная база данных и кэш обязательны для MVP.
- Текущая архитектура фронтенда включает:
  - SQLite-кэш для status/report/history
  - helper для файлового кэша
  - local-first API adapter с fallback на SQLite при ошибке remote-запроса
- Подробности: `docs/frontend/local-first-architecture.md`

## Стандарты качества и архитектуры
- Никаких runtime-critical значений в UI-компонентах.
- Endpoints, лимиты, таймауты, preset-роли и feature flags читаются из config (`app.json` `expo.extra` + env overrides).
- UI-тексты берутся только из словарей i18n.

- Целевой вклад mobile и чеклист оптимизации: `docs/frontend/package-size-optimization.md`

## Рекомендуемые расширения VS Code
- `dbaeumer.vscode-eslint`
- `esbenp.prettier-vscode`
- `msjsdiag.vscode-react-native`
- `expo.vscode-expo-tools`
- `christian-kohler.path-intellisense`
- `usernamehw.errorlens`
- `eamodio.gitlens`

## Визуальная реализация
- Заметки по токенам темы и screen shell: `docs/frontend/visual-implementation-notes.md`
