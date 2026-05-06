# Analysis Engine

FastAPI-сервис извлечения текста и анализа договоров для Android-приложения.

## Что делает сервис

- принимает `PDF`, `DOCX`, `TXT` и поддерживаемые входные форматы;
- извлекает текст и при необходимости использует OCR fallback для scanned PDF;
- определяет роли сторон и тип договора;
- считает риски и спорные формулировки;
- строит структурированную сводку для выбранной роли.

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

- `.doc` не считается надежным входным форматом; перед загрузкой его лучше сохранить как `DOCX`, `PDF` или `TXT`;
- прямое извлечение текста из `PDF` пробуется раньше OCR;
- OCR fallback зависит от установленного `Tesseract` и связанных библиотек.

## Проверки

```powershell
python -m pytest -q
```
