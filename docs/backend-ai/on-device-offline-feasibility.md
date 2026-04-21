# On-Device and Offline Feasibility (Global Build Limit: 228 MB)

## Purpose
This document defines how Contract Risk Scanner should satisfy mobile constraints:
- no post-install downloads on user devices,
- local-first behavior where feasible,
- global final build size <= 228 MB for the whole product (not only AI module).

It focuses on analysis-engine implications and handoff constraints for mobile and platform teams.

## Global constraints
1. The 228 MB threshold applies to the total release build artifact of the project.
2. Release app must include all required runtime assets at install time.
3. No model/data pack downloads after installation.
4. Prefer local analysis and local storage when quality and latency are acceptable.
5. If total build exceeds 228 MB, optimization + scoped offloading plan is mandatory.

## AI share in total build budget
Define explicit AI contribution inside the global 228 MB envelope:
- `total_build_mb`: final app artifact size.
- `ai_assets_mb`: sum of OCR/NLP models, tokenizers, rule packs, AI-native libraries.
- `ai_share_percent = ai_assets_mb / total_build_mb * 100`.

Target policy:
- AI target share: <= 35%
- AI warning share: > 35% and <= 40%
- AI hard review: > 40%

Practical envelope:
- AI target: 45-70 MB
- AI warning: 71-85 MB
- AI hard review: > 85 MB

Rationale: non-AI layers (UI, platform runtimes, networking, media, security, observability) must retain enough space in the same 228 MB budget.

## Feasibility by pipeline stage
| Stage | Local-only feasibility | AI size impact | Runtime impact | Recommended mode |
|---|---|---:|---:|---|
| File ingestion (PDF/DOCX/TXT) | High | Low | Low | On-device |
| Text extraction for digital PDF/DOCX | High | Low | Low | On-device |
| OCR for scanned docs | Medium | Medium/High | Medium | Local with compact OCR pack, else server assist |
| Clause segmentation | High | Low | Low | On-device |
| Rules-first risk detection | High | Low | Low | On-device |
| LLM-level semantic risk analysis | Medium/Low | High | High | Optional, offload-first when size pressure exists |
| Role-focused summary generation | Medium | Medium | Medium | Local templates/rules first, semantic enrichment optional |

## Local-first architecture (lightweight priority)
1. Tier 1 (always local, lightweight mandatory)
- Deterministic rules-first analyzer.
- Clause segmentation and role extraction by heuristics.
- Local storage for input metadata and analysis outputs.

2. Tier 2 (conditional local)
- Small quantized semantic model only if quality gain is measurable.
- Strict cap on AI bundle size and latency.

3. Tier 3 (server-assisted fallback)
- Heavy semantic reasoning and low-quality scan recovery.
- Must preserve stable response schema so mobile UX is unchanged.

## Current analysis-engine encoding
Current skeleton encodes this policy in `services/analysis-engine/app/config/analysis_config.json` under `execution_strategy`.

Current route policy:
- `document_text` -> `local_first`
- `document_base64` -> `server_assist` by default
- `mime_type` overrides can force `server_assist` for PDFs/images/office binaries

Current API contract exposure:
- `/analysis/run`
- `/analysis/{job_id}/status`
- `/analysis/{job_id}/result`

All three responses include `execution_plan` with:
- `mode`
- `offline_capable`
- `network_required`
- `policy_source`
- `reason`

This keeps the mobile/core-api layer aware of local-first vs offload routing without introducing a separate contract.

## Global build budget template (<= 228 MB)
Recommended allocation:
- Core app + UI + platform dependencies: 95-125 MB
- AI assets total: 45-70 MB
- Non-AI shared libs and integrations: 20-30 MB
- Reserve for patches and compliance updates: 10-20 MB

Hard policy:
- Soft warning: > 210 MB total
- Release risk: > 220 MB total
- Hard fail: > 228 MB total

## Anti-bloat recommendations (AI-first)
1. Prefer rules-first baseline before any embedded semantic model.
2. Do not embed large foundation models in default release.
3. Use quantized models (int8/int4) and remove unused operators.
4. Keep one shared tokenizer/vocabulary across languages when possible.
5. Deduplicate OCR/NLP runtime libraries across modules.
6. Remove unused ABIs/debug symbols from release outputs.
7. Keep localization compact: shared keys, no duplicated prompt bodies.
8. Track component-level size deltas in CI for every merge.

## Over-limit action plan (> 228 MB total)

### Phase 0: measurement and ownership
1. Generate artifact-level size report (top contributors).
2. Split report by domain: AI vs non-AI.
3. Confirm AI share and top 5 AI-heavy assets.

### Phase 1: no-regression optimizations
1. Recompress assets and strip debug symbols.
2. Remove duplicate native/runtime libraries.
3. Apply stronger quantization to local models.

### Phase 2: prioritized disable/offload order (first to cut)
1. Disable local semantic LLM/classifier first.
- Keep local rules-first risk extraction.
- Offload advanced semantic reasoning to backend API.

2. Reduce OCR package breadth.
- Keep only must-have OCR configuration.
- Offload difficult scanned-document OCR cases.

3. Remove secondary AI enrichments.
- Embedding-based rerankers.
- Extra explanation generation layers.

4. Compress multilingual AI artifacts.
- Keep unified multilingual asset set.
- Remove per-language duplicated AI resources.

5. Preserve core local experience.
- Never remove local ingestion, clause segmentation, deterministic risk output.

### Phase 3: release alternatives (no post-install downloads)
1. Publish two complete install variants selected before install:
- `Standard`: lightweight local-first + server semantic fallback
- `Extended`: larger local AI pack where store policy permits
2. Keep identical API schema and UX flow across variants.

### Phase 4: emergency gate
If still > 228 MB after Phase 1-3:
- Block release candidate.
- Escalate to architecture board with accepted cut list and impact note.

## Quality and product guardrails
1. Local mode must always produce schema-valid output even at low confidence.
2. Fallback from local semantic to rules-first must be deterministic and logged.
3. Server-assisted branch must not break user flow or contracts.
4. Privacy defaults:
- Store intermediate artifacts locally by default.
- Send data to server only for explicitly required fallback paths.

## CI/CD acceptance checks
1. Global size gate
- Pass: <= 210 MB
- Warning: 210-228 MB
- Fail: > 228 MB

2. AI share gate
- Pass: <= 35%
- Warning: > 35% and <= 40%
- Hard review: > 40%

3. Offline smoke checks
- Analyze representative digital contract without network.
- Analyze representative scanned contract without network if compact OCR is bundled.

4. Localization checks
- ru/en/it/fr outputs remain schema-valid in local mode.

5. Mode consistency
- Local-first and server-assisted outputs both satisfy the same API schema.
