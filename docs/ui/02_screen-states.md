# 02. Screen States (normal/loading/empty/error)

## 1) Onboarding/Auth

### Normal
- Intro cards with short value statements.
- Sign in form with primary CTA.
- All labels/messages shown in active locale (`ru` default).
- Copy references i18n keys (`onboarding.*`, `auth.*`) only.

### Loading
- Button spinner keys: `auth.sending_code`, `auth.signing_in`.

### Empty
- N/A (form-driven screen).

### Error
- Invalid email format.
- Wrong/expired OTP.
- Network unavailable.
- Generic key: `errors.auth_sign_in_failed`.
- Missing translation key -> fallback to `ru` for key only.

## 2) Role Selection (editable dropdown)

### Normal
- Label key: `role.field_label`
- Editable dropdown + recent/custom suggestions.
- Helper key: `role.helper`
- Current app language indicator is shown in the header only on Settings/Profile; Role Selection keeps focus on role input.

### Loading
- If role presets loaded remotely: skeleton for list.

### Empty
- No suggestion matches typed role -> show CTA key `role.use_custom_role_cta`.

### Error
- Role field empty on continue.
- Role too long (`> CONST_ROLE_MAX_LENGTH`).
- Unsupported symbols (if validation enabled).
- Missing translation key -> fallback `ru`.

## 3) Upload Contract

### Normal
- Upload area + file requirements.
- Primary CTA key: `upload.choose_file_cta`.
- Texts localized to active locale.
- If offline, CTA changes to local queue action.

### Loading
- Upload progress bar with percent and cancel action.

### Empty
- No file selected yet.

### Error
- Unsupported format.
- File too large (`> CONST_UPLOAD_MAX_FILE_MB`).
- Upload failed (retry + choose another file).
- Missing translation key -> fallback `ru`.
- Offline network error -> offer key `upload.offline_queue_cta`.

## 4) Analysis Status

### Normal
- Stepper with stages:
1. `status.stage_file_received`
2. `status.stage_text_extraction`
3. `status.stage_clause_detection`
4. `status.stage_risk_scoring`
5. `status.stage_report_generation`

### Loading
- Active stage animation + ETA hint when backend provides `eta_seconds`; otherwise show `status.still_working_notice`.
- Language switch in Settings does not interrupt ongoing analysis.
- If connection drops, status pauses and item moves to `queued`/`waiting_for_network`.

### Empty
- N/A.

### Error
- Timeout, parser failure, AI service unavailable.
- Actions: Retry, Back to Upload, Contact support.
- Missing translation key -> fallback `ru`.

## 5) Report (tabs)

### Normal
- Tab 1 Risks: ranked cards by severity.
- Tab 2 Disputed Clauses: clauses requiring interpretation.
- Tab 3 Summary: key obligations and responsibilities focused on selected role.
- Tabs, labels, CTA, and disclaimers are localized.

### Loading
- Skeleton cards per tab during report fetch/re-rank.

### Empty
- Risks tab key: `empty.no_critical_risks` + informational note key.
- Disputed tab key: `empty.no_disputed_clauses` + limits note key.
- Summary tab: fallback short summary with confidence label.

### Error
- Failed to load report / partial data missing.
- Retry section load.
- If localized backend narrative unavailable, display `ru` narrative + fallback marker.

## 6) History

### Normal
- Chronological report list with status and date.
- Search/filter by role and severity.
- Cached reports are available offline.

### Loading
- List skeletons.

### Empty
- Keys: `empty.no_reports`, `cta.upload_first_contract`.
- Offline + no cache: show dedicated local-empty hint.

### Error
- Fetch failed + retry.
- Missing translation key -> fallback `ru`.

## 7) Settings/Profile

### Normal
- Language, notifications, legal pages, sign out.
- Lite mode details (visible only when release optimizations are enabled).
- Language selector options:
- `ru` (Русский)
- `en` (English)
- `it` (Italiano)
- `fr` (Français)
- Current language has selected state.

### Loading
- Save preference spinner.
- Message key: `settings.language_applying`.

### Empty
- N/A.

### Error
- Preference update failed.
- On language load failure -> use `ru` and show non-blocking notice.

## 8) Local-First and Offline Rules

### Normal
- User can open cached history/report content without network.
- New uploads can be queued locally.

### Loading
- When network restores, queued items resume automatically (or by user action if auto-sync disabled).

### Empty
- If no cached data exists, show guidance to upload when online.

### Error
- Offline state must never block access to already cached reports.
- No blocking prompt to download additional modules/assets is allowed.

## 9) Cross-Screen Localization Rules

### Normal
- Active locale applies to onboarding/auth, upload, status, report tabs, errors, disclaimers, and all CTA.

### Loading
- Locale switch may trigger brief text skeletons, but it must preserve user state, scroll position, and active tab on the same screen.

### Empty
- Empty-state copy is localized and uses same keys across all locales.

### Error
- Fallback policy is deterministic: missing key/value -> render `ru`.
- Localization failure must never block core actions (upload, retry, open report).

## 10) Build Budget Optimization Mode (Total build > `CONST_RELEASE_TOTAL_BUDGET_MB`)

### Normal
- App runs in optimized UX profile ("Lite mode details" in Settings).

### Loading
- Heavy visual placeholders are replaced with lightweight equivalents.

### Empty
- If optional visual packs were removed from release, show neutral placeholder.

### Error
- UX must not suggest downloading additional in-app packs.
- If feature omitted due global budget constraints, show explanatory message and core-flow alternative.

## 11) Hardcode Ban Rules
- Screen documents must reference keys/constants/tokens, not literal production strings.
- Any literal string in this file is illustrative only and must map to i18n key before implementation.
