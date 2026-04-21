# No-Hardcode Standard (Analysis Engine)

## Policy
Production-quality changes must avoid hardcoded business rules and localized texts in code.

## Mandatory requirements
1. Pipeline parameters, thresholds, timeouts, model toggles, and fallback behavior live in config.
2. Texts/rules must have a documented source reference.
3. Language normalization and localized value resolution are centralized.
4. Modules are composable/testable and consume config through typed models.

## Authoritative files
- Runtime config: `services/analysis-engine/app/config/analysis_config.json`
- Typed config models: `services/analysis-engine/app/config/models.py`
- Config loader + validation: `services/analysis-engine/app/config/runtime.py`
- Localization behavior: `services/analysis-engine/app/localization.py`
- Lightweight/offload routing policy: `services/analysis-engine/app/services/execution_strategy.py`
- Rule source registry: `docs/backend-ai/rule-source-registry.md`

## Change checklist
1. Update config first, then code wiring if needed.
2. Add or update source reference in rule registry for every new rule.
3. Add tests for locale fallback and config-driven branch behavior.
4. Verify no text/rule constants are introduced in service modules.
