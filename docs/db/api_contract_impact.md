# Влияние на API-контракт (Backend + Frontend)

## 1. Источник истины для языков и локали
1. Языки берутся из `language_catalog`:
- `ru`, `en`, `it`, `fr` на текущем этапе.
- default/fallback управляется через `app_config.language.default` (по умолчанию `ru`).

2. Локаль и timezone:
- default-значения задаются через:
  - `app_config.locale.default` (по умолчанию `ru-RU`)
  - `app_config.timezone.default` (по умолчанию `Europe/Moscow`)

## 2. Входные DTO, которые нужно синхронизировать
1. Профиль пользователя:
- `preferredLanguage` -> `users.preferred_language`
- `locale` -> `users.locale`
- `timezone` -> `users.timezone`

2. Создание анализа:
- `reportLanguage` -> `analysis_jobs.report_language`

3. Загрузка договора:
- `languageCode` -> `contracts.language_code`

## 3. Выходные DTO
1. User profile response:
- возвращать `preferredLanguage`, `locale`, `timezone`.

2. Analysis job response:
- возвращать `reportLanguage`.

3. Report/Summary response:
- возвращать `reportLanguage` из `summaries.report_language`.

## 4. Валидация и fallback
1. На API-слое:
- валидировать `preferredLanguage`, `reportLanguage`, `languageCode` по активным кодам из `language_catalog`;
- при отсутствии или невалидности применять fallback.

2. На DB-слое:
- `normalize_supported_language(...)` нормализует `NULL` и невалидные значения к default-языку;
- FK на `language_catalog(code)` не допускает неразрешенные коды;
- default выбирается из `language_catalog` с учетом `app_config.language.default`.

3. Обратная совместимость:
- legacy-клиенты без языковых полей поддерживаются через DB default/fallback.

## 5. Local-first поведение для клиентов
1. Mobile app обязан сохранять локально:
- язык пользователя;
- язык каждого анализа;
- locale/timezone пользователя.

2. Синхронизация на сервер:
- опциональна;
- не должна требоваться для базового offline-сценария.

## 6. Инварианты для интеграции
1. Backend:
- не зашивать enum и лимиты в код, использовать данные из schema/config.

2. Frontend:
- список языков получать из API-конфига или bootstrap response, не хардкодить.

3. Общий контракт:
- поля языка и локали всегда присутствуют в профиле и отчетах после применения `v4`.
