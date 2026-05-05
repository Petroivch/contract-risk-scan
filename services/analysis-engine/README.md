# Analysis Engine

FastAPI сервис извлечения текста и анализа договоров. Используется Android-клиентом через `core-api` или напрямую в локальных тестах.

## Что делает сервис

- извлекает текст из `PDF`, `DOCX`, `TXT` и поддерживаемых форматов
- определяет тип договора и роль
- считает риски и спорные пункты
- строит структурированную сводку
- использует OCR fallback для scanned PDF и изображений, если в среде доступны OCR-зависимости

## API

- `POST /analysis/run`
- `GET /analysis/{job_id}/status`
- `GET /analysis/{job_id}/result`

## Быстрый старт

```powershell
cd services\analysis-engine
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8010
```

## Ограничения

- `.doc` не считается надежным входным форматом; его нужно сохранять как `DOCX`, `PDF` или `TXT`
- прямое извлечение текста из `PDF` пробуется раньше OCR
- OCR fallback зависит от установленного `Tesseract` и связанных библиотек

## Проверки

```powershell
python -m pytest -q
```

Для локального прогона по реальным документам можно использовать папки `договоры*`.
