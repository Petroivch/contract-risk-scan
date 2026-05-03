# Архитектура local-first (frontend)

## Цель
Сохранить в кодовой базе понятную точку расширения для local-first режима, не смешивая ее с текущим runtime-состоянием.

## Стек хранения
1. Текущее состояние
   - `SQLiteLocalCache` присутствует как заглушка и не создает SQLite-файл
   - `LocalFileCache` присутствует как заглушка и не создает app-managed directory
   - feature flags `ENABLE_LOCAL_FIRST_CACHE`, `ENABLE_SQLITE_CACHE`, `ENABLE_FILE_CACHE` по умолчанию выключены
2. Что остается реально включенным
   - язык интерфейса сохраняется в AsyncStorage
   - анализ и отчет текущей сессии живут в памяти runtime
   - временные файлы возможны только как побочный эффект document-picker/read flow

## Поток данных
1. Экран вызывает API interface (`useApiClient`).
2. В текущем профиле `API_TRANSPORT=http`, поэтому основной путь идет через backend round-trip и общий analysis engine.
3. Документ выбирается через системный picker и читается для текущего анализа.
4. App-managed persisted cache/history в runtime по умолчанию не создаются.
5. Backend path уже является основным режимом, поэтому его storage/privacy copy должны документироваться явно и не маскироваться под полностью device-only поведение.

## Ожидания по offline для MVP
- Локальный transport-путь не требует сети для базового анализа.
- Текущий runtime не обещает persisted history, persisted reports или queued uploads между сессиями.
- Любая будущая offline queue/history реализация требует отдельного включения feature flags и отдельного privacy copy.

## TODO на следующий инкремент
- Реальный SQLite cache при включенном feature flag.
- Реальный file cache при включенном feature flag.
- Worker для queued uploads после появления сетевого transport-режима.
- TTL/eviction и encryption-at-rest для чувствительных persisted payload.
