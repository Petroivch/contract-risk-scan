# Contract Risk Scanner

Mobile-first project for Android and iPhone that analyzes contract files and returns:
- risks
- disputed clauses
- role-focused summary

Supported UI languages:
- `ru` default
- `en`
- `it`
- `fr`

## Repository layout

- `apps/mobile` - React Native + Expo mobile client
- `services/core-api` - NestJS core API
- `services/analysis-engine` - FastAPI analysis service
- `db` - SQL schema and migrations
- `docs` - architecture, UI, frontend, backend, DB handoff docs

## Current development mode

The mobile app supports two runtime modes:

1. `stub` mode  
   UI works without a running backend. Good for interface review and UX testing.

2. `api` mode  
   Mobile app talks to `core-api`, which then integrates with `analysis-engine`.

Default local development is currently oriented around interface-first work. For full end-to-end behavior, run both backend services and switch the mobile runtime config away from stub transport.

## Prerequisites

For all environments:
- `Node.js 20 LTS`
- `npm 10+`
- `Python 3.11+`
- `VS Code`

For Android local run/build:
- `Android Studio`
- Android SDK
- Java 17
- USB debugging or Android emulator

For iPhone local run/build:
- `macOS`
- `Xcode`
- CocoaPods
- iPhone simulator or physical iPhone

Important:
- Android can be developed from Windows.
- iPhone native build cannot be produced locally from Windows with `expo run:ios`; that requires macOS/Xcode.

## VS Code workflow

Open the repository root:

```powershell
cd C:\path\to\contract-risk-scan
code .
```

Recommended VS Code extensions:
- `dbaeumer.vscode-eslint`
- `esbenp.prettier-vscode`
- `ms-python.python`
- `ms-python.vscode-pylance`
- `ms-azuretools.vscode-docker`

## Fast interface start on another computer

If the goal is only to open and test the interface quickly:

```powershell
cd apps\mobile
npm install
npx expo start --web
```

Then open the local URL shown by Expo, usually:

```text
http://localhost:8081
```

or:

```text
http://localhost:19006
```

Depending on Expo port selection.

## Run the mobile interface in development

### 1. Install mobile dependencies

```powershell
cd apps\mobile
npm install
```

### 2. Start Expo

```powershell
npm run start
```

### 3. Run on Android

```powershell
npm run android
```

This uses the native Android toolchain and is suitable for:
- Android emulator
- connected Android phone

### 4. Run on iPhone

```bash
cd apps/mobile
npm install
npm run ios
```

This requires:
- macOS
- Xcode

If another developer is on Windows, they can still run:
- web preview
- Android app

but not a local native iPhone build.

## Run full local stack

### 1. Start analysis engine

```powershell
cd services\analysis-engine
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8010
```

### 2. Start core API

In another terminal:

```powershell
cd services\core-api
copy .env.example .env
npm install
npm run start:dev
```

### 3. Start mobile app

In another terminal:

```powershell
cd apps\mobile
npm install
npm run start
```

## Web-only interface review

If a designer, PM, or reviewer only needs the interface:

```powershell
cd apps\mobile
npm install
npx expo start --web
```

This is the simplest reproducible command set for another computer.

## Quality commands

### Mobile

```powershell
cd apps\mobile
npm run lint
npm run typecheck
```

### Core API

```powershell
cd services\core-api
npm install
npm run lint
npm run build
```

### Analysis engine

```powershell
cd services\analysis-engine
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m pytest -q
```

## Mobile build notes

### Android

For a native Android build on a machine with Android Studio:

```powershell
cd apps\mobile
npm install
npx expo prebuild --platform android
npm run android
```

For a release APK/AAB, the Android signing and release pipeline still needs to be finalized in the project build flow.

### iPhone

For a native iPhone build on macOS:

```bash
cd apps/mobile
npm install
npx expo prebuild --platform ios
npm run ios
```

For an installable iPhone release package, signing, provisioning profile, and Xcode archive/export steps are still required.

## Release expectations

The user requirement for this project is:
- the end user installs only the final mobile package
- no additional downloads after install
- target total final release size budget: `228 MB` max

Current implementation direction:
- local-first mobile cache
- multilingual UI and analysis output
- config-driven behavior instead of hardcoded runtime values

## Important current limitations

- `core-api` still contains stage-1 stub/in-memory parts
- `analysis-engine` is a working skeleton with tests, but not yet a production NLP/OCR pipeline
- native release packaging for Android/iPhone is not fully finalized in-repo yet
- iPhone local native build requires macOS

## Key docs

- `docs/ui/README.md`
- `docs/ui/08_visual-themes-and-hifi-spec.md`
- `docs/frontend/setup.md`
- `docs/frontend/integration-notes.md`
- `docs/backend-core/integration-notes.md`
- `docs/backend-ai/core-api-locale-contract.md`
- `docs/db/README.md`
