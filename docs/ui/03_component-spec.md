# 03. Спецификация компонентов (production-grade)

## 1) Системные правила
- весь пользовательский текст приходит только через `i18n keys`;
- все визуальные значения берутся из `design tokens`;
- все числовые ограничения ссылаются на `06_ui-quality-standards.md`;
- любое новое значение требует документированного обоснования.

## 2) Контракт токенов

### Цветовые токены
- `color.brand.primary`
- `color.brand.primaryHover`
- `color.risk.critical`
- `color.risk.high`
- `color.risk.medium`
- `color.risk.low`
- `color.status.success`
- `color.status.info`
- `color.status.warning`
- `color.status.error`
- `color.surface.default`
- `color.surface.muted`
- `color.surface.elevated`
- `color.text.primary`
- `color.text.secondary`
- `color.text.inverse`

### Типографика
- `typography.display.s`
- `typography.title.l`
- `typography.title.m`
- `typography.body.m`
- `typography.body.s`
- `typography.label.m`
- `typography.caption.s`

### Отступы и layout
- `space.2`, `space.4`, `space.8`, `space.12`, `space.16`, `space.24`, `space.32`
- `radius.s`, `radius.m`, `radius.l`
- `elevation.0`, `elevation.1`, `elevation.2`

### Границы и индикаторы
- `border.subtle`
- `border.strong`
- `border.role.custom`
- `indicator.confidence.*`

### Motion
- `motion.duration.fast`
- `motion.duration.normal`
- `motion.easing.standard`

## 3) Компонент `RiskCard`

### Назначение
Показ одного найденного риска с severity, impact и recommendation.

### Поля данных
- `risk_title_key` или `risk_title_text`
- `severity`
- `clause_reference`
- `impact_summary_key` или `impact_summary_text`
- `recommendation_key` или `recommendation_text`
- `confidence_score`

### Поведение
- tap раскрывает детали;
- bookmark — опционально;
- сортировка по умолчанию: severity desc.

### Состояния
- `normal`
- `expanded`
- `loading`
- `error`

### Визуальные правила
- severity accent использует только `color.risk.*`;
- типографика и spacing — только через токены;
- high и critical должны визуально считываться быстрее остальных уровней.

## 4) Компонент `DisputedClauseCard`

### Назначение
Показ спорного или неоднозначного пункта договора.

### Поля данных
- `clause_quote`
- `why_disputed_key` или `why_disputed_text`
- `party_impact`
- `suggested_revision_key` или `suggested_revision_text`
- `confidence_score`

### Ограничения
- max preview: `CONST_DISPUTED_PREVIEW_MAX_CHARS`.

### Поведение
- tap раскрывает полный фрагмент;
- copy action — опционально.

### Состояния
- `normal`
- `expanded`
- `loading`
- `empty_placeholder`

## 5) Компонент `RoleBadge`

### Назначение
Показ активной роли на экранах upload, status и report.

### Поля данных
- `role_label`
- `is_custom`

### Поведение
- tap открывает изменение роли;
- если роль меняется после готовности отчета, запускается confirm-flow на re-focus.

### Состояния
- `normal`
- `editing`
- `validation_error`

## 6) Компонент `StatusBlock`

### Назначение
Отображение этапа обработки и надежности состояния.

### Поля данных
- `stage_name_key`
- `stage_state` (`pending|active|done|failed|waiting_for_network`)
- `message_key`
- `eta_seconds` — опционально
- `action_type` (`retry|cancel|resume`) — опционально

### Поведение
- обновление через polling или websocket;
- notice после `CONST_STATUS_STALL_NOTICE_SEC`.

### Состояния
- `processing`
- `success`
- `warning`
- `error`

## 7) Компонент `LanguageSelector`

### Назначение
Смена locale в `Settings / Profile`.

### Поля данных
- `active_locale` (`ru|en|it|fr`)
- `available_locales[]`
- `fallback_notice_visible`

### Поведение
- runtime switch без рестарта;
- сохранение выбора;
- отсутствующий ключ -> fallback на `ru`.

### Состояния
- `normal`
- `applying`
- `save_error`

## 8) Глобальные ограничения
- minimum touch target: `CONST_TOUCH_TARGET_MIN_PX`;
- заголовок карточки: `CONST_CARD_TITLE_MAX_LINES`;
- основной текст карточки: `CONST_CARD_BODY_MAX_LINES`;
- поддержка dynamic text до `CONST_DYNAMIC_TYPE_MAX_PERCENT`;
- стабильные component IDs обязательны для UI automation;
- offline/local-first режим должен сохранять доступ к cached history/report;
- hi-fi экраны обязаны маппиться на `07_visual-direction-v1.md` и `08_visual-themes-and-hifi-spec.md`.
