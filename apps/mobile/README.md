# Contract Risk Scanner - Mobile App

Мобильный клиент на React Native (Expo) для Android и iPhone.

## Основные возможности MVP
- Поток экранов: `Auth -> UploadWithRole -> AnalysisStatus -> Report -> History -> Settings`
- i18n: `ru` по умолчанию + `en/it/fr` с fallback на `ru`
- Local-first поток данных: SQLite cache + local-first adapter fallback
- Реальный выбор документа через системный picker + локальный файловый кэш для сценария загрузки
- Fallback на queued upload, когда remote upload недоступен
- Слой темы с design tokens (colors/typography/radius/shadow/motion)
- Переиспользуемые стилизованные компоненты: `RoleBadge`, `RiskCard`, `DisputedCard`

## Правило runtime
- Пользователь устанавливает только релизный пакет.
- После установки приложение не скачивает дополнительные feature/module assets.

## Быстрый старт
1. `npm install`
2. `npm run start`
3. Android: `npm run android`
4. iPhone: `npm run ios`

## Скрипты качества
- `npm run lint`
- `npm run typecheck`
- `npm run format`

## Документация фронтенда
- Настройка: `docs/frontend/setup.md`
- Интеграция: `docs/frontend/integration-notes.md`
- Local-first: `docs/frontend/local-first-architecture.md`
- Бюджет размера: `docs/frontend/package-size-optimization.md`
- Визуальные заметки: `docs/frontend/visual-implementation-notes.md`
