from __future__ import annotations

from app.config.runtime import get_runtime_config
from app.localization import normalize_analysis_language, resolve_localized_text
from app.schemas.analysis import AnalysisExecutionPlan, AnalysisRunRequest


class ExecutionStrategyService:
    """Resolves the lightweight/local-vs-offload route from runtime policy."""

    def __init__(self) -> None:
        self._runtime_config = get_runtime_config()
        self._config = self._runtime_config.execution_strategy

    def resolve(self, request: AnalysisRunRequest) -> AnalysisExecutionPlan:
        language = normalize_analysis_language(request.language)
        policy_source = "content_source_default"

        if request.document_text:
            mode = self._config.document_text_mode
            reason_map = self._config.reasons.document_text
        elif request.document_base64:
            mode = self._config.document_base64_mode
            reason_map = self._config.reasons.document_base64
        else:
            mode = self._config.default_mode
            reason_map = self._config.reasons.document_text

        mime_type = (request.mime_type or "").strip().lower()
        if mime_type and mime_type in self._config.mime_type_overrides:
            mode = self._config.mime_type_overrides[mime_type]
            reason_map = self._config.reasons.mime_type_override
            policy_source = f"mime_type:{mime_type}"

        network_required = mode in self._config.network_required_modes
        offline_capable = mode in self._config.offline_capable_modes and not network_required

        return AnalysisExecutionPlan(
            mode=mode,
            offline_capable=offline_capable,
            network_required=network_required,
            policy_source=policy_source,
            reason=resolve_localized_text(reason_map, language),
        )
