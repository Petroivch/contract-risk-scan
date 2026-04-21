# 02. Состояния экранов (обычное / загрузка / пусто / ошибка)

## 1) Onboarding / Auth

### Normal
- вступительные карточки с короткими ценностными сообщениями;
- форма входа с primary CTA;
- все тексты показываются в активной locale, по умолчанию `ru`;
- весь copy использует ключи `onboarding.*`, `auth.*`.

### Loading
- spinner на кнопке с ключами `auth.sending_code`, `auth.signing_in`.

### Empty
- не применяется.

### Error
- неправильный email;
- неверный или просроченный OTP;
- сеть недоступна;
- общий ключ: `errors.auth_sign_in_failed`;
- отсутствующий перевод -> fallback на `ru`.

## 2) Выбор роли

### Normal
- label: `role.field_label`;
- редактируемый dropdown с подсказками;
- helper: `role.helper`;
- акцент экрана — на выборе роли, а не на служебных настройках.

### Loading
- если presets приходят удаленно, показывается skeleton списка.

### Empty
- если совпадений нет, показывается `role.use_custom_role_cta`.

### Error
- поле роли пустое при continue;
- длина роли `> CONST_ROLE_MAX_LENGTH`;
- неподдерживаемые символы, если включена валидация;
- missing translation key -> fallback `ru`.

## 3) Загрузка договора

### Normal
- upload-модуль и требования к файлу;
- primary CTA: `upload.choose_file_cta`;
- тексты локализованы;
- при отсутствии сети CTA меняется на локальное queued-действие.

### Loading
- progress bar загрузки с процентом и cancel action.

### Empty
- файл еще не выбран.

### Error
- неподдерживаемый формат;
- размер файла `> CONST_UPLOAD_MAX_FILE_MB`;
- ошибка загрузки;
- missing translation key -> fallback `ru`;
- offline error -> предложить `upload.offline_queue_cta`.

## 4) Статус анализа

### Normal
Степпер этапов:
1. `status.stage_file_received`
2. `status.stage_text_extraction`
3. `status.stage_clause_detection`
4. `status.stage_risk_scoring`
5. `status.stage_report_generation`

### Loading
- активный этап анимируется;
- если backend дает `eta_seconds`, показывается ETA;
- иначе используется `status.still_working_notice`;
- смена языка не прерывает анализ;
- при потере сети элемент уходит в `queued` или `waiting_for_network`.

### Empty
- не применяется.

### Error
- timeout;
- parser failure;
- AI service unavailable;
- действия: Retry, Back to Upload, Contact support;
- missing translation key -> fallback `ru`.

## 5) Отчет

### Normal
- вкладка `Risks`: карточки рисков по severity;
- вкладка `Disputed Clauses`: спорные формулировки;
- вкладка `Summary`: обязательства и ответственность с фокусом на выбранной роли;
- вкладки, CTA и disclaimers локализованы.

### Loading
- skeleton-карточки на уровне вкладки при подгрузке или re-rank.

### Empty
- Risks: `empty.no_critical_risks` + пояснение об ограничениях анализа;
- Disputed: `empty.no_disputed_clauses` + limits note;
- Summary: короткое fallback summary с confidence label.

### Error
- не удалось загрузить отчет полностью или частично;
- секционный retry;
- если narrative нет на выбранном языке — показать `ru` + fallback marker.

## 6) History

### Normal
- список отчетов по времени;
- поиск и фильтрация по роли и severity;
- кэшированные отчеты доступны offline.

### Loading
- skeleton-элементы списка.

### Empty
- `empty.no_reports`, `cta.upload_first_contract`;
- если offline и кэша нет, показать отдельное объяснение локальной пустоты.

### Error
- ошибка загрузки списка + retry;
- missing translation key -> fallback `ru`.

## 7) Settings / Profile

### Normal
- язык;
- уведомления;
- legal pages;
- sign out;
- `Lite mode details`, если включен оптимизированный профиль;
- варианты языка:
  - `ru` (Русский)
  - `en` (English)
  - `it` (Italiano)
  - `fr` (Français)

### Loading
- spinner на сохранении настройки;
- сообщение `settings.language_applying`.

### Empty
- не применяется.

### Error
- не удалось сохранить настройку;
- если язык не загрузился, использовать `ru` и показать ненавязчивое уведомление.

## 8) Local-first и offline-правила

### Normal
- пользователь может открыть кэшированный отчет и историю без сети;
- новые загрузки можно ставить в локальную очередь.

### Loading
- после восстановления сети queued-элементы продолжаются автоматически или по действию пользователя.

### Empty
- если локальных данных нет, показать guidance для загрузки при наличии сети.

### Error
- offline не должен блокировать доступ к уже сохраненным отчетам;
- запрещено требовать скачивание дополнительных модулей или assets.

## 9) Кросс-экранные правила локализации

### Normal
- активная locale применяется ко всем ключевым экранам, состояниям и disclaimer-блокам.

### Loading
- при смене языка допустим короткий text skeleton, но без сброса состояния экрана, scroll position и активной вкладки.

### Empty
- empty-state copy локализован и использует одни и те же namespaces.

### Error
- fallback deterministic: отсутствующий ключ -> `ru`;
- ошибка локализации не может ломать core actions: upload, retry, open report.

## 10) Режим оптимизации размера сборки

### Normal
- приложение работает в облегчённом UX-профиле и объясняет это в `Lite mode details`.

### Loading
- тяжелые визуальные placeholders заменяются легкими эквивалентами.

### Empty
- если декоративные packs убраны, показывается нейтральный placeholder.

### Error
- UX не должен предлагать скачивать дополнительные пакеты;
- если функция убрана ради общего размера сборки, пользователь получает прозрачное объяснение и core-flow альтернативу.

## 11) Правила запрета хардкода
- документы экранов должны ссылаться на `keys`, `constants`, `tokens`, а не на production literals;
- любые literal strings здесь носят иллюстративный характер и в коде обязаны быть заменены на `i18n keys`.

