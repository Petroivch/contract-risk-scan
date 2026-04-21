# 06. Стандарты качества интерфейса (без хардкода, production-grade)

## 1) Обязательные принципы
- никаких хардкодных UI-строк в production-компонентах и экранах;
- никаких ad-hoc значений для цвета, spacing, typography, radius и motion;
- никаких магических чисел в UX-спеке без `constant ID` и объяснения;
- любое исключение должно быть документировано и согласовано.

## 2) Реестр констант

| Constant ID | Value | Scope | Rationale |
|---|---:|---|---|
| `CONST_RELEASE_TOTAL_BUDGET_MB` | 228 | Общая финальная релизная сборка | бизнес-ограничение на весь пакет приложения |
| `CONST_UPLOAD_MAX_FILE_MB` | 20 | Валидация загрузки | предсказуемый мобильный UX и контракт MVP |
| `CONST_ROLE_MAX_LENGTH` | 50 | Поле роли | защита от переполнения и слабых custom labels |
| `CONST_DISPUTED_PREVIEW_MAX_CHARS` | 280 | Preview спорного пункта | баланс плотности и читаемости |
| `CONST_STATUS_STALL_NOTICE_SEC` | 20 | UX статуса | время до notice при ощущении зависания |
| `CONST_TOUCH_TARGET_MIN_PX` | 44 | Доступность | минимальный baseline для mobile |
| `CONST_CARD_TITLE_MAX_LINES` | 2 | Карточки | быстрое сканирование списков |
| `CONST_CARD_BODY_MAX_LINES` | 4 | Карточки | баланс плотности и ритма |
| `CONST_DYNAMIC_TYPE_MAX_PERCENT` | 200 | Доступность | поддержка увеличенного текста без layout break |
| `CONST_NAV_TO_UPLOAD_MAX_TAPS` | 4 | UX KPI | быстрый путь к ключевому действию |

Если любое значение меняется, сначала обновляется эта таблица, затем все зависимые документы и реализация.

## 3) i18n-стандарт
- ресурсы только на основе ключей;
- поддерживаются `ru`, `en`, `it`, `fr`;
- `ru` — язык по умолчанию и fallback;
- запрещена склейка фрагментов предложений;
- missing key обязан логироваться в telemetry и приводить к fallback на `ru`.

## 4) Стандарт design tokens
- обязательны семантические токены для цветов, типографики, spacing, radius, elevation и motion;
- имена токенов стабильны между `iOS`, `Android`, `web preview`;
- прямые числовые значения допустимы только внутри token source files.

## 5) Контроль размера релиза
- лимит относится ко всей итоговой сборке, а не только к UI;
- если общий размер превышает `CONST_RELEASE_TOTAL_BUDGET_MB`, оптимизация начинается с:
  1. onboarding media;
  2. animation packs;
  3. custom fonts;
  4. неиспользуемых icon/image sets;
  5. декоративных assets.
- запрещено компенсировать размер пост-установочными загрузками.

## 6) Quality gates для документации
- документы содержат стабильные идентификаторы: `keys`, `constants`, `tokens`;
- каждый flow/state/component можно проверить по acceptance criteria;
- handoff-документы обязаны включать integration dependencies;
- слова вроде «быстро», «скоро», «красиво», «много» недопустимы без контекста и измеримого критерия.

## 7) Quality gates для визуала
- high-risk и critical-risk должны считываться быстрее low/medium;
- роль должна быть заметна на ключевых экранах без визуального шума;
- состояния offline/queued должны отличаться от error-состояний;
- интерфейс должен сохранять читаемость на small screens и при `CONST_DYNAMIC_TYPE_MAX_PERCENT`.
