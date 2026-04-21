# UX Documentation Pack - Contract Risk Scanner (Mobile)

## Scope
This folder contains UX artifacts for stages 1-2:
- screen map and user flow;
- screen state descriptions;
- component-level UI specification;
- microcopy and UX texts (including legal disclaimer);
- handoff requirements for frontend and backend.

## Product Context
Contract Risk Scanner is a mobile app (Android/iOS) where users upload a contract file and receive:
1. risk list;
2. disputed/ambiguous clauses;
3. short contract summary with role-focused obligations and responsibilities.

## Delivery and Storage Constraints (High Priority)
- User must not download anything after install except the release build from the store.
- UX must be local-first: reports/history remain available from local storage.
- Global release budget: `<= 228 MB` for the total final app build.
- If total build size exceeds `228 MB`, team must apply optimization plan and document UX compromises.

## Language Policy (MVP)
- Default language: `ru`.
- Supported languages: `ru`, `en`, `it`, `fr`.
- Language is selectable in Settings/Profile.
- Fallback behavior: if translation key is missing in active locale, show `ru`.

Users choose a role before upload using an editable dropdown:
- default options: "Contractor" / "Employer";
- user may type a custom role.

## Artifacts
1. `01_screen-map-user-flow.md`
2. `02_screen-states.md`
3. `03_component-spec.md`
4. `04_microcopy-guide.md`
5. `05_ui-handoff-requirements.md`
6. `06_ui-quality-standards.md`
7. `07_visual-direction-v1.md`
8. `08_visual-themes-and-hifi-spec.md`

## Document Contract
- `01` defines screen map, primary flows, and acceptance-level navigation rules.
- `02` defines state matrix per screen and cross-screen fallback behavior.
- `03` defines reusable component contracts, semantic tokens, and interaction states.
- `04` defines i18n namespaces, mandatory keys, and fallback rules.
- `05` defines frontend/backend handoff gates and integration checklist.
- `06` defines constants registry and documentation quality gates.
- `07` defines visual direction guardrails and anti-generic constraints.
- `08` defines theme application and screen-level hi-fi implementation behavior.

Precedence rule:
- If docs conflict, resolve in this order: `06` -> `04` -> `03` -> `01`/`02` -> `05` -> `07` -> `08`.
- `08` may refine visual behavior, but must not break constants, i18n rules, or flow contracts from earlier docs.

## Design Principles
- Clarity over decoration: legal insights must be readable in 3-5 seconds.
- Role-first interpretation: summary and highlights adapt to selected role.
- Defensive UX: every asynchronous step has explicit progress, fallback, and recovery paths.
- Trust and safety: clear disclaimer that analysis is informational, not legal advice.
- Accessibility baseline: touch targets >=44px, contrast WCAG AA, dynamic type support.
- Localization-by-design: all user-facing copy must be translatable with stable i18n keys.
- Local-first by default: recent reports/history can be opened without network.
- No-hardcode standard: keys, tokens, and constants only (see `06_ui-quality-standards.md`).
