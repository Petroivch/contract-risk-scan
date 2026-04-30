from __future__ import annotations

import asyncio

from app.config.runtime import get_runtime_config
from app.localization import normalize_analysis_language
from app.schemas.analysis import (
    AnalysisOutput,
    AnalysisRunRequest,
    AsymmetrySignalItem,
    ContractTypeMetadata,
    DetectedRoleItem,
    IngestionMetadata,
    RoleFocusedSummary,
    TextOffset,
)
from app.services.asymmetry_detector import AsymmetryDetector
from app.services.clause_segmentation import ClauseSegmentationService
from app.services.contract_analysis import (
    ContractTypeDetector,
    DetectedRole,
    extract_roles_from_text,
    find_role_matches,
)
from app.services.contract_brief import ContractBriefGenerationService
from app.services.execution_strategy import ExecutionStrategyService
from app.services.ingestion import IngestionService
from app.services.job_store import InMemoryJobStore
from app.services.ocr import OCRService
from app.services.risk_scoring import RiskScoringService
from app.services.summary_generation import SummaryGenerationService


class AnalysisOrchestrator:
    """Coordinates configurable ingestion, parsing and analysis pipeline for one job."""

    def __init__(
        self,
        store: InMemoryJobStore,
        ingestion_service: IngestionService | None = None,
        ocr_service: OCRService | None = None,
        clause_segmentation_service: ClauseSegmentationService | None = None,
        risk_scoring_service: RiskScoringService | None = None,
        summary_generation_service: SummaryGenerationService | None = None,
        contract_brief_generation_service: ContractBriefGenerationService | None = None,
        execution_strategy_service: ExecutionStrategyService | None = None,
        contract_type_detector: ContractTypeDetector | None = None,
        asymmetry_detector: AsymmetryDetector | None = None,
    ) -> None:
        self.store = store
        self._runtime_config = get_runtime_config()
        self.ingestion_service = ingestion_service or IngestionService()
        self.ocr_service = ocr_service or OCRService()
        self.clause_segmentation_service = clause_segmentation_service or ClauseSegmentationService()
        self.risk_scoring_service = risk_scoring_service or RiskScoringService()
        self.summary_generation_service = summary_generation_service or SummaryGenerationService()
        self.contract_brief_generation_service = (
            contract_brief_generation_service or ContractBriefGenerationService()
        )
        self.execution_strategy_service = execution_strategy_service or ExecutionStrategyService()
        self.contract_type_detector = contract_type_detector or ContractTypeDetector()
        self.asymmetry_detector = asymmetry_detector or AsymmetryDetector()

    async def process_job(self, job_id: str, request: AnalysisRunRequest) -> None:
        self.store.mark_processing(job_id)
        language = normalize_analysis_language(request.language)

        try:
            async with asyncio.timeout(self._runtime_config.pipeline.timeouts.analysis_seconds):
                ingestion_payload = self.ingestion_service.ingest(request)

                async with asyncio.timeout(self._runtime_config.pipeline.timeouts.ocr_seconds):
                    ocr_result = await self.ocr_service.extract_text(ingestion_payload)

                clauses = self.clause_segmentation_service.segment(ocr_result.text, language)
                detected_contract_type = self.contract_type_detector.detect(
                    ocr_result.text,
                    request.document_name,
                )
                detected_roles = extract_roles_from_text(ocr_result.text)
                selected_role_matches = find_role_matches(request.role_context.role, ocr_result.text)
                role_not_found = bool(request.role_context.role.strip()) and bool(detected_roles) and not selected_role_matches
                message = (
                    self._build_role_not_found_message(request.role_context.role, detected_roles)
                    if role_not_found
                    else None
                )

                if role_not_found:
                    asymmetry_signals = []
                    risks = []
                    disputed_clauses = []
                    role_focused_summary = RoleFocusedSummary(
                        role=request.role_context.role,
                        overview=message or "",
                        must_do=[],
                        should_review=[],
                        payment_terms=[],
                        deadlines=[],
                        penalties=[],
                    )
                    contract_brief = message or ""
                else:
                    asymmetry_signals = self.asymmetry_detector.detect_asymmetries(clauses)
                    risks = self.risk_scoring_service.score(
                        clauses,
                        request.role_context.role,
                        language,
                        contract_type=(
                            detected_contract_type.type_id
                            if detected_contract_type.type_id != "general_contract"
                            else None
                        ),
                        document_text=ocr_result.text,
                        counterparty_role=request.role_context.counterparty_role,
                        asymmetry_signals=asymmetry_signals,
                    )
                    disputed_clauses = self.risk_scoring_service.extract_disputed_clauses(clauses, language)
                    role_focused_summary = self.summary_generation_service.generate(
                        ocr_result.text,
                        clauses,
                        risks,
                        request.role_context.role,
                        request.role_context.counterparty_role,
                        language,
                    )

                    contract_brief = self.contract_brief_generation_service.generate(
                        document_name=request.document_name,
                        document_text=ocr_result.text,
                        clauses=clauses,
                        role=request.role_context.role,
                        counterparty_role=request.role_context.counterparty_role,
                        language=language,
                        disputed_clauses=disputed_clauses,
                        detected_contract_type=detected_contract_type,
                    )

                output = AnalysisOutput(
                    language=language,
                    locale=language,
                    execution_plan=self.execution_strategy_service.resolve(request),
                    contract_brief=contract_brief,
                    risks=risks,
                    disputed_clauses=disputed_clauses,
                    role_focused_summary=role_focused_summary,
                    ingestion=IngestionMetadata(
                        extraction_source=ingestion_payload.extraction_source,
                        extraction_ok=ingestion_payload.extraction_ok,
                        extraction_error=ingestion_payload.extraction_error,
                        sha256=ingestion_payload.sha256,
                        roles=[
                            {
                                "role": detected_role.role,
                                "canonical_role": detected_role.canonical_role,
                                "start_offset": detected_role.offset_start,
                                "end_offset": detected_role.offset_end,
                            }
                            for detected_role in detected_roles
                        ],
                        detected_roles=[
                            DetectedRoleItem(
                                role=detected_role.role,
                                canonical_role=detected_role.canonical_role,
                                offset=TextOffset(
                                    start=detected_role.offset_start,
                                    end=detected_role.offset_end,
                                ),
                            )
                            for detected_role in detected_roles
                        ],
                    ),
                    contract_type=ContractTypeMetadata(
                        type_id=detected_contract_type.type_id,
                        confidence=detected_contract_type.confidence,
                        ru_name=detected_contract_type.ru_name,
                        legal_framework=detected_contract_type.legal_framework,
                    ),
                    asymmetry_signals=[
                        AsymmetrySignalItem(
                            risk_id=signal.risk_id,
                            clause_id=signal.clause_id,
                            summary=signal.summary,
                            details=signal.details,
                            severity_hint=signal.severity_hint,
                            affected_roles=signal.affected_roles,
                        )
                        for signal in asymmetry_signals
                    ],
                    role_not_found=role_not_found,
                    message=message,
                )

                self.store.mark_completed(job_id, output.model_dump())
        except Exception as exc:  # pragma: no cover - defensive fallback
            self.store.mark_failed(job_id, str(exc))

    @staticmethod
    def _build_role_not_found_message(selected_role: str, detected_roles: list[DetectedRole]) -> str:
        visible_roles: list[str] = []
        seen: set[str] = set()

        for detected_role in detected_roles:
            normalized_role = detected_role.role.casefold()
            if normalized_role in seen:
                continue
            seen.add(normalized_role)
            visible_roles.append(detected_role.role)

        if visible_roles:
            return (
                f"Выбранная роль '{selected_role}' не найдена в тексте договора. "
                f"Найдены роли: {', '.join(visible_roles)}."
            )

        return (
            f"Выбранная роль '{selected_role}' не найдена в тексте договора. "
            "В тексте не удалось определить роли сторон."
        )
