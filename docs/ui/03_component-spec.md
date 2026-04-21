# 03. Component Design Spec (Production-Grade)

## 1) System Rules (No Hardcode)
- All user-facing text must be referenced by i18n key.
- All visual values must use design tokens (no ad-hoc colors/sizes).
- All numeric limits must reference constants from `06_ui-quality-standards.md`.
- Any new value requires documented rationale and owner.

## 2) Token Contract

### Color Tokens (semantic)
- `color.brand.primary`
- `color.brand.primaryHover`
- `color.risk.critical`
- `color.risk.high`
- `color.risk.medium`
- `color.risk.low`
- `color.status.success`
- `color.status.info`
- `color.status.warning`
- `color.status.error`
- `color.surface.default`
- `color.surface.muted`
- `color.surface.elevated`
- `color.text.primary`
- `color.text.secondary`
- `color.text.inverse`

### Typography Tokens
- `typography.display.s`
- `typography.title.l`
- `typography.title.m`
- `typography.body.m`
- `typography.body.s`
- `typography.label.m`
- `typography.caption.s`

### Spacing and Layout Tokens
- `space.2`, `space.4`, `space.8`, `space.12`, `space.16`, `space.24`, `space.32`
- `radius.s`, `radius.m`, `radius.l`
- `elevation.0`, `elevation.1`, `elevation.2`

### Border and Indicator Tokens
- `border.subtle`
- `border.strong`
- `border.role.custom`
- `indicator.confidence.*`

### Motion Tokens
- `motion.duration.fast`
- `motion.duration.normal`
- `motion.easing.standard`

## 3) Component: `RiskCard`

### Purpose
Render one detected risk with severity, impact, and recommendation.

### Data Fields
- `risk_title_key` or `risk_title_text`
- `severity`
- `clause_reference`
- `impact_summary_key` or `impact_summary_text`
- `recommendation_key` or `recommendation_text`
- `confidence_score`

### Behavior
- Tap expands details.
- Bookmark action optional.
- Default sort by severity descending.

### States
- `normal`
- `expanded`
- `loading`
- `error`

### Token Rules
- Severity accent uses `color.risk.*` semantic tokens.
- Typography and spacing use token contract only.

## 4) Component: `DisputedClauseCard`

### Purpose
Render ambiguous clause likely to cause dispute.

### Data Fields
- `clause_quote`
- `why_disputed_key` or `why_disputed_text`
- `party_impact`
- `suggested_revision_key` or `suggested_revision_text`
- `confidence_score`

### Constraints
- Quote preview max chars: `CONST_DISPUTED_PREVIEW_MAX_CHARS`.

### Behavior
- Tap expands full clause.
- Copy action optional.

### States
- `normal`
- `expanded`
- `loading`
- `empty_placeholder`

## 5) Component: `RoleBadge`

### Purpose
Show active role across upload/status/report contexts.

### Data Fields
- `role_label`
- `is_custom`

### Behavior
- Tap opens role edit modal.
- If role changes after report is ready, confirm re-focus flow.

### States
- `normal`
- `editing`
- `validation_error`

## 6) Component: `StatusBlock`

### Purpose
Represent processing stage and reliability status.

### Data Fields
- `stage_name_key`
- `stage_state` (`pending|active|done|failed|waiting_for_network`)
- `message_key`
- `eta_seconds` (optional)
- `action_type` (`retry|cancel|resume`) optional

### Behavior
- Real-time refresh via polling or websocket.
- Inactivity notice after `CONST_STATUS_STALL_NOTICE_SEC`.

### States
- `processing`
- `success`
- `warning`
- `error`

## 7) Component: `LanguageSelector`

### Purpose
Change locale in Settings/Profile.

### Data Fields
- `active_locale` (`ru|en|it|fr`)
- `available_locales[]`
- `fallback_notice_visible`

### Behavior
- Runtime switch without app restart.
- Persist selection.
- Missing key fallback to `ru` (per-key).

### States
- `normal`
- `applying`
- `save_error`

## 8) Global Constraints
- Minimum touch target: `CONST_TOUCH_TARGET_MIN_PX`.
- Title truncation: `CONST_CARD_TITLE_MAX_LINES`.
- Body truncation: `CONST_CARD_BODY_MAX_LINES`.
- Dynamic text support up to `CONST_DYNAMIC_TYPE_MAX_PERCENT`.
- Stable component IDs required for automated UI tests.
- Offline/local-first mode must preserve access to cached report/history content.
- Components used in hi-fi screens must map to `07_visual-direction-v1.md` and `08_visual-themes-and-hifi-spec.md` without introducing extra visual primitives outside this token contract.
