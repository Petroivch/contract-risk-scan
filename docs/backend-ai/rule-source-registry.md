# Реестр источников правил (контроль no-hardcode)

## Назначение
Этот реестр фиксирует источники для каждого конфигурируемого эвристического правила, которое использует `analysis-engine`.

## Канонический конфиг
- `services/analysis-engine/app/config/analysis_config.json`

## Политика по источникам
1. Правила и локализованные тексты — это конфигурационные артефакты, а не константы в коде.
2. Каждый `risk_rule` и `dispute_marker` обязан содержать `source_ref`.
3. Любое новое правило должно добавляться в конфиг и в этот реестр в одном и том же изменении.

## Источники risk rules
- `RSK-001` — базовая эвристика для penalty clause (taxonomy legal risk patterns, internal curation v1)
- `RSK-002` — базовая эвристика для liquidated damages / неустойки (internal curation v1)
- `RSK-003` — базовая эвристика для unilateral change/termination (internal curation v1)
- `RSK-004` — базовая эвристика для confidentiality obligations (internal curation v1)
- `RSK-005` — базовая эвристика для indemnification / возмещения убытков (internal curation v1)

## Источники dispute markers
- `DSP-001` — ambiguity marker для формулировок про будущее соглашение сторон (internal curation v1)
- `DSP-002` — marker для discretionary rights одной стороны (internal curation v1)
- `DSP-003` — marker для субъективных сроков без точной границы (internal curation v1)

## Требования к валидации
- все localized maps обязаны содержать `ru`, `en`, `it`, `fr`
- неподдерживаемые severity values отклоняются на этапе загрузки конфига
- отсутствие `source_ref` недопустимо для production-изменений
