# Contract Risk Scanner: Analysis Engine (FastAPI)

## Зона ответственности
Этот сервис отвечает за пайплайн анализа договора в MVP:
- принимает задачу анализа через `POST /analysis/run`
- отслеживает жизненный цикл задачи через `GET /analysis/{job_id}/status`
- возвращает структурированный результат через `GET /analysis/{job_id}/result`
- определяет, можно ли обработать документ в `local_first`, или нужен `server_assist`

## Что реализовано сейчас
Текущая версия уже выполняет рабочий эвристический анализ договора:
- мультиязычный вывод: `ru`, `en`, `it`, `fr`
- язык по умолчанию и fallback: `ru`
- полностью конфигурируемый пайплайн без бизнес-хардкода в Python-коде
- стабильный `run -> status -> result` flow
- role-focused summary с приоритизацией выбранной роли
- `contract_brief`, который кратко объясняет, кто и кому что должен, где оплата, сроки и санкции
- rules-first извлечение рисков и спорных формулировок
- `execution_plan` в каждом ответе для mobile/core-api
- in-memory job store для MVP-стадии
- API-тесты на контракт, локализацию и содержательный результат анализа

## Ключевые принципы
- `no-hardcode`: правила, тексты, fallback и лимиты живут в конфиге
- `local-first`: легкие сценарии обрабатываются без обязательного offload
- совместимость с mobile/core-api по полям `language` и `locale`
- детерминированный fallback: пустые массивы и неинтерпретируемые ответы не допускаются

## Где что лежит
- `app/main.py` — точка входа FastAPI
- `app/api/routers/analysis.py` — HTTP-роуты анализа
- `app/schemas/analysis.py` — request/response и доменные схемы
- `app/localization.py` — нормализация языка и выбор локализованных значений
- `app/config/analysis_config.json` — главный runtime-конфиг пайплайна
- `app/config/models.py` — типизированные модели конфига
- `app/config/runtime.py` — загрузка и валидация runtime-конфига
- `app/services/analysis_orchestrator.py` — orchestration всего пайплайна
- `app/services/contract_brief.py` — генерация краткого объяснения договора
- `app/services/risk_scoring.py` — rules-first риски и спорные пункты
- `app/services/summary_generation.py` — role-focused summary
- `tests/` — API и flow tests

## Локальный запуск
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8010
```

## Быстрая проверка
```bash
python -m pytest -q
```

## Пример запроса
```bash
curl -X POST http://127.0.0.1:8010/analysis/run \
  -H "Content-Type: application/json" \
  -d '{
    "document_name": "contract.txt",
    "role_context": {"role": "исполнитель", "counterparty_role": "заказчик"},
    "document_text": "Исполнитель обязан выполнить работы в срок 10 дней. Заказчик обязан оплатить услуги в течение 5 банковских дней. Штраф за просрочку 1%.",
    "language": "ru"
  }'
```

## Ограничения текущей стадии
- OCR пока stub-based
- хранилище задач пока in-memory
- анализ остается эвристическим, без тяжелой semantic/LLM-модели
- для production нужны persistent queue/store, наблюдаемость и интеграционные тесты с core-api/mobile
