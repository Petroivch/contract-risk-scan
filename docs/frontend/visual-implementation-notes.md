# Заметки по визуальной реализации

## Визуальное направление
- Контрастный editorial UI с чистой светлой базой и насыщенным фирменным акцентом.
- Глубина строится за счет слоев поверхности, границ, ритма и статусных акцентов, а не за счет тяжелых декоративных фонов.
- Главная иерархия: заголовок экрана -> роль/статус -> ключевое действие -> рабочий контент.

## Слой темы
- Источник токенов: `apps/mobile/src/config/designTokens.ts`
- Runtime theme exports: `apps/mobile/src/theme/tokens.ts`
- Группы токенов:
  - colors
  - spacing
  - radius
  - typography
  - shadow
  - motion timings

## Паттерн screen shell
- Общий shell: `components/layout/ScreenShell.tsx`
- Он должен обеспечивать:
  - цельную screen composition;
  - устойчивый header pattern;
  - единый content gutter;
  - safe-area корректность на Android и iPhone;
  - предсказуемое размещение служебных controls.

## Базовые demo-компоненты
- `RoleBadge`
- `RiskCard`
- `DisputedCard`
- `StatusBlock`

## Экраны, где визуальная система обязательна
- Auth
- Role Selection
- Upload
- Analysis Status
- Report
- History
- Settings

## Правила поддерживаемости
- никаких прямых цветовых и типографических literals в экранах;
- все значения только из token layer;
- тексты только из i18n keys;
- high-risk и critical UI состояния не должны реализовываться ad-hoc стилями в конкретном экране.

## Важно для рабочих кнопок
- все CTA должны иметь явные состояния `default/pressed/loading/disabled`;
- смена состояния кнопки не должна вызывать layout jump;
- на Upload и Status primary action должен оставаться в визуальном фокусе даже при появлении ошибок или queued state.
