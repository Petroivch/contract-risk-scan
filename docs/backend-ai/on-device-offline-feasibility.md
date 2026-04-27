# Feasibility on-device и offline

## Назначение
Документ фиксирует, как `Contract Risk Scanner` должен соблюдать мобильные ограничения:
- после установки пользователь ничего не скачивает отдельно
- local-first поведение используется везде, где это реально

Ниже описаны последствия именно для `analysis-engine` и handoff-ограничения для mobile/platform-команд.

## Глобальные ограничения
1. Release-приложение должно уже содержать все обязательные runtime assets.
2. После установки нельзя скачивать модели, rule packs и data packs.
3. Предпочтение отдается локальному анализу и локальному хранению, пока качество и latency приемлемы.

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

## Рекомендации против раздувания размера
1. Сначала rules-first baseline, потом только semantic модель.
2. Не включать крупные foundation models в дефолтный релиз.
3. Использовать quantized модели (`int8/int4`) и убирать неиспользуемые операторы.
4. По возможности держать один общий tokenizer/vocabulary на все языки.
5. Дедуплицировать OCR/NLP runtime libraries между модулями.
6. Удалять неиспользуемые ABI/debug symbols из release output.
7. Держать локализацию компактной: общие ключи, без дублирования больших prompt body.
8. Отслеживать size delta по компонентам в CI на каждом merge.
## План действий при росте размера

### Фаза 0: измерение и ownership
1. Снять отчет по размеру итогового артефакта и топ-вкладчикам.
2. Разделить вклад на AI и non-AI.
3. Подтвердить топ-5 тяжелых AI-ассетов.

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
1. Offline smoke checks
- анализ representative digital contract без сети
- анализ representative scanned contract без сети, если compact OCR реально включен в build

2. Проверки локализации
- `ru/en/it/fr` остаются schema-valid в local mode

3. Проверки mode consistency
- и `local_first`, и `server_assist` обязаны соответствовать одной и той же API-схеме
