# 04. Microcopy and Localization Spec (No Hardcode)

## 1) Objective
Define production-grade i18n rules so UI text is loaded only from localization resources, never from inline component literals.

## 2) Source of Truth
- Localization resources are key-based catalogs per locale.
- Recommended structure:
  - `i18n/ru.json` (default + fallback)
  - `i18n/en.json`
  - `i18n/it.json`
  - `i18n/fr.json`
- Runtime locale fallback: `active_locale_key -> ru -> missing_key_error`.

## 3) Language Policy (MVP)
- Default locale: `ru`.
- Supported locales: `ru`, `en`, `it`, `fr`.
- Missing key in active locale must render `ru` value.
- Localization failure must not block critical user actions.

## 4) Required Key Namespaces
- `onboarding.*`
- `auth.*`
- `role.*`
- `upload.*`
- `status.*`
- `report.tabs.*`
- `report.summary.*`
- `history.*`
- `settings.*`
- `disclaimer.*`
- `errors.*`
- `empty.*`
- `cta.*`
- `offline.*`
- `lite_mode.*`

## 5) Mandatory Key Sets by UX Zone

### Onboarding/Auth
- `onboarding.slide_1_title`
- `onboarding.slide_2_title`
- `onboarding.slide_3_title`
- `auth.sign_in_title`
- `auth.email_label`
- `auth.send_code_cta`
- `auth.sending_code`
- `auth.signing_in`
- `errors.auth_sign_in_failed`

### Role Selection
- `role.title`
- `role.field_label`
- `role.helper`
- `role.placeholder`
- `role.option.contractor`
- `role.option.employer`
- `role.use_custom_role_cta`
- `errors.role_required`
- `errors.role_max_length`

### Upload / Status
- `upload.title`
- `upload.choose_file_cta`
- `upload.progress`
- `upload.file_requirements`
- `upload.offline_queue_cta`
- `status.stage_file_received`
- `status.stage_text_extraction`
- `status.stage_clause_detection`
- `status.stage_risk_scoring`
- `status.stage_report_generation`
- `status.still_working_notice`

### Report / History
- `report.tabs.risks`
- `report.tabs.disputed`
- `report.tabs.summary`
- `empty.no_critical_risks`
- `empty.no_disputed_clauses`
- `empty.no_reports`
- `history.offline_empty_hint`

### Settings / Localization
- `settings.language_title`
- `settings.language_applying`
- `settings.language_applied`
- `settings.language_fallback_notice`
- `settings.lite_mode_details_title`

### Offline / Local-First
- `offline.banner`
- `offline.cached_data_available`
- `offline.queue_saved`
- `offline.sync_resumed`

### Build Budget / Lite Mode
- `lite_mode.notice`
- `lite_mode.removed_visual_assets`
- `lite_mode.core_features_available`
- `lite_mode.learn_more_cta`

### Disclaimers and Legal
- `disclaimer.short`
- `disclaimer.full`

## 6) Template Keys (Dynamic Content)
- `report.summary.contractor_template`
- `report.summary.employer_template`
- `report.summary.custom_role_template`

Template rules:
- Use named placeholders only: `{role}`, `{obligations}`, `{risks}`.
- Placeholder names must be identical across locales.
- No grammar by string concatenation in code.

## 7) Hardcode Ban Rules
- Components/screens must not contain inline user-facing literals.
- Debug/test literals must be blocked from release branch.
- Any new UI text must be added to key catalog first.

## 8) QA and Release Checks
- Check 1: 100% UI text coverage by keys.
- Check 2: each required namespace exists in all locales.
- Check 3: forced missing key in `en/it/fr` falls back to `ru`.
- Check 4: localization fallback event emitted (`localization_fallback_triggered`).
- Check 5: no literal strings in UI source (static lint rule).
