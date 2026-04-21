# 08. Visual Themes A/B + Hi-Fi Screen Spec

## 1) Theme Set (A/B, Production-Friendly)

## Theme A: `Civic Clarity`
- Positioning: clean, analytical, high legibility for dense legal text.
- Character:
- cool-neutral surfaces
- precise contrast
- disciplined accent usage
- Token profile:
- brand accent: `themeA.color.brand.primary`
- surface family: `themeA.color.surface.*`
- risk mapping aliases:
- `themeA.color.risk.critical -> color.risk.critical`
- `themeA.color.risk.high -> color.risk.high`
- Typography profile:
- title emphasis via `typography.title.l/m`
- body reading priority via `typography.body.m`
- Motion profile:
- minimal amplitude transitions
- faster stage updates in Status

## Theme B: `Warm Ledger`
- Positioning: editorial-legal feel with warm trust and softer panels.
- Character:
- warm-neutral backgrounds
- stronger section framing
- softer shadows, stronger borders
- Token profile:
- brand accent: `themeB.color.brand.primary`
- surface family: `themeB.color.surface.*`
- risk mapping aliases:
- `themeB.color.risk.critical -> color.risk.critical`
- `themeB.color.risk.high -> color.risk.high`
- Typography profile:
- slightly higher header contrast using same role tokens
- denser report card label hierarchy
- Motion profile:
- slower, confidence-oriented transitions in Report/History

Selection rule: A/B are theme token sets only; component structure stays identical.

Implementation rule:
- Theme switch changes token aliases only.
- Layout, spacing rhythm, content order, and component anatomy must remain identical across themes and platforms.

## 2) Key Screen Hi-Fi Specs

## 2.0 Shared Mobile Layout Contract
- Header, content, and bottom action/navigation areas respect platform safe areas on Android and iPhone.
- Screen horizontal padding uses `space.16` on standard phone widths and `space.24` only on larger phone widths where content still reads as a single-column mobile layout.
- Vertical stack rhythm:
- screen sections separated by `space.24`
- card groups separated by `space.12`
- inline text/icon pairs separated by `space.8`
- Primary CTA rows must remain visible without overlapping system gesture areas.
- Bottom navigation is persistent only on Home/History/Settings shell screens; Report Details hides shell navigation and uses an explicit back action in the top bar.
- Long localized labels must wrap before truncation where functionally safe; truncation is last resort and must follow `CONST_CARD_TITLE_MAX_LINES` / `CONST_CARD_BODY_MAX_LINES`.

## 2.0.1 Shared Role-Focused Analysis Treatment
- Role is a persistent interpretation layer, not a setup detail.
- Every key screen after role selection must show the current role through one of:
- `RoleBadge.compact`
- `RoleBadge.medium`
- `RoleBadge.inline`
- Role treatment by screen:
- Auth: preview only if returning user context exists locally
- Upload: active role shown before file selection to frame analysis intent
- Analysis Status: role stays visible to reinforce what the app is analyzing for
- Report: role sits inside the summary strip and affects summary ordering
- History: each item carries the role used for that report
- Settings: role preview links to role edit flow, but does not dominate the screen
- Visual rule:
- role emphasis uses branded or custom-role badge treatment, never risk colors
- role badge must remain visually subordinate to the primary action on Upload and to the report summary strip on Report

## 2.0.2 Shared State Transition Language
- Entering a screen: short vertical reveal + opacity transition using `motion.duration.fast`.
- Switching tabs or filters: content transition uses `motion.duration.normal` and preserves context, never full-screen reset.
- Loading: use skeleton blocks or structured progress states; avoid spinner-only screens except in very short auth actions.
- Offline transition: replace live-state indicators with cached/queued chips without collapsing layout.
- Error transition: keep prior context visible where possible and attach recovery action near the failed module.

## 2.1 Auth Screen
- Visual hierarchy:
1. Trust header with product title/subtitle and restrained legal-texture background motif.
2. Sign-in panel with email field, OTP/magic link action, and reassurance copy.
3. Secondary support line for privacy/local-first expectations.
- Composition:
- top portion carries brand confidence and legal-product tone, bottom portion is a compact form module
- form panel sits as a strong reading surface, not a floating marketing card
- one primary action only
- Color emphasis:
- brand emphasis reserved for primary CTA and focused input states
- surrounding surfaces remain calm and neutral
- warnings/errors use status colors, not risk colors
- Typography intent:
- title feels concise and authoritative, not promotional
- helper text uses body scale that remains readable in `ru/en/it/fr`
- CTA label remains short and decisive
- State transitions:
- sending code: CTA compresses into progress state without moving the form
- OTP error: inline error appears below the relevant field/action, preserving overall composition
- returning authenticated user path skips flourish and lands directly into the next screen
- Role-focused analysis appearance:
- if returning-user local context exists, a muted role preview line can appear below the support copy
- auth itself does not foreground legal risk semantics

## 2.2 Upload Screen
- Visual hierarchy:
1. Header cluster: screen title key + role badge + connection chip.
2. Primary upload module: file drop/select panel + supported format line key.
3. Secondary info: local-first queue hint + privacy/disclaimer short key.
4. Primary CTA row: upload/queue action.
- Composition:
- asymmetrical header composition creates identity before the upload surface
- upload module dominates the screen as a structured legal-ingest panel
- secondary guidance sits in a narrow band between upload module and CTA
- Color emphasis:
- brand emphasis on CTA and focus borders only
- offline state uses `color.status.info`
- no red or amber on the default upload surface
- Typography intent:
- title establishes confidence and simplicity
- file requirements and privacy note stay quiet but legible
- selected file metadata uses label/body contrast so filename and status scan instantly
- State transitions:
- file-selected state expands metadata inside the same module
- offline queue save swaps CTA label/state without re-layout
- picker return restores the same composition and scroll position
- Role-focused analysis appearance:
- role badge is visible before upload and is visually tied to the uploader header
- custom role treatment stays neutral/patterned to show customization without implying risk
- Card style:
- upload module uses elevated surface (`elevation.1`) with prominent border token.
- offline queue chip uses status-info token family.
- Risk accents:
- none on default upload surface (avoid false alarm before analysis).
- Role badge:
- anchored in header right zone, compact pill variant.
- Interaction states:
- online: `upload.choose_file_cta`
- offline: `upload.offline_queue_cta`
- Layout behavior:
- header cluster uses split composition: title/description left, role and connection status stacked or wrapped on the right as space allows
- upload module is full-width card, never floating modal style
- disclaimer/help text stays below upload module and above CTA row
- queued state keeps file metadata visible after offline save
- Platform notes:
- Android uses native document picker entry from CTA/module tap
- iPhone uses native document picker entry from CTA/module tap
- result UI after picker return must restore same screen scroll position

## 2.3 Analysis Status Screen
- Visual hierarchy:
1. Header: analysis title key + active role badge.
2. Stage timeline block (vertical): each stage row with icon/state label.
3. Progress confidence area: eta line + reassurance key.
4. Actions: retry/cancel/resume queue.
- Composition:
- upper screen is compact and stable; most visual energy lives in the vertical timeline
- progress confidence area anchors the screen emotionally between system activity and user trust
- actions stay grouped at the bottom of the scrollable body or pinned action zone
- Color emphasis:
- active stage uses brand emphasis
- `waiting_for_network` uses `color.status.info`
- failure states use `color.status.error`
- risk severity palette is not used here
- Typography intent:
- stage labels must read like procedural checkpoints
- reassurance and ETA copy should feel calm, not technical
- failed-stage copy becomes more explicit but not louder than the action area
- State transitions:
- exactly one active stage rail animates at a time
- completed stages settle into static confirmed states
- pause/resume keeps prior progress visible instead of resetting the list
- error state attaches recovery action to the affected timeline block
- Role-focused analysis appearance:
- role badge stays visible in the header while the timeline messages remain role-agnostic
- reassurance copy can reference that the contract is being analyzed for the selected role
- Card style:
- stage rows grouped in one structured panel with row dividers tokenized.
- active row uses brand accent rail; failed row uses `color.status.error`.
- Risk accents:
- not risk-severity based; only process-state semantics.
- Role badge:
- persistent for role context continuity.
- Motion:
- state row transition uses `motion.duration.normal`.
- no perpetual shimmer on completed stages.
- Timeline anatomy:
- each row contains stage label, supporting message when `message_key` is present, state icon, and trailing action/status slot
- rows use clear start/end alignment so progress reads as process history, not as independent cards
- only one row is `active` at a time
- `waiting_for_network` uses `color.status.info`, never risk colors
- Platform notes:
- if app backgrounds during analysis, returning to foreground must restore timeline state without visual reset to initial stage
- reduced-motion mode swaps animated state changes for static state icon replacement

## 2.4 Report Screen
- Visual hierarchy:
1. Header summary strip: contract name key + role badge + confidence chip.
2. Tab bar: `report.tabs.risks|disputed|summary`.
3. Tab content area:
- Risks: ranked `RiskCard` list
- Disputed: `DisputedClauseCard` list
- Summary: structured obligations/risks blocks
4. Bottom action cluster: save/share/export (if enabled).
- Composition:
- summary strip creates a strong top frame, then the tab bar turns the rest into a focused reading workspace
- each tab keeps one dominant reading rhythm rather than mixing patterns
- cards stack tightly enough for analysis efficiency but keep editorial spacing
- Color emphasis:
- severity rails and confidence micro-bars carry the strongest accents
- disputed clauses stay in neutral/warning range unless escalated by actual severity
- summary tab uses restrained brand and neutral emphasis to support reading
- Typography intent:
- contract title and role/context information form the primary header voice
- tab labels must remain compact and strong across all locales
- within cards, legal references, impact, and recommendation have explicit hierarchy
- State transitions:
- switching tabs preserves mental continuity and never flashes the whole screen
- expanding cards adds depth within the card, not a modal detour by default
- cached snapshot marker appears without changing the tab structure
- partial reloads happen at section level and keep other content readable
- Role-focused analysis appearance:
- role badge is part of the summary strip and visually pairs with confidence
- summary tab prioritizes obligations/responsibilities for the chosen role
- risk and disputed cards may include role-impact phrasing, but the role marker remains the primary visible context
- Card style:
- risk cards: elevated surface + left severity rail token.
- disputed cards: neutral/warning mix without high-alert red by default.
- summary blocks: editorial panels with section labels.
- Risk accents:
- severity rails + confidence micro-bar + icon token set.
- Role badge:
- medium variant with editable affordance (icon/button token).
- Local-first:
- cached report marker key shown if data is offline snapshot.
- Tab behavior:
- default tab is Risks
- tab change preserves per-tab scroll state
- tab bar stays visible after first content scroll and must not cover report content or reduce readable viewport below one full card header plus body preview
- Card anatomy:
- `RiskCard` order is severity rail -> main content block -> confidence micro-bar -> expand area trigger
- `DisputedClauseCard` uses neutral/warning treatment and must not visually outrank higher-severity risk cards
- Summary blocks separate obligations, responsibilities, and watch-outs into distinct editorial sections
- Action cluster:
- save/share/export actions must degrade gracefully by feature flag and offline status
- if export is disabled, remaining actions must reflow without leaving visual gaps
- Platform notes:
- horizontal tab interaction must feel native on both Android and iPhone, but tab labels/order cannot diverge
- report header summary strip collapses on downward scroll after the tab bar reaches the top pinned position

## 2.5 History Screen
- Visual hierarchy:
1. Header: title key + search/filter trigger.
2. Filter row: role + severity + date chips.
3. List: report preview cards in descending recency.
4. Empty/offline states: dedicated keyed modules.
- Composition:
- header and filters form a compact control deck
- history list below reads like an archive ledger, not a generic feed
- each item compresses metadata into a ticket-like scan pattern with clear tap target
- Color emphasis:
- severity indicator remains small but sharp
- queue/cached states use info/status semantics
- list surfaces stay quieter than report surfaces to preserve archive feel
- Typography intent:
- document title and date/status pair are the first scan anchors
- metadata rhythm supports fast skimming over many items
- role micro-badge stays legible but secondary to title and state
- State transitions:
- entering filters does not detach the user from the archive context
- offline state keeps cached items fully readable and clearly interactive
- empty and local-empty states retain the same ledger language rather than switching to generic illustration cards
- Role-focused analysis appearance:
- each row exposes the role that shaped that report
- role label helps disambiguate repeated scans of the same contract or similar files
- Card style:
- compact report item cards with status chip and timestamp region.
- queued/offline items visually distinct via `color.status.info`.
- Risk accents:
- mini severity indicator on right side (tokenized dot/rail).
- Role badge:
- inline micro-badge in each list item.
- Local-first:
- cached item icon must be persistent and scannable.
- Card anatomy:
- top row contains document title and status/date cluster
- middle row contains role badge and severity indicator
- bottom row contains local-cache/queue metadata
- ticket-like treatment comes from border, notch/divider motif, and metadata rhythm, not from decorative skeuomorphism
- Interaction:
- tapping card opens Report Details
- filter chips remain horizontally scrollable if localized labels exceed available width
- Offline behavior:
- cached items remain visually interactive while uncached remote-only items move to disabled/retry treatment

## 2.6 Settings Screen
- Visual hierarchy:
1. Profile block.
2. Language block (`ru|en|it|fr`) with selected-state token.
3. Local-first controls (auto-sync, cache policy).
4. Lite mode details (visible by feature flag).
5. Legal/disclaimer and sign-out.
- Composition:
- settings read as deliberate sections with strong dividers and calm surfaces
- utility rows stay dense but not cramped
- the screen closes the loop on trust, language, and device behavior without looking like a leftover system page
- Color emphasis:
- mostly neutral surfaces with selective brand emphasis on selected rows/toggles
- warnings only appear on destructive or storage-impacting actions
- no risk color language outside explicit warning rows
- Typography intent:
- section headers feel firm and navigational
- row labels support longer localized text without losing alignment
- legal/lite-mode explanations use small but comfortable reading rhythm
- State transitions:
- toggles and language changes update in place
- saving states stay inside the affected row/block
- enabling Lite mode details visibility must not reflow unrelated sections unexpectedly
- Role-focused analysis appearance:
- role preview is present as a subordinate contextual row
- role editing routes back to the dedicated role flow rather than turning Settings into a full role-management form
- Card style:
- grouped settings sections with section headers and hairline dividers.
- Language selector:
- radio/list style with full-row tap targets.
- i18n safety:
- long locale labels wrap safely without clipping.
- Risk accents:
- not used except warning rows (e.g., cache clear).
- Role badge:
- preview only; editable role action links back to role flow.
- Row behavior:
- language rows are full-width tappable items with selected indicator aligned consistently across locales
- destructive or warning actions use warning semantics only inside their own row, not at section level
- Lite mode details block must explain removed visual richness in plain language and link to no-download policy context
- Platform notes:
- settings sections use native scrolling physics/platform containers, while divider rhythm and spacing tokens stay identical

## 3) Role Badge Hi-Fi Variants
- `RoleBadge.compact` (Upload/Status header).
- `RoleBadge.medium` (Report header).
- `RoleBadge.inline` (History row).
- Shared behavior:
- label from role source, never hardcoded
- custom role appearance via tokenized border/background variant
- all variants support locale expansion and dynamic type
- Interaction contract:
- editable variants expose explicit affordance; inline history variant is informational only
- if edited from Report, app must follow re-focus confirmation flow from `01_screen-map-user-flow.md`

## 4) Anti-Generic Additions for Hi-Fi
- Distinctive patterns:
- trust-header plus legal-texture intro on Auth
- stage timeline anatomy in Status (not generic progress bar only)
- severity rail + confidence micro-bar combo in Report
- archival ticket-like history cards with role micro-badge
- strong section framing in Settings without dashboard chrome
- controlled uniqueness:
- one signature motif per screen, not per component
- consistent token language across both A/B themes

## 5) What Makes The UI Strong Visually
- The product has a recognizable legal-analysis grammar:
- role context is always visible where it matters
- process is shown as a timeline, not as an abstract loader
- report severity and confidence are paired visually
- history feels archival rather than feed-like
- The screens balance trust and utility:
- Auth and Upload feel premium but restrained
- Report feels dense but never noisy
- Settings feels intentional, not generic platform leftovers
- The visual identity survives lite-mode cuts because structure, spacing, borders, and hierarchy carry the brand, not heavy assets.

## 6) What We Avoid So It Does Not Look Generic
- no floating marketing cards on Auth
- no centered empty-state illustration style reused across all screens
- no interchangeable dashboard cards with equal weight everywhere
- no alarmist red-heavy report surfaces
- no decorative motion on reading-heavy screens
- no visual ideas that depend on large asset packs to remain distinctive

## 7) No-Hardcode / i18n-Ready Enforcement
- Text:
- all titles/labels/messages must map to keys in `04_microcopy-guide.md`.
- Styling:
- all screen styling references semantic tokens or theme aliases.
- Numbers:
- any limit must reference constants from `06_ui-quality-standards.md`.
- Platform:
- same key/token contracts across Android and iPhone implementations.

## 8) Frontend Handoff Clarifiers
- Anything described as "chip", "badge", "rail", "panel", or "strip" is a structural role, not license to invent a new component family outside `03_component-spec.md`.
- If frontend needs an unlisted primitive to realize a screen, it must be added first to `03_component-spec.md` and inherit existing token semantics.
- Visual ambiguity resolution order:
1. `06_ui-quality-standards.md`
2. `03_component-spec.md`
3. `07_visual-direction-v1.md`
4. this file
- Frontend should treat this file as implementation-specific behavior for spacing, hierarchy, and interaction polish, not as optional inspiration.
