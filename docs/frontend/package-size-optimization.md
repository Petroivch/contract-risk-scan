# Package Size Optimization Plan

## Budget Definition
- **Total final project release budget**: `228 MB` (global limit)
- This includes all deliverables in the release package set.

## Frontend Mobile Share Estimate
- Target mobile contribution (frontend package share): **<= 120 MB**
- Rationale:
  - leave budget headroom for backend deliverables, docs/assets, and release metadata
  - reduce risk of crossing global 228 MB cap in final aggregation

## Current Risk Factors (Mobile)
- React Native/Expo runtime binaries
- Native deps growth (SQLite, file-system, media/libs)
- bundled assets (images/fonts/icons)
- duplicated localization/media resources

## Optimization Checklist
1. Assets
   - compress raster assets (WebP/AVIF where applicable)
   - remove unused design assets and duplicates
   - subset fonts (only used glyph ranges)
2. JS/TS bundle
   - trim dead dependencies
   - avoid heavy utility libs when native/light alternatives exist
   - split debug-only modules from release path
3. Native build config
   - enable Hermes for release
   - enable minify/proguard/r8 for Android
   - strip symbols in release pipeline
4. ABI strategy
   - prefer split ABI artifacts for distribution channels that support it
5. Localization
   - keep only required locales (`ru/en/it/fr`) in app bundle

## If Total > 228 MB (Options and Trade-offs)
1. Split ABI delivery
   - Expected effect: `~15-35%` smaller per-device APK
   - Trade-off: multiple artifacts to manage in CI/CD
2. Aggressive asset compression + font subsetting
   - Expected effect: `~10-25 MB` reduction
   - Trade-off: quality tuning time, potential visual compromise
3. Remove/replace heavy dependencies
   - Expected effect: `~5-20 MB` depending on library
   - Trade-off: refactor effort and re-testing
4. Move non-critical demo content to optional backend-provided data
   - Expected effect: variable (`5-30 MB`)
   - Trade-off: requires runtime network for that optional content
5. Separate debug tooling from release build
   - Expected effect: `~3-10 MB`
   - Trade-off: stricter release pipeline discipline

## Verification
- Track artifact sizes in CI for each commit.
- Block release if estimated global package sum > 228 MB.
- Keep mobile share trend dashboard (target <= 120 MB).
