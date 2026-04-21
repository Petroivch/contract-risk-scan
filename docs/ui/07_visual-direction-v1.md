# 07. Visual Direction v1 (High-Fidelity, Production-Friendly)

## 1) Scope and Constraints
- Platforms: Android + iPhone only.
- UX constraints: local-first, multilingual (`ru|en|it|fr`, default/fallback `ru`).
- Quality: no-hardcode, token-based styling, i18n-ready copy.
- Release budget: visual decisions must respect `CONST_RELEASE_TOTAL_BUDGET_MB`.

## 2) Mood and Brand Tone
- Core mood: calm legal intelligence, not "alarmist security dashboard".
- Tone attributes:
- trustworthy
- precise
- human-readable
- restrained premium
- mobile-native confidence
- Visual emotional arc:
- Upload: focused and simple
- Auth: immediate trust and low-friction entry
- Status: transparent and reassuring
- Report: analytical and structured
- History: archival and reliable
- Settings: controlled and explicit

## 2.1 Product-Grade Mobile Character
- The product should feel like a professional legal instrument condensed for the phone, not a generic productivity dashboard.
- Android and iPhone implementations should read as one product family:
- same content hierarchy
- same visual motifs
- same severity semantics
- same role-focused emphasis
- Platform-native controls are allowed where they improve familiarity, but brand expression comes from composition, tokenized contrast, and information framing rather than custom chrome.

## 3) Visual Language Principles
- "Data first, decoration second": visual richness supports comprehension.
- "Severity with discipline": risk accents are strong but not noisy.
- "One focal action per screen": primary CTA is always visually unambiguous.
- "System over improvisation": all colors/typography/spacing/motion via tokens only.
- "Legal texture, not enterprise sameness": the UI should carry a document-reading, evidence-marking feel.
- "Mobile momentum": each screen must read in one-handed use without becoming visually flat.

## 4) Color System (Semantic-Only)
- Base surfaces:
- `color.surface.default`
- `color.surface.muted`
- `color.surface.elevated`
- Text:
- `color.text.primary`
- `color.text.secondary`
- `color.text.inverse`
- Brand/interaction:
- `color.brand.primary`
- `color.brand.primaryHover`
- `color.interactive.focus`
- Risk semantics:
- `color.risk.critical`
- `color.risk.high`
- `color.risk.medium`
- `color.risk.low`
- Status semantics:
- `color.status.success`
- `color.status.warning`
- `color.status.error`
- `color.status.info`

Rule: component code must never reference raw HEX/RGB values.

## 5) Typography System
- Typography roles only:
- `typography.display.s`
- `typography.title.l`
- `typography.title.m`
- `typography.body.m`
- `typography.body.s`
- `typography.label.m`
- `typography.caption.s`
- Internationalization-safe behavior:
- support variable text length for `ru/en/it/fr`
- avoid all-caps in long labels
- allow 2-line wrapping for navigation headers where needed

## 6) Spacing and Layout Rhythm
- Spacing scale: `space.2/4/8/12/16/24/32`.
- Container grid:
- primary content paddings use `space.16` or `space.24` (by breakpoint token)
- card stacks use `space.12` vertical rhythm
- hero-to-body transitions use `space.24` to preserve visual breathing room on smaller phones
- Touch/accessibility rules from constants registry:
- `CONST_TOUCH_TARGET_MIN_PX`
- `CONST_DYNAMIC_TYPE_MAX_PERCENT`

## 7) Depth and Elevation
- Elevation tokens:
- `elevation.0` (flat lists/background)
- `elevation.1` (interactive cards)
- `elevation.2` (modal surfaces / pinned action areas)
- Depth intent:
- Report cards use subtle elevation + border token.
- Risk-critical state adds left accent + glow token, not extra shadow layers.

## 8) Motion System
- Motion tokens only:
- `motion.duration.fast`
- `motion.duration.normal`
- `motion.easing.standard`
- Motion principles:
- meaningful transitions (screen enter, tab switch, state changes)
- no decorative looping motion on core reading screens
- reduce motion mode must map to static alternatives

## 9) Role Badge Styling Direction
- Shared structure tokenized:
- container: pill with `radius.l`
- icon slot + label slot + optional state dot
- Color behavior:
- default role uses `color.brand.primary` tint system
- custom role uses neutral surface + patterned border token (`border.role.custom`)
- Badge must remain legible on both themes A/B and all locales.

## 10) Local-First and Multilingual Visual Cues
- Offline mode indicator:
- subtle persistent banner token (`color.status.info`)
- queue state chip in Upload/Status/History
- Language-aware layout:
- tab labels and CTA must tolerate longer words in `it/fr`
- do not encode fixed-width text containers for action bars

## 11) Anti-Generic (Design Intent Guardrails)
- We do:
- asymmetric hero balance on Upload (content block + structured drop area)
- restrained legal-editorial framing on Auth and Settings
- legal-document texture motifs via lightweight vector patterns
- severity accents as vertical rails and confidence micro-bars
- timeline-style status blocks with explicit stage ownership
- purposeful contrast shifts between top summary areas and reading surfaces
- We avoid:
- generic "card soup" with identical containers everywhere
- overuse of gradients and glossy effects
- neon-risk colors without semantic hierarchy
- interchangeable SaaS-style typography with no hierarchy contrast

## 12) What Makes This UI Visually Strong
- Strong hierarchy before ornament:
- every key screen has a clear top anchor, a dominant action zone, and a secondary reading zone
- Product-specific motifs:
- role badge as a living context marker, not a decorative chip
- timeline anatomy for analysis
- ticket-like archival composition in History
- confidence micro-bars paired with severity rails in Report
- Editorial rhythm:
- cards and panels feel like annotated contract excerpts rather than neutral dashboard boxes
- Warm/cool theme split with stable structure:
- theme choice changes emotional tone without changing comprehension patterns
- Motion with intent:
- transitions signal processing confidence, state change, and content continuity instead of adding generic polish
- Budget-aware expressiveness:
- the product remains distinctive through composition, border language, spacing, and token contrast even if heavy media is removed for release-size optimization

## 13) What To Avoid So It Does Not Look Generic
- Do not center everything into isolated cards with identical radii and shadows.
- Do not use oversized hero illustrations that compete with contract analysis content.
- Do not treat all statuses as the same visual weight; processing, warning, risk, and offline states must remain distinct.
- Do not rely on a single accent color to carry brand identity.
- Do not make Report look like a generic analytics dashboard or make History look like a plain file list.
- Do not introduce decorative assets that become the first candidates for removal under the `CONST_RELEASE_TOTAL_BUDGET_MB` limit unless the screen still keeps its identity without them.

## 14) Implementation Notes
- Token names in this doc are contract IDs; values are managed in design-system sources.
- New visual decisions must include:
- token reference
- platform behavior (Android/iOS)
- fallback behavior for reduced-motion and localization expansion

## 15) Mobile Shell Rules
- App shell is mobile-only and uses:
- top app bar/header per screen;
- bottom navigation for Home, History, Settings;
- scrollable content area between safe-area insets.
- Primary actions must stay within thumb-reachable lower zone, but never overlap home indicator/gesture areas.
- Android and iPhone may use platform-native transitions, but information hierarchy, component order, and token semantics must remain identical.
