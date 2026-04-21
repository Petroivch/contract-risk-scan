# План оптимизации размера пакета

## Определение бюджета
- **Общий лимит релизной сборки проекта**: `228 MB` (глобальный предел)
- В этот бюджет входят все deliverables, которые попадают в release package set.

## Оценка вклада mobile frontend
- Целевой вклад mobile (доля frontend-пакета): **<= 120 MB**
- Причина:
  - оставить запас для backend deliverables, docs/assets и release metadata
  - снизить риск превышения глобального лимита 228 MB при финальной агрегации

## Текущие факторы риска (mobile)
- runtime-бинарники React Native/Expo
- рост native dependencies (SQLite, file-system, media/libs)
- bundled assets (images/fonts/icons)
- дублирование localization/media resources

## Чеклист оптимизации
1. Assets
   - сжимать raster assets (WebP/AVIF, где применимо)
   - удалять неиспользуемые design assets и дубликаты
   - делать subsetting шрифтов (только используемые диапазоны glyphs)
2. JS/TS bundle
   - убирать мертвые зависимости
   - не использовать тяжелые utility libs, если есть native/light альтернативы
   - выносить debug-only модули из release path
3. Native build config
   - включить Hermes для release
   - включить minify/proguard/r8 для Android
   - strip symbols в release pipeline
4. ABI strategy
   - по возможности использовать split ABI artifacts для каналов дистрибуции, которые их поддерживают
5. Localization
   - оставлять в app bundle только нужные locale (`ru/en/it/fr`)

## Если общий размер > 228 MB (варианты и компромиссы)
1. Split ABI delivery
   - Ожидаемый эффект: примерно `15-35%` уменьшения размера на устройство для APK
   - Компромисс: больше артефактов нужно управлять в CI/CD
2. Агрессивное сжатие assets + subsetting шрифтов
   - Ожидаемый эффект: `10-25 MB` экономии
   - Компромисс: время на настройку качества, возможные визуальные потери
3. Удаление или замена тяжелых зависимостей
   - Ожидаемый эффект: `5-20 MB` в зависимости от библиотеки
   - Компромисс: рефакторинг и повторное тестирование
4. Перенос не критичного demo content в опциональные backend-provided data
   - Ожидаемый эффект: переменный (`5-30 MB`)
   - Компромисс: для этого контента потребуется runtime network
5. Разделение debug tooling и release build
   - Ожидаемый эффект: `3-10 MB`
   - Компромисс: более строгая дисциплина release pipeline

## Проверка
- Отслеживать размеры артефактов в CI для каждого коммита.
- Блокировать release, если оценка суммарного размера > 228 MB.
- Вести dashboard по mobile share (цель <= 120 MB).
