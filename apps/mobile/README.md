# Contract Risk Scanner - Mobile

Мобильный клиент на `React Native + Expo` для Android и iPhone.

## Что уже реализовано
- production-style mobile UI с единой визуальной системой;
- выбор роли до загрузки договора;
- выбор файла через системный picker;
- путь `upload -> analyze -> status -> report -> history`;
- i18n: `ru` по умолчанию + `en/it/fr`;
- local-first слой:
  - SQLite cache;
  - file cache;
  - offline fallback без обращения к компьютеру;
- Android native tree в `apps/mobile/android`;
- debug APK можно собирать без зависимости от внешнего Metro bundler.

## Команды
1. `npm install`
2. `npm run start`
3. `npm run android`
4. `npm run ios`

## Проверки
- `npm run lint`
- `npm run typecheck`
- `npm run format`

## Документация frontend
- `docs/frontend/setup.md`
- `docs/frontend/integration-notes.md`
- `docs/frontend/local-first-architecture.md`
- `docs/frontend/package-size-optimization.md`
- `docs/frontend/visual-implementation-notes.md`
