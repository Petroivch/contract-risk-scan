# Visual Implementation Notes

## Visual Direction
- High-contrast clean editorial UI with cool-blue palette.
- Layered cards and decorative background blobs for depth.
- Strong hierarchy via large headers + compact metadata badges.

## Theme Layer
- Token source: `apps/mobile/src/config/designTokens.ts`
- Runtime theme exports: `apps/mobile/src/theme/tokens.ts`
- Token groups:
  - colors
  - spacing
  - radius
  - typography
  - shadow
  - motion timings

## Screen Shell Pattern
- Shared shell: `components/layout/ScreenShell.tsx`
- Provides:
  - decorative background
  - elevated header card
  - consistent content gutter
  - language selector placement

## Demo Components
- `RoleBadge`
- `RiskCard`
- `DisputedCard`

## Applied Screens
- Auth (styled shell)
- Upload
- Analysis Status
- Report (tabbed shell)
- History
- Settings

## Maintainability Rules
- No direct color/typography literals in screens.
- Use tokenized style values only.
- UI text from i18n keys only.
