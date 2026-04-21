from __future__ import annotations

from collections.abc import Mapping

from app.config.runtime import get_runtime_config


def supported_analysis_languages() -> tuple[str, ...]:
    config = get_runtime_config()
    return tuple(config.language_behavior.supported_languages)


def default_analysis_language() -> str:
    config = get_runtime_config()
    return config.language_behavior.default_language


def fallback_analysis_language() -> str:
    config = get_runtime_config()
    return config.language_behavior.fallback_language


def normalize_analysis_language(language: str | None) -> str:
    config = get_runtime_config()
    supported_languages = set(config.language_behavior.supported_languages)

    if isinstance(language, str):
        normalized = language.strip().lower()
        if normalized in supported_languages:
            return normalized

    return config.language_behavior.fallback_language


def resolve_localized_text(localized_map: Mapping[str, str], language: str | None) -> str:
    resolved_language = normalize_analysis_language(language)
    fallback_language = fallback_analysis_language()

    if resolved_language in localized_map:
        return localized_map[resolved_language]

    if fallback_language in localized_map:
        return localized_map[fallback_language]

    if localized_map:
        return next(iter(localized_map.values()))

    return ""
