# Настройка фронтенда (React Native / Expo)

## Рабочая директория
- `apps/mobile`

## Правило запуска без догрузок после установки
- Пользователь устанавливает только финальный релизный пакет приложения.
- После установки приложение должно работать без скачивания дополнительных модулей, ассетов или функций.
- MVP-сборка должна содержать все UI-ассеты и словари (`ru/en/it/fr`).

## Требования к окружению разработчика
- Node.js 20 LTS
- npm 10+
- VS Code
- Android Studio (эмулятор Android)
- Xcode (симулятор iPhone на macOS)

## Установка и запуск
1. Откройте терминал в `apps/mobile`.
2. Установите зависимости: `npm install`
3. Перед запуском задайте backend endpoint для текущей среды:
   - Android emulator: `$env:API_BASE_URL="http://10.0.2.2:3000/api/v1/"`
   - Android device / iPhone в одной сети с backend: `$env:API_BASE_URL="http://<your-lan-ip>:3000/api/v1/"`
   - Release/EAS/CI: задайте `API_BASE_URL` и нужные overrides в build environment
4. Запустите приложение: `npm run start`
5. Запуск платформы:
   - Android: `npm run android`
   - iPhone: `npm run ios`

## Конфигурация i18n
- Язык по умолчанию: `ru`
- Поддерживаемые языки: `ru`, `en`, `it`, `fr`
- Язык fallback: `ru`
- Ресурсы переводов: `apps/mobile/src/i18n/resources/*.ts`
- Сохранение языка: ключ AsyncStorage из runtime config (`LANGUAGE_PREFERENCE_KEY`)

## Local-first
- Кодовая база сохраняет конфигурационные точки для local-first режима, но текущий runtime их не включает по умолчанию.
- Сейчас:
  - `API_TRANSPORT=http`
  - `ENABLE_LOCAL_FIRST_CACHE=false`
  - `ENABLE_SQLITE_CACHE=false`
  - `ENABLE_FILE_CACHE=false`
- В текущем клиенте сохраняется только языковое предпочтение в AsyncStorage.
- Подробности: `docs/frontend/local-first-architecture.md`

## Стандарты качества и архитектуры
- Никаких runtime-critical значений в UI-компонентах.
- Endpoints, лимиты, таймауты, preset-роли и feature flags читаются из dynamic Expo config (`app.config.ts` -> `expo.extra`) с env/build-time override-ами.
- `API_TRANSPORT=http` остается backend-first default, но `API_BASE_URL` не должен быть baked-in под конкретный emulator host.
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
