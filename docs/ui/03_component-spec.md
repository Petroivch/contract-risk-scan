﻿# 03. Спецификация компонентов (production-grade)

## 1) Системные правила (о чем мы договорились)
- Все тексты, которые видит пользователь, мы берем только из ключей локализации (`i18n keys`).
- Все отступы, цвета и размеры мы задаем исключительно через `design tokens`.
- Любые числовые лимиты мы сверяем с документом `06_ui-quality-standards.md`.
- Если нам нужно ввести новое значение, мы сначала обсуждаем и документируем его.

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
- tap открывает модальное окно (Bottom Sheet) с деталями риска;
- bookmark — опционально;
- сортировка по умолчанию: severity desc.

### Состояния
- `normal`
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
- tap открывает модальное окно (Bottom Sheet) с полным фрагментом;
- copy action — опционально.

### Состояния
- `normal`
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
- Минимальный размер области нажатия (touch target) — `CONST_TOUCH_TARGET_MIN_PX`.
- Заголовок карточки не должен превышать `CONST_CARD_TITLE_MAX_LINES` строк.
- Основной текст карточки ограничен `CONST_CARD_BODY_MAX_LINES` строками.
- Мы поддерживаем системное увеличение текста до `CONST_DYNAMIC_TYPE_MAX_PERCENT`.
- Для автотестов мы обязательно задаем стабильные ID компонентам.
- В offline-режиме пользователь всегда должен иметь доступ к сохраненным отчетам в истории.
- Внешний вид компонентов должен соответствовать нашим дизайн-гайдам.
