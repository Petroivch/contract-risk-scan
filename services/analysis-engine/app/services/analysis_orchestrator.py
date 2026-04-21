from __future__ import annotations

import asyncio

from app.config.runtime import get_runtime_config
from app.localization import normalize_analysis_language
from app.schemas.analysis import AnalysisOutput, AnalysisRunRequest
from app.services.clause_segmentation import ClauseSegmentationService
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

    async def process_job(self, job_id: str, request: AnalysisRunRequest) -> None:
        self.store.mark_processing(job_id)
        language = normalize_analysis_language(request.language)

        try:
            async with asyncio.timeout(self._runtime_config.pipeline.timeouts.analysis_seconds):
                ingestion_payload = self.ingestion_service.ingest(request)

                async with asyncio.timeout(self._runtime_config.pipeline.timeouts.ocr_seconds):
                    ocr_result = await self.ocr_service.extract_text(ingestion_payload)

                clauses = self.clause_segmentation_service.segment(ocr_result.text, language)

                risks = self.risk_scoring_service.score(
                    clauses,
                    request.role_context.role,
                    language,
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
                )

                output = AnalysisOutput(
                    language=language,
                    locale=language,
                    execution_plan=self.execution_strategy_service.resolve(request),
                    contract_brief=contract_brief,
                    risks=risks,
                    disputed_clauses=disputed_clauses,
                    role_focused_summary=role_focused_summary,
                )

                self.store.mark_completed(job_id, output.model_dump())
        except Exception as exc:  # pragma: no cover - defensive fallback
            self.store.mark_failed(job_id, str(exc))
