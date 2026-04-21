# Feasibility on-device и offline (общий лимит сборки: 228 МБ)

## Назначение
Документ фиксирует, как `Contract Risk Scanner` должен соблюдать мобильные ограничения:
- после установки пользователь ничего не скачивает отдельно
- local-first поведение используется везде, где это реально
- итоговая release-сборка всего продукта должна быть не больше `228 МБ`

Ниже описаны последствия именно для `analysis-engine` и handoff-ограничения для mobile/platform-команд.

## Глобальные ограничения
1. Порог `228 МБ` относится ко всему release artifact проекта, а не только к AI-модулю.
2. Release-приложение должно уже содержать все обязательные runtime assets.
3. После установки нельзя скачивать модели, rule packs и data packs.
4. Предпочтение отдается локальному анализу и локальному хранению, пока качество и latency приемлемы.
5. Если общий размер превышает `228 МБ`, команда обязана сделать оптимизацию и/или ограниченный offload-план.

## Доля AI в общем build budget
Нужно явно отслеживать вклад AI внутри общего лимита `228 МБ`:
- `total_build_mb` — итоговый размер release artifact
- `ai_assets_mb` — OCR/NLP модели, tokenizers, rule packs, AI-native библиотеки
- `ai_share_percent = ai_assets_mb / total_build_mb * 100`

Целевая политика:
- норма: `<= 35%`
- warning: `> 35%` и `<= 40%`
- hard review: `> 40%`

Практический диапазон:
- норма: `45-70 МБ`
- warning: `71-85 МБ`
- hard review: `> 85 МБ`

## Реализуемость по этапам пайплайна
| Этап | Реализуемость локально | Влияние на размер | Влияние на runtime | Рекомендуемый режим |
|---|---|---:|---:|---|
| Ingestion файлов (PDF/DOCX/TXT) | Высокая | Низкое | Низкое | On-device |
| Извлечение текста из digital PDF/DOCX | Высокая | Низкое | Низкое | On-device |
| OCR для сканов | Средняя | Среднее/высокое | Среднее | Локально с компактным OCR pack, иначе server assist |
| Сегментация на пункты | Высокая | Низкое | Низкое | On-device |
| Rules-first выявление рисков | Высокая | Низкое | Низкое | On-device |
| Semantic/LLM-анализ рисков | Средняя/низкая | Высокое | Высокое | Опционально, offload-first при давлении по размеру |
| Role-focused summary | Средняя | Среднее | Среднее | Сначала rules/templates, semantic enrichment опционален |

## Архитектура local-first
1. Tier 1 — всегда локально, обязательно lightweight
- deterministic rules-first анализатор
- сегментация пунктов и role extraction на эвристиках
- локальное хранение метаданных и результатов анализа

2. Tier 2 — условно локально
- компактная quantized semantic-модель только если ее польза измерима
- строгий лимит по размеру AI-бандла и latency

3. Tier 3 — server-assisted fallback
- тяжелая semantic reasoning логика
- восстановление качества на слабых сканах
- при этом схема ответа должна остаться той же, чтобы mobile UX не менялся

## Как это отражено в текущем analysis-engine
Политика зашита в `services/analysis-engine/app/config/analysis_config.json`, секция `execution_strategy`.

Текущие правила маршрутизации:
- `document_text` -> `local_first`
- `document_base64` -> `server_assist` по умолчанию
- `mime_type` overrides могут принудительно переключить PDF/изображения/office binaries в `server_assist`

Во всех ответах присутствует `execution_plan`:
- `mode`
- `offline_capable`
- `network_required`
- `policy_source`
- `reason`

Это позволяет mobile/core-api понимать выбранный маршрут, не вводя отдельный API-контракт.

## Шаблон распределения общего бюджета (<= 228 МБ)
Рекомендуемое распределение:
- core app + UI + platform dependencies: `95-125 МБ`
- AI assets total: `45-70 МБ`
- shared non-AI libs и интеграции: `20-30 МБ`
- резерв под патчи и compliance: `10-20 МБ`

Жесткая политика:
- soft warning: `> 210 МБ`
- release risk: `> 220 МБ`
- hard fail: `> 228 МБ`

## Рекомендации против раздувания размера
1. Сначала rules-first baseline, потом только semantic модель.
2. Не включать крупные foundation models в дефолтный релиз.
3. Использовать quantized модели (`int8/int4`) и убирать неиспользуемые операторы.
4. По возможности держать один общий tokenizer/vocabulary на все языки.
5. Дедуплицировать OCR/NLP runtime libraries между модулями.
6. Удалять неиспользуемые ABI/debug symbols из release output.
7. Держать локализацию компактной: общие ключи, без дублирования больших prompt body.
8. Отслеживать size delta по компонентам в CI на каждом merge.

## План действий при превышении лимита (> 228 МБ)

### Фаза 0: измерение и ownership
1. Снять отчет по размеру итогового артефакта и топ-вкладчикам.
2. Разделить вклад на AI и non-AI.
3. Подтвердить AI share и топ-5 тяжелых AI-ассетов.

### Фаза 1: оптимизации без изменения UX
1. Пережимать assets и удалять debug symbols.
2. Убирать дублирующиеся native/runtime библиотеки.
3. Применять более жесткую quantization для локальных моделей.

### Фаза 2: порядок отключения/offload
1. Первым выключается локальный semantic LLM/classifier.
- rules-first risk extraction должен остаться локальным
- advanced semantic reasoning переносится в backend API

2. Затем урезается OCR package breadth.
- остается только must-have OCR конфигурация
- сложные сканы уезжают в server-assisted fallback

3. Затем отключаются вторичные AI enrichment-слои.
- embedding rerankers
- explanation generation layers

4. Затем ужимаются multilingual AI artifacts.
- сохраняется единый multilingual asset set
- удаляются дубли по языкам

5. Базовый локальный пользовательский опыт нельзя ломать.
- local ingestion
- clause segmentation
- deterministic risk output

### Фаза 3: release-варианты без пост-установочных скачиваний
1. Допустимо выпустить две полные install-вариации, выбираемые до установки:
- `Standard` — lightweight local-first + server semantic fallback
- `Extended` — более тяжелый локальный AI pack, если это разрешает store policy
2. UX и API-schema у обеих вариаций должны быть одинаковыми.

### Фаза 4: аварийный стоп
Если после Фазы 1-3 размер все еще > `228 МБ`:
- release candidate блокируется
- вопрос эскалируется на архитектурный разбор с явным cut list и impact note

## Product и quality guardrails
1. Локальный режим всегда должен выдавать schema-valid результат, даже при низкой уверенности.
2. Переход с local semantic на rules-first fallback должен быть детерминированным и наблюдаемым.
3. Server-assisted ветка не должна ломать пользовательский flow и API-контракты.
4. Приватность по умолчанию:
- промежуточные артефакты хранятся локально
- на сервер уходит только то, что реально требуется fallback-ветке

## CI/CD проверки
1. Global size gate
- pass: `<= 210 МБ`
- warning: `210-228 МБ`
- fail: `> 228 МБ`

2. AI share gate
- pass: `<= 35%`
- warning: `> 35%` и `<= 40%`
- hard review: `> 40%`

3. Offline smoke checks
- анализ representative digital contract без сети
- анализ representative scanned contract без сети, если compact OCR реально включен в build

4. Проверки локализации
- `ru/en/it/fr` остаются schema-valid в local mode

5. Проверки mode consistency
- и `local_first`, и `server_assist` обязаны соответствовать одной и той же API-схеме
