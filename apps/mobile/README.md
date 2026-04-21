# Contract Risk Scanner - Mobile App

React Native (Expo) mobile client for Android and iOS.

## MVP Highlights
- Screen flow: `Auth -> UploadWithRole -> AnalysisStatus -> Report -> History -> Settings`
- i18n: `ru` default + `en/it/fr` with fallback to `ru`
- Local-first data flow: SQLite cache + local-first adapter fallback
- Real document selection via system picker + local file cache for upload flow
- Queued upload fallback when immediate remote upload is unavailable
- Theme-layer with design tokens (colors/typography/radius/shadow/motion)
- Reusable styled components: `RoleBadge`, `RiskCard`, `DisputedCard`

## Runtime Rule
- User installs release package only.
- No additional feature/module downloads after install.

## Quick Start
1. `npm install`
2. `npm run start`
3. Android: `npm run android`
4. iOS: `npm run ios`

## Quality Scripts
- `npm run lint`
- `npm run typecheck`
- `npm run format`

## Frontend Docs
- Setup: `docs/frontend/setup.md`
- Integration: `docs/frontend/integration-notes.md`
- Local-first: `docs/frontend/local-first-architecture.md`
- Size budget: `docs/frontend/package-size-optimization.md`
- Visual notes: `docs/frontend/visual-implementation-notes.md`
