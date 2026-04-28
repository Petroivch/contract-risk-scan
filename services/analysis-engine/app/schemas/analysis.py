from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator, model_validator

from app.config.runtime import get_runtime_config
from app.localization import (
    default_analysis_language,
    normalize_analysis_language,
    resolve_localized_text,
    supported_analysis_languages,
)


class AnalysisJobStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class RiskSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RoleContext(BaseModel):
    role: str = Field(
        ...,
        min_length=2,
        max_length=64,
        description="User-selected role (editable dropdown value).",
    )
    counterparty_role: str | None = Field(
        default=None,
        max_length=64,
        description="Optional counterparty role label.",
    )


def _language_field_description() -> str:
    supported_values = ", ".join(supported_analysis_languages())
    return (
        "Analysis output language. Supported values: "
        f"{supported_values}. Invalid values fallback to default language."
    )


class AnalysisRunRequest(BaseModel):
    document_name: str = Field(..., min_length=1, max_length=255)
    role_context: RoleContext
    document_text: str | None = Field(
        default=None,
        description="Raw extracted text from the contract if available.",
    )
    document_base64: str | None = Field(
        default=None,
        description="Base64 content for direct ingestion when text is not pre-extracted.",
    )
    mime_type: str | None = Field(default=None, max_length=128)
    language: str = Field(
        default_factory=default_analysis_language,
        min_length=2,
        max_length=8,
        description=_language_field_description(),
    )
    locale: str | None = Field(
        default=None,
        min_length=2,
        max_length=8,
        description="Alias for language; synchronized with language for core-api compatibility.",
    )

    @field_validator("language", "locale", mode="before")
    @classmethod
    def validate_locale_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return normalize_analysis_language(value)

    @model_validator(mode="after")
    def validate_payload(self) -> "AnalysisRunRequest":
        effective_language = normalize_analysis_language(self.locale or self.language)
        self.language = effective_language
        self.locale = effective_language

        if not self.document_text and not self.document_base64:
            config = get_runtime_config()
            message = resolve_localized_text(config.pipeline.errors.invalid_content_source, effective_language)
            raise ValueError(message)
        return self


class AnalysisRunResponse(BaseModel):
    job_id: str
    status: AnalysisJobStatus
    language: str
    locale: str
    created_at: datetime
    execution_plan: "AnalysisExecutionPlan"


class AnalysisStatusResponse(BaseModel):
    job_id: str
    status: AnalysisJobStatus
    language: str
    locale: str
    created_at: datetime
    updated_at: datetime
    execution_plan: "AnalysisExecutionPlan"
    error_message: str | None = None


class RiskItem(BaseModel):
    risk_id: str
    rule_id: str | None = None
    title: str
    severity: RiskSeverity
    clause_id: str | None = None
    description: str
    role_relevance: str
    mitigation: str


class DisputedClauseItem(BaseModel):
    clause_id: str
    clause_excerpt: str
    dispute_reason: str
    possible_consequence: str
    confidence: float = Field(..., ge=0.0, le=1.0)


class RoleFocusedSummary(BaseModel):
    role: str
    overview: str
    must_do: list[str]
    should_review: list[str]
    payment_terms: list[str]
    deadlines: list[str]
    penalties: list[str]


class IngestionMetadata(BaseModel):
    extraction_source: str
    extraction_ok: bool
    extraction_error: str | None = None
    sha256: str | None = None


class ContractTypeMetadata(BaseModel):
    type_id: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    ru_name: str
    legal_framework: str


class AsymmetrySignalItem(BaseModel):
    risk_id: str
    clause_id: str | None = None
    summary: str
    details: str
    severity_hint: RiskSeverity
    affected_roles: list[str]


class AnalysisExecutionPlan(BaseModel):
    mode: str
    offline_capable: bool
    network_required: bool
    policy_source: str
    reason: str


class AnalysisCapabilitiesResponse(BaseModel):
    default_language: str
    fallback_language: str
    supported_languages: list[str]
    document_text_mode: str
    document_base64_mode: str
    allow_server_assist: bool
    offline_capable_modes: list[str]
    network_required_modes: list[str]
    mime_type_overrides: dict[str, str]
    service_version: str


class AnalysisOutput(BaseModel):
    language: str
    locale: str
    execution_plan: AnalysisExecutionPlan
    contract_brief: str
    risks: list[RiskItem]
    disputed_clauses: list[DisputedClauseItem]
    role_focused_summary: RoleFocusedSummary
    ingestion: IngestionMetadata | None = None
    contract_type: ContractTypeMetadata | None = None
    asymmetry_signals: list[AsymmetrySignalItem] = Field(default_factory=list)


class AnalysisResultResponse(BaseModel):
    job_id: str
    status: AnalysisJobStatus
    language: str
    locale: str
    execution_plan: AnalysisExecutionPlan
    result: AnalysisOutput | None = None
    error_message: str | None = None
