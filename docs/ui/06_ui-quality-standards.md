# 06. UI Quality Standards (No Hardcode, Production-Grade)

## 1) Mandatory Principles
- No hardcoded UI strings in components/screens.
- No ad-hoc colors/spacing/typography values; use tokens only.
- No magic numbers in UX/spec without constant ID and rationale.
- Any exception must be documented, reviewed, and approved.

## 2) Constants Registry

| Constant ID | Value | Scope | Rationale |
|---|---:|---|---|
| `CONST_RELEASE_TOTAL_BUDGET_MB` | 228 | Total final release build | Business/store distribution limit for whole app package |
| `CONST_UPLOAD_MAX_FILE_MB` | 20 | Upload validation | MVP backend contract and predictable mobile upload UX |
| `CONST_ROLE_MAX_LENGTH` | 50 | Role input | Prevent overflow and low-quality custom labels |
| `CONST_DISPUTED_PREVIEW_MAX_CHARS` | 280 | Clause card preview | Readability without over-expansion in list views |
| `CONST_STATUS_STALL_NOTICE_SEC` | 20 | Status UX | User reassurance before perceived freeze |
| `CONST_TOUCH_TARGET_MIN_PX` | 44 | Accessibility | Mobile accessibility baseline |
| `CONST_CARD_TITLE_MAX_LINES` | 2 | Card layout | Preserve scannability in dense report lists |
| `CONST_CARD_BODY_MAX_LINES` | 4 | Card layout | Balance info density and rhythm |
| `CONST_DYNAMIC_TYPE_MAX_PERCENT` | 200 | Accessibility | Support larger text without layout break |
| `CONST_NAV_TO_UPLOAD_MAX_TAPS` | 4 | UX KPI | Fast path from home to upload |

Note: if any value changes, update this table first, then dependent docs/components.

## 3) i18n Standards
- Resource files only (`ru`, `en`, `it`, `fr`), key-based access.
- `ru` is default and fallback locale.
- No concatenated sentence fragments for dynamic grammar.
- Missing key must trigger telemetry event and fallback to `ru`.

## 4) Design Token Standards
- Semantic tokens required for colors, typography, spacing, radius, elevation, motion.
- Token naming must be stable across iOS/Android/web client layers.
- Direct numeric style values are allowed only inside token definition source files.

## 5) Release Budget Governance (Global)
- Budget target applies to full release artifact, not UI-only slice.
- If total build exceeds `CONST_RELEASE_TOTAL_BUDGET_MB`, optimization must start with UI assets:
1. onboarding heavy media;
2. animation packs;
3. custom fonts;
4. unused icon/image sets;
5. decorative visual assets.
- No user-facing post-install downloads are allowed to compensate size.

## 6) Documentation Quality Gates
- Docs must contain stable IDs (keys/constants/tokens), not prose-only guidance.
- Every flow/state/component section must be testable from acceptance criteria.
- Handoff docs must include ownership and integration dependencies (FE/BE).
- Ambiguous terms like "fast", "large", "soon" are forbidden without measurable context.
