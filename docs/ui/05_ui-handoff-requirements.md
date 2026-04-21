# 05. UI Handoff (Compact, FE-Ready)

## 1) Non-Negotiable Constraints
- Mobile-only release targets: Android + iOS.
- User must not download anything post-install except store release build.
- Local-first UX: history/report cache must be available offline.
- Multilingual: `ru`, `en`, `it`, `fr`; default and fallback locale is `ru`.
- Global release budget (total final build): `CONST_RELEASE_TOTAL_BUDGET_MB`.
- No-hardcode standard:
- text via i18n keys only;
- visual values via design tokens only;
- limits via constants only.
- Screen/flow contract sources:
- flow/navigation from `01_screen-map-user-flow.md`;
- state behavior from `02_screen-states.md`;
- component and token contract from `03_component-spec.md`;
- copy and fallback rules from `04_microcopy-guide.md`;
- visual direction and hi-fi behavior from `07_visual-direction-v1.md` and `08_visual-themes-and-hifi-spec.md`.

## 2) Frontend Implementation Checklist
1. Implement screen/flow from `01_screen-map-user-flow.md`.
2. Implement state matrix from `02_screen-states.md`.
3. Implement components from `03_component-spec.md` with tokenized styling.
4. Implement i18n catalog loading from `04_microcopy-guide.md`:
- runtime language switch in Settings/Profile;
- per-key fallback to `ru`;
- no inline production literals in screen/component code.
5. Implement local-first behavior:
- cache report/history payloads locally;
- queue uploads while offline;
- resume queue when network restored.
6. Implement Lite mode communication when release profile is optimized:
- display `settings.lite_mode_details_title`;
- explain removed/reduced visual features;
- never suggest in-app module download.
7. Implement mobile-only shell behavior:
- bottom navigation contains Home, History, Settings only;
- respect platform safe areas and gesture insets on Android and iPhone;
- preserve current screen state during locale switch and app foreground/background return.
8. Implement hi-fi behaviors exactly as specified:
- Upload uses asymmetric header + upload module composition, not generic centered uploader;
- Status uses timeline block, not single generic progress bar;
- Report uses severity rail + confidence micro-bar pairing on risk cards;
- History uses archival ticket-like cards with persistent cached marker;
- Settings language selector uses full-row tap targets with wrap-safe locale labels.
9. Add FE verification hooks:
- stable screen/component IDs for UI automation;
- telemetry for localization fallback and offline queue resume;
- theme switch support at token-set level without structural divergence.

## 3) Required Backend Inputs for FE
- Upload/start/status/report/history APIs with stable error codes.
- Status must support network-waiting state for offline queue UX.
- Report payload must be cache-safe for offline read.
- Language-aware response metadata:
- `response_language`
- `fallback_language`
- optional `fallback_keys[]`
- Role-aware response metadata:
- `selected_role_label`
- `selected_role_type` (`preset|custom`)
- `report_focus_version` for role re-focus invalidation/reload logic
- Report sections must be independently retriable so partial content failures do not blank the whole report screen.
- History payload must identify:
- cached availability
- queue status
- last-local-open timestamp

## 4) Build Budget UX Optimization Priority (UI Assets First)
1. Onboarding media (video/raster backgrounds).
2. Animation packs (Lottie/GIF/video).
3. Extra font families/weights.
4. Unused icon/image sets.
5. Decorative assets (non-functional backgrounds/illustrations).

Rule: optimization decisions are evaluated against total app build size, not UI-only size.

## 5) Acceptance Gates (Done Criteria)
- All mandatory flows run on Android and iOS.
- Offline history/report access works without network.
- Offline upload queue/resume works.
- Locale switch works for `ru/en/it/fr`, with fallback to `ru`.
- Static checks report no hardcoded UI literals in production screens/components.
- Design/token checks report no ad-hoc visual values.
- Numeric limits in FE reference constants registry only.
- Release candidate meets `CONST_RELEASE_TOTAL_BUDGET_MB`, or approved lite-mode profile is documented.
- Visual QA confirms structural parity with `08_visual-themes-and-hifi-spec.md` on both platforms.
- Dynamic type and locale expansion do not clip role badge, tab labels, language rows, or history metadata.
- Android and iPhone safe-area handling keeps bottom navigation, primary CTA rows, and report actions fully tappable.
