# Contract Risk Scanner

Mobile-first contract review product with a React Native client, a NestJS core API, and a FastAPI analysis engine.

The product surfaces preliminary risk indicators, disputed clauses, and a structured summary. It is not a legal opinion and does not certify that a contract is safe to sign.

## Repository layout

- `apps/mobile` - Expo mobile client for Android and iPhone
- `services/core-api` - NestJS API for upload, analyze, status, report, and history flows
- `services/analysis-engine` - FastAPI analysis service and corpus tooling
- `db` - schema, migrations, and SQL artifacts
- `docs` - product, frontend, backend, database, and reporting documentation

## Current runtime state

### Mobile

- Supported languages: `ru`, `en`, `it`, `fr`; default and fallback are `ru`
- `app.json` ships with `API_TRANSPORT=http` and targets the backend path by default
- `ENABLE_LOCAL_FIRST_CACHE`, `ENABLE_SQLITE_CACHE`, and `ENABLE_FILE_CACHE` are all `false` by default
- The current mobile runtime is memory-first: the app does not create an app-managed SQLite database or file cache
- The only intentional persisted user setting in the client is the language preference stored through AsyncStorage
- Document picker flows can still leave temporary OS-level or session-local copies while a file is being read

### Backend

- `services/core-api` keeps uploaded source files in memory for the active analysis flow and does not persist raw contract files to disk by default
- `services/analysis-engine` exposes `/analysis/run`, `/analysis/{job_id}/status`, and `/analysis/{job_id}/result`
- Backend services are the primary upload/analyze/status/report path for the current Android runtime

## Release and artifact policy

- The only installable release artifact that may stay tracked in the repository is `/contract-risk-scanner-android.apk` in the repo root
- Do not commit additional `.apk`, `.aab`, or `.ipa` outputs from Gradle, Expo EAS, or Xcode
- Do not commit ad hoc corpus sweeps, smoke runs, timestamped evaluation reports, base64 payload dumps, or one-off exported report files
- Canonical checked-in analysis-engine evaluation assets are limited to:
  - `services/analysis-engine/artifacts/corpus_results_iter2/`
  - `services/analysis-engine/reports/corpus_evaluation.json`
  - `services/analysis-engine/reports/corpus_evaluation.md`

## Quality commands

### Mobile

```powershell
cd apps\mobile
npm ci
npm run typecheck
npm run lint
npm run smoke
```

### Core API

```powershell
cd services\core-api
npm ci
npm run lint
npm run test
npm run build
```

### Analysis Engine

```powershell
cd services\analysis-engine
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m pytest tests/test_evaluation_helpers.py tests/test_quality_metrics.py -q
```

## Android and iOS release notes

- Android `release` signing requires `CONTRACT_RISK_RELEASE_STORE_FILE`, `CONTRACT_RISK_RELEASE_STORE_PASSWORD`, `CONTRACT_RISK_RELEASE_KEY_ALIAS`, and `CONTRACT_RISK_RELEASE_KEY_PASSWORD`
- Debug-signed internal Android builds use `apps/mobile/android` and `.\gradlew.bat assembleInternal`
- iOS installable builds are configured through Expo EAS in `apps/mobile/eas.json`
- A usable iOS `.ipa` still requires Apple Developer credentials and valid signing/provisioning

## Documentation index

- `apps/mobile/README.md`
- `services/core-api/README.md`
- `services/analysis-engine/README.md`
- `docs/db/README.md`
- `docs/frontend/setup.md`
- `docs/frontend/local-first-architecture.md`
- `docs/reporting/analysis_engine_corpus_tooling.md`
