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
    extractors_enabled: dict[str, bool] = Field(default_factory=dict)
    extraction_timeout_seconds: float = Field(default=20.0, gt=0)
    fallback_to_server_assist: bool = False


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


class ContractTypeConfig(BaseModel):
    id: str
    ru_name: str
    en_name: str | None = None
    keywords: list[str] = Field(default_factory=list)
    markers: list[str] = Field(default_factory=list)
    legal_framework: str = ""
    characteristic_clauses: list[str] = Field(default_factory=list)
    high_priority_risks: list[str] = Field(default_factory=list)
    legal_notes: str | None = None


class DetectionLogicConfig(BaseModel):
    type: str = "keyword_any"
    patterns: list[str] = Field(default_factory=list)
    all_patterns: list[str] = Field(default_factory=list)
    any_patterns: list[str] = Field(default_factory=list)
    absent_patterns: list[str] = Field(default_factory=list)
    actor_patterns: dict[str, list[str]] = Field(default_factory=dict)
    timeline_patterns: dict[str, list[str]] = Field(default_factory=dict)
    min_matches: int = Field(default=1, ge=1)
    source: str = "clause"
    description: str | None = None
    negate: bool = False


class RoleEscalationEntryConfig(BaseModel):
    escalate_to: str
    reason_ru: str | None = None
    reason_en: str | None = None
    reason_it: str | None = None
    reason_fr: str | None = None


class RiskRuleConfig(BaseModel):
    id: str
    source_ref: str
    keywords: list[str] = Field(default_factory=list)
    severity: str | None = None
    severity_base: str | None = None
    legal_basis: str | None = None
    affected_contract_types: list[str] = Field(default_factory=list)
    detection_logic: DetectionLogicConfig | None = None
    role_escalation: dict[str, RoleEscalationEntryConfig] = Field(default_factory=dict)
    title: dict[str, str]
    description: dict[str, str]
    mitigation: dict[str, str]
    examples: list[str] = Field(default_factory=list)


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


class TruncationConfig(BaseModel):
    max_chars: int = Field(..., gt=0)
    preserve_word_boundary: bool = True
    ensure_sentence_end: bool = True
    fallback_ending: str = "..."


class RiskScoringConfig(BaseModel):
    risk_id_prefix: str
    max_clause_excerpt_chars: int = Field(default=300, gt=0)
    fallback_dispute_confidence: float = Field(..., ge=0.0, le=1.0)
    severity_labels: dict[str, dict[str, str]]
    role_relevance_templates: RoleRelevanceTemplatesConfig
    risk_rules: list[RiskRuleConfig]
    dispute_markers: list[DisputeMarkerConfig]
    fallback: RiskFallbackConfig
    truncation: TruncationConfig | None = None
    role_escalation_matrix: dict[str, dict[str, dict[str, RoleEscalationEntryConfig]]] = Field(
        default_factory=dict
    )


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
    contract_types: list[ContractTypeConfig] = Field(default_factory=list)
    risk_scoring: RiskScoringConfig
    summary_generation: SummaryGenerationConfig
