# Заметки по интеграции frontend

## Актуальный контракт Mobile -> Core API

### Upload
- `POST /contracts/upload`
- multipart/form-data
- frontend отправляет:
  - `role`
  - `locale`
  - `counterpartyRole` при необходимости
  - `contractLabel` при необходимости
  - `file`

### Analyze
- `POST /contracts/:id/analyze`
- JSON body
- frontend отправляет:
  - `locale`
  - `focusNotes` при необходимости

### Status
- `GET /contracts/:id/status`

### Report
- `GET /contracts/:id/report`

### History
- `GET /contracts/history`

## Что хранит frontend
- `contractId`
- `analysisId`
- `selectedRole`
- `locale`
- `pipelineStatus`
- `status`
- `originalFileName`
- локальный путь к файлу для offline fallback

## Local-first поведение
1. frontend сначала пробует реальный HTTP backend;
2. при успехе сохраняет status/report/history в SQLite;
3. при ошибке уходит в локальный fallback-клиент;
4. fallback-клиент проводит пользователя через offline flow до отчета;
5. результат также сохраняется в SQLite и попадает в историю.

## Почему flow теперь end-to-end
- старый упрощенный путь фактически сводился к локальной заглушке;
- теперь frontend понимает реальный backend shape:
  - upload;
  - отдельный analyze;
  - отдельный status;
  - отдельный report;
  - history;
- при отсутствии backend весь путь продолжает работать локально на телефоне.

## Визуальный контракт
- единый `ScreenShell`
- card/panel grammar через `Panel`, `StatusChip`, `ActionButton`
- risk/disputed cards опираются на token layer
- статусы и роль остаются видимыми по всему ключевому user flow

## Ограничения
- локальный stub нужен именно как mobile fallback, а не как замена backend в production-инфраструктуре;
- для реального сетевого сценария release build должен получить корректный `API_BASE_URL`.
