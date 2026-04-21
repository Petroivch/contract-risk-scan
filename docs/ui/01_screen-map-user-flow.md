# 01. Screen Map and User Flow

## 1) Screen Map

1. Splash
2. Onboarding (3 slides)
3. Auth Gateway
4. Sign In (email + OTP / magic link)
5. Role Selection (editable dropdown)
6. Upload Contract
7. Parsing/Analysis Status
8. Report
9. History
10. Report Details (opened from History)
11. Settings/Profile (language, notifications, legal)

Target platforms for this UX map: mobile apps only (Android and iOS).

## 2) Information Architecture

### Bottom Navigation
- Home (upload + recent report shortcut)
- History
- Settings

### Implementation Standard
- UI copy and labels are referenced by i18n keys only.
- Numeric limits are referenced by constants from `06_ui-quality-standards.md`.

### Local-First Scope
- Locally available without network:
- history list metadata;
- previously opened reports and cached tab content;
- selected role and app language;
- user preferences (notifications, legal acknowledgement flags).
- Sync model: write locally first, then sync when online.

### Language Support
- Default locale: `ru`.
- Supported locales: `ru`, `en`, `it`, `fr`.
- Language selector location: Settings/Profile (mandatory).

### Report Tabs
- Risks
- Disputed Clauses
- Summary

## 3) Primary User Flow (happy path)

1. Open app -> Splash -> Onboarding (first launch only).
2. User signs in.
3. User lands on Role Selection.
4. User chooses role from editable dropdown:
- `role.option.contractor`
- `role.option.employer`
- custom role (free text, max length = `CONST_ROLE_MAX_LENGTH`)
5. User proceeds to Upload Contract and selects file (allowed formats from backend contract; max size = `CONST_UPLOAD_MAX_FILE_MB`).
6. App uploads file and starts analysis.
7. User sees Parsing/Analysis Status with stage progress.
8. On success, app opens Report tab set:
- Risks (default tab)
- Disputed Clauses
- Summary (role-focused obligations)
9. User saves report to History.
10. Later user opens History -> Report Details.

## 3.1) Local-First / Offline UX Flow (mandatory)

1. User opens app with no internet.
2. Home shows offline indicator and available local content.
3. User opens History and can read cached reports locally.
4. User attempts new upload while offline:
- app offers queue option via key `upload.offline_queue_cta`;
- file and metadata stored locally with `queued` status.
5. Network restored:
- app prompts or auto-starts upload for queued items;
- status changes from `queued` -> `uploading` -> `analyzing` -> `ready`.
6. If user disables auto-sync, queued items remain local until manual action.

## 3.2) No-Extra-Download Policy UX Flow (mandatory)

1. User installs release build and launches app.
2. App does not request additional model/content downloads.
3. If optional feature is unavailable because of no-download policy, app explains:
- feature is not included in current build;
- core analysis flow remains available.

## 3.3) Language Selection UX Flow (mandatory)

1. App starts with locale resolution:
- if saved user preference exists -> use it;
- else if device locale in supported set (`ru`, `en`, `it`, `fr`) -> use device locale;
- else -> fallback to `ru`.
2. User opens Settings/Profile.
3. User taps key `settings.language_title`.
4. User selects one option:
- `ru` (Русский)
- `en` (English)
- `it` (Italiano)
- `fr` (Français)
5. App applies language immediately on the current screen and persists preference without extra confirmation step.
6. If some keys are missing in selected locale, UI falls back to `ru` for missing strings only.
7. During active analysis, language switch is allowed without canceling analysis; status/report UI refreshes labels in selected language.

## 4) Alternative Flows

### 4.1 Auth failed
- User gets inline error and retry CTA.

### 4.2 Unsupported file or too large
- Upload blocked with validation message and file requirements hint.

### 4.3 OCR/analysis timeout
- Status screen shows timeout with options:
- Retry analysis
- Upload another file
- Contact support

### 4.4 No significant risks found
- Report still generated with:
- low-risk badge
- explanation of analysis limits
- suggestion to review manually.

### 4.5 Role edited after report ready
- App asks: "Rebuild report with updated role focus?"
- If confirmed, trigger role re-focus without re-upload when cached analysis payload is sufficient; otherwise request backend re-ranking using existing uploaded file reference.

### 4.6 Language changed while viewing report
- App keeps report data and refreshes UI strings immediately.
- If backend summary/disclaimer in selected language is unavailable, show `ru` content and flag `shown_in_fallback_language`.

### 4.7 Missing translation key
- UI renders `ru` value for missing key.
- Non-blocking log event sent for localization QA.

### 4.8 Offline at upload start
- Upload action is converted to local queue action.
- User sees ETA note: processing starts after connection recovery.

### 4.9 Offline while viewing history/report
- Local cached content remains accessible.
- Non-cached parts show lightweight placeholder with retry when online.

### 4.10 Total release build exceeds `CONST_RELEASE_TOTAL_BUDGET_MB` (global gate)
- Release is blocked before store submission.
- Product applies size optimization profile (see Section 6).
- If UX cuts are enabled, app surfaces transparent note in Settings -> "Lite mode details".

## 5) Entry Points
- First run -> onboarding flow.
- Push notification "Analysis complete" -> opens Report Details.
- History item tap -> Report Details.
- Offline launch -> opens Home/History with local data first.

## 6) Total Release Budget UX Plan (Threshold: `CONST_RELEASE_TOTAL_BUDGET_MB`)

### Trigger
- Measured total final release build size is `> CONST_RELEASE_TOTAL_BUDGET_MB`.
- Total size includes full app package (code, native dependencies, bundled UI assets, embedded resources).

### UX-first optimization sequence
1. Remove non-critical visual assets (large illustrations, heavy animations).
2. Reduce embedded media quality for onboarding backgrounds.
3. Replace animated loaders with static placeholders on onboarding, history, and settings first; keep explicit stage feedback on Status.
4. Limit number of bundled custom fonts/weights.
5. Move advanced, non-core screens behind "not in this build" note (only if required).

### UI assets optimization priority (first-pass)
1. Onboarding raster/video assets (compress, reduce resolution, remove duplicates).
2. Animation assets (Lottie/GIF/video) -> replace with lighter static/limited-motion versions.
3. Custom fonts -> keep one family and minimal weights.
4. Icon/image sets -> remove unused assets and prefer vector where runtime-safe.
5. Illustration packs for empty states -> keep only core screens.
6. Decorative backgrounds/gradients -> simplify to code-generated styles before removing any functional content block.

### User communication rules
- Do not ask user to download extra packs/modules.
- Explain reduced capabilities in plain text inside Settings > Lite mode details.
- Do not hide removed features silently.

## 7) UX Compromises If Total Build > `CONST_RELEASE_TOTAL_BUDGET_MB`
- Simplified onboarding visuals (fewer illustrations, less motion).
- Fewer font variants (possible small typography expressiveness loss).
- Reduced animation richness on status/report transitions.
- Some non-core convenience features delayed to next release.
- Deeper historical cache window is the first storage-related compromise on low-storage devices and must be disclosed in Lite mode details if applied.
- Any compromise decision is validated against the global release budget, not a UI-only budget.

## 8) UX Acceptance Criteria for Stages 1-2
- User can reach upload in <= `CONST_NAV_TO_UPLOAD_MAX_TAPS` taps from authenticated home.
- Role input is editable and clearly affects report focus.
- Every async state has visible progress and at least one recovery action.
- Report tabs are understandable without training.
- User can change app language in Settings/Profile at any time.
- App supports `ru`, `en`, `it`, `fr` with `ru` as default.
- Missing translations never break UI and always fall back to `ru`.
- Existing history/reports are accessible in offline mode from local cache.
- User is never forced to download post-install content.
- Release UX profile remains compliant with global release threshold `<= CONST_RELEASE_TOTAL_BUDGET_MB`.
