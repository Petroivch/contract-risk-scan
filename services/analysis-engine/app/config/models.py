from __future__ import annotations

from pydantic import BaseModel, Field


class MetaConfig(BaseModel):
    config_version: str
    rule_source_registry: str


class LanguageBehaviorConfig(BaseModel):
    default_language: str
    fallback_language: str
    supported_languages: list[str]


class PipelineTimeoutsConfig(BaseModel):
    ocr_seconds: float = Field(..., gt=0)
    analysis_seconds: float = Field(..., gt=0)


class PipelineLimitsConfig(BaseModel):
    max_document_text_chars: int = Field(..., gt=0)
    max_document_base64_chars: int = Field(..., gt=0)


class OcrConfig(BaseModel):
    source_label: str


class SegmentationConfig(BaseModel):
    primary_separator: str
    secondary_separator: str
    clause_id_prefix: str
    fallback_clause_id: str
    fallback_clause_text: dict[str, str]


class IngestionConfig(BaseModel):
    empty_text_placeholder: dict[str, str]


class PipelineErrorsConfig(BaseModel):
    job_not_found: dict[str, str]
    analysis_not_finished: dict[str, str]
    invalid_content_source: dict[str, str]
    document_text_too_long: dict[str, str]
    document_base64_too_long: dict[str, str]


class PipelineConfig(BaseModel):
    timeouts: PipelineTimeoutsConfig
    limits: PipelineLimitsConfig
    ocr: OcrConfig
    ingestion: IngestionConfig
    segmentation: SegmentationConfig
    errors: PipelineErrorsConfig


class ExecutionStrategyReasonsConfig(BaseModel):
    document_text: dict[str, str]
    document_base64: dict[str, str]
    mime_type_override: dict[str, str]


class ExecutionStrategyConfig(BaseModel):
    default_mode: str
    document_text_mode: str
    document_base64_mode: str
    allow_server_assist: bool
    offline_capable_modes: list[str]
    network_required_modes: list[str]
    mime_type_overrides: dict[str, str]
    reasons: ExecutionStrategyReasonsConfig


class RiskRuleConfig(BaseModel):
    id: str
    source_ref: str
    keywords: list[str]
    severity: str
    title: dict[str, str]
    description: dict[str, str]
    mitigation: dict[str, str]


class DisputeMarkerConfig(BaseModel):
    id: str
    source_ref: str
    markers: list[str]
    reason: dict[str, str]
    consequence: dict[str, str]
    confidence: float = Field(..., ge=0.0, le=1.0)


class RiskFallbackConfig(BaseModel):
    risk_title: dict[str, str]
    risk_description: dict[str, str]
    role_relevance: dict[str, str]
    mitigation: dict[str, str]
    dispute_reason: dict[str, str]
    dispute_consequence: dict[str, str]


class RoleRelevanceTemplatesConfig(BaseModel):
    role_mentioned: dict[str, str]
    role_generic: dict[str, str]


class RiskScoringConfig(BaseModel):
    risk_id_prefix: str
    max_clause_excerpt_chars: int = Field(..., gt=0)
    fallback_dispute_confidence: float = Field(..., ge=0.0, le=1.0)
    severity_labels: dict[str, dict[str, str]]
    role_relevance_templates: RoleRelevanceTemplatesConfig
    risk_rules: list[RiskRuleConfig]
    dispute_markers: list[DisputeMarkerConfig]
    fallback: RiskFallbackConfig


class SummaryFallbackConfig(BaseModel):
    must_do: dict[str, str]
    should_review: dict[str, str]
    payment_terms: dict[str, str]
    deadlines: dict[str, str]
    penalties: dict[str, str]


class SummaryGenerationConfig(BaseModel):
    markers: dict[str, list[str]]
    max_items_per_section: int = Field(..., gt=0)
    max_line_length: int = Field(..., gt=0)
    overview_templates: dict[str, str]
    fallback_values: SummaryFallbackConfig


class ContractBriefSectionsConfig(BaseModel):
    intro: dict[str, str]
    role_obligations: dict[str, str]
    counterparty_obligations: dict[str, str]
    general_obligations: dict[str, str]
    payment_terms: dict[str, str]
    deadlines: dict[str, str]
    penalties: dict[str, str]
    disputed_clauses: dict[str, str]


class TemplatesConfig(BaseModel):
    contract_brief: dict[str, str]
    contract_brief_sections: ContractBriefSectionsConfig


class ServiceMetadataConfig(BaseModel):
    title: str
    description: str
    version: str


class AnalysisRuntimeConfig(BaseModel):
    meta: MetaConfig
    service_metadata: ServiceMetadataConfig
    language_behavior: LanguageBehaviorConfig
    pipeline: PipelineConfig
    execution_strategy: ExecutionStrategyConfig
    templates: TemplatesConfig
    risk_scoring: RiskScoringConfig
    summary_generation: SummaryGenerationConfig
