# План оптимизации размера пакета


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

## Варианты оптимизации
1. Split ABI delivery
   - Компромисс: больше артефактов нужно управлять в CI/CD
2. Агрессивное сжатие assets + subsetting шрифтов
   - Компромисс: время на настройку качества, возможные визуальные потери
3. Удаление или замена тяжелых зависимостей
   - Компромисс: рефакторинг и повторное тестирование
4. Перенос не критичного demo content в опциональные backend-provided data
   - Компромисс: для этого контента потребуется runtime network
5. Разделение debug tooling и release build
   - Компромисс: более строгая дисциплина release pipeline

## Проверка
- Отслеживать размеры артефактов в CI для каждого коммита.
