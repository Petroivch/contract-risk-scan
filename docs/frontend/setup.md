# Frontend Setup (React Native / Expo)

## Working Directory
- `C:\Users\user\Documents\Codex\вайбкод\contract-risk-scan\apps\mobile`

## Runtime Rule (No Post-Install Downloads)
- User installs only the final release app package.
- After installation, app must work without downloading additional modules/assets/features.
- MVP bundle must include all UI assets, dictionaries (`ru/en/it/fr`) and local data schema migrations.

## Prerequisites (Developer)
- Node.js 20 LTS
- npm 10+
- VS Code
- Android Studio (Android emulator)
- Xcode (iOS simulator on macOS)

## Install and Run
1. Open terminal in `apps/mobile`.
2. Install dependencies: `npm install`
3. Start app: `npm run start`
4. Launch platform:
   - Android: `npm run android`
   - iOS: `npm run ios`

## i18n Configuration
- Default language: `ru`
- Supported languages: `ru`, `en`, `it`, `fr`
- Fallback language: `ru`
- Translation resources: `apps/mobile/src/i18n/resources/*.ts`
- Language persistence: AsyncStorage key from runtime config (`LANGUAGE_PREFERENCE_KEY`)

## Local-First
- Local DB/cache is mandatory for MVP.
- Current frontend architecture includes:
  - SQLite cache storage (status/report/history)
  - file cache helper
  - local-first API adapter with fallback to SQLite when remote request fails
- Details: `docs/frontend/local-first-architecture.md`

## Quality and Architecture Standards
- No hardcoded runtime-critical values in UI components.
- Endpoints, limits, timeouts, role presets and feature flags are read from config (`app.json` `expo.extra` + env overrides).
- UI text is only from i18n dictionaries.

## Release Size Budget
- Global project budget: `228 MB` (total final release size).
- Frontend mobile target share and optimization checklist: `docs/frontend/package-size-optimization.md`

## Recommended VS Code Extensions
- `dbaeumer.vscode-eslint`
- `esbenp.prettier-vscode`
- `msjsdiag.vscode-react-native`
- `expo.vscode-expo-tools`
- `christian-kohler.path-intellisense`
- `usernamehw.errorlens`
- `eamodio.gitlens`

## Visual Implementation
- Theme tokens and visual shell notes: docs/frontend/visual-implementation-notes.md`n
