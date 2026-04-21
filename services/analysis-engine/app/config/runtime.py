from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from app.config.models import AnalysisRuntimeConfig


def _runtime_config_path() -> Path:
    return Path(__file__).with_name("analysis_config.json")


def _assert_localized_map(name: str, localized_map: dict[str, str], supported_languages: list[str]) -> None:
    missing_languages = [language for language in supported_languages if language not in localized_map]
    if missing_languages:
        raise ValueError(f"Config map '{name}' is missing languages: {missing_languages}")


def _validate_runtime_config(config: AnalysisRuntimeConfig) -> None:
    supported_languages = config.language_behavior.supported_languages
    severity_levels = {"low", "medium", "high", "critical"}
    configured_modes = {
        config.execution_strategy.default_mode,
        config.execution_strategy.document_text_mode,
        config.execution_strategy.document_base64_mode,
        *config.execution_strategy.offline_capable_modes,
        *config.execution_strategy.network_required_modes,
        *config.execution_strategy.mime_type_overrides.values(),
    }

    _assert_localized_map(
        "pipeline.ingestion.empty_text_placeholder",
        config.pipeline.ingestion.empty_text_placeholder,
        supported_languages,
    )
    _assert_localized_map(
        "pipeline.segmentation.fallback_clause_text",
        config.pipeline.segmentation.fallback_clause_text,
        supported_languages,
    )

    error_maps = {
        "job_not_found": config.pipeline.errors.job_not_found,
        "analysis_not_finished": config.pipeline.errors.analysis_not_finished,
        "invalid_content_source": config.pipeline.errors.invalid_content_source,
        "document_text_too_long": config.pipeline.errors.document_text_too_long,
        "document_base64_too_long": config.pipeline.errors.document_base64_too_long,
    }
    for error_name, localized_map in error_maps.items():
        _assert_localized_map(f"pipeline.errors.{error_name}", localized_map, supported_languages)

    _assert_localized_map("templates.contract_brief", config.templates.contract_brief, supported_languages)
    brief_sections = config.templates.contract_brief_sections
    _assert_localized_map("templates.contract_brief_sections.intro", brief_sections.intro, supported_languages)
    _assert_localized_map(
        "templates.contract_brief_sections.role_obligations",
        brief_sections.role_obligations,
        supported_languages,
    )
    _assert_localized_map(
        "templates.contract_brief_sections.counterparty_obligations",
        brief_sections.counterparty_obligations,
        supported_languages,
    )
    _assert_localized_map(
        "templates.contract_brief_sections.general_obligations",
        brief_sections.general_obligations,
        supported_languages,
    )
    _assert_localized_map(
        "templates.contract_brief_sections.payment_terms",
        brief_sections.payment_terms,
        supported_languages,
    )
    _assert_localized_map(
        "templates.contract_brief_sections.deadlines",
        brief_sections.deadlines,
        supported_languages,
    )
    _assert_localized_map(
        "templates.contract_brief_sections.penalties",
        brief_sections.penalties,
        supported_languages,
    )
    _assert_localized_map(
        "templates.contract_brief_sections.disputed_clauses",
        brief_sections.disputed_clauses,
        supported_languages,
    )

    if not config.execution_strategy.allow_server_assist and config.execution_strategy.network_required_modes:
        raise ValueError("execution_strategy.network_required_modes requires allow_server_assist=true")

    for mode_name in configured_modes:
        if not mode_name:
            raise ValueError("execution_strategy contains empty mode names")

    strategy_reasons = config.execution_strategy.reasons
    _assert_localized_map("execution_strategy.reasons.document_text", strategy_reasons.document_text, supported_languages)
    _assert_localized_map(
        "execution_strategy.reasons.document_base64",
        strategy_reasons.document_base64,
        supported_languages,
    )
    _assert_localized_map(
        "execution_strategy.reasons.mime_type_override",
        strategy_reasons.mime_type_override,
        supported_languages,
    )

    for language in supported_languages:
        if language not in config.risk_scoring.severity_labels:
            raise ValueError(f"Missing severity labels for language '{language}'")
        missing_levels = severity_levels.difference(config.risk_scoring.severity_labels[language].keys())
        if missing_levels:
            raise ValueError(
                f"Missing severity levels for language '{language}': {sorted(missing_levels)}"
            )

    _assert_localized_map(
        "risk_scoring.role_relevance_templates.role_mentioned",
        config.risk_scoring.role_relevance_templates.role_mentioned,
        supported_languages,
    )
    _assert_localized_map(
        "risk_scoring.role_relevance_templates.role_generic",
        config.risk_scoring.role_relevance_templates.role_generic,
        supported_languages,
    )

    for rule in config.risk_scoring.risk_rules:
        if rule.severity not in severity_levels:
            raise ValueError(f"Rule '{rule.id}' has unsupported severity '{rule.severity}'")
        _assert_localized_map(f"risk_rule.{rule.id}.title", rule.title, supported_languages)
        _assert_localized_map(f"risk_rule.{rule.id}.description", rule.description, supported_languages)
        _assert_localized_map(f"risk_rule.{rule.id}.mitigation", rule.mitigation, supported_languages)

    for marker in config.risk_scoring.dispute_markers:
        _assert_localized_map(f"dispute_marker.{marker.id}.reason", marker.reason, supported_languages)
        _assert_localized_map(
            f"dispute_marker.{marker.id}.consequence",
            marker.consequence,
            supported_languages,
        )

    fallback_config = config.risk_scoring.fallback
    _assert_localized_map("risk_fallback.risk_title", fallback_config.risk_title, supported_languages)
    _assert_localized_map(
        "risk_fallback.risk_description",
        fallback_config.risk_description,
        supported_languages,
    )
    _assert_localized_map("risk_fallback.role_relevance", fallback_config.role_relevance, supported_languages)
    _assert_localized_map("risk_fallback.mitigation", fallback_config.mitigation, supported_languages)
    _assert_localized_map("risk_fallback.dispute_reason", fallback_config.dispute_reason, supported_languages)
    _assert_localized_map(
        "risk_fallback.dispute_consequence",
        fallback_config.dispute_consequence,
        supported_languages,
    )

    _assert_localized_map(
        "summary_generation.overview_templates",
        config.summary_generation.overview_templates,
        supported_languages,
    )

    summary_fallback = config.summary_generation.fallback_values
    _assert_localized_map("summary_fallback.must_do", summary_fallback.must_do, supported_languages)
    _assert_localized_map(
        "summary_fallback.should_review",
        summary_fallback.should_review,
        supported_languages,
    )
    _assert_localized_map(
        "summary_fallback.payment_terms",
        summary_fallback.payment_terms,
        supported_languages,
    )
    _assert_localized_map("summary_fallback.deadlines", summary_fallback.deadlines, supported_languages)
    _assert_localized_map("summary_fallback.penalties", summary_fallback.penalties, supported_languages)


@lru_cache(maxsize=1)
def get_runtime_config() -> AnalysisRuntimeConfig:
    config_path = _runtime_config_path()
    payload = json.loads(config_path.read_text(encoding="utf-8-sig"))
    runtime_config = AnalysisRuntimeConfig.model_validate(payload)
    _validate_runtime_config(runtime_config)
    return runtime_config


def reload_runtime_config() -> AnalysisRuntimeConfig:
    get_runtime_config.cache_clear()
    return get_runtime_config()

