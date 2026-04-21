from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException, Query, status

from app.config.runtime import get_runtime_config
from app.localization import default_analysis_language, normalize_analysis_language, resolve_localized_text
from app.schemas.analysis import (
    AnalysisCapabilitiesResponse,
    AnalysisJobStatus,
    AnalysisOutput,
    AnalysisResultResponse,
    AnalysisRunRequest,
    AnalysisRunResponse,
    AnalysisStatusResponse,
)
from app.services.analysis_orchestrator import AnalysisOrchestrator
from app.services.execution_strategy import ExecutionStrategyService
from app.services.job_store import InMemoryJobStore

router = APIRouter()
_runtime_config = get_runtime_config()
job_store = InMemoryJobStore()
orchestrator = AnalysisOrchestrator(store=job_store)
execution_strategy_service = ExecutionStrategyService()


def _resolve_query_language(language: str | None, locale: str | None) -> str:
    return normalize_analysis_language(locale or language or default_analysis_language())


@router.get("/capabilities", response_model=AnalysisCapabilitiesResponse)
async def get_analysis_capabilities() -> AnalysisCapabilitiesResponse:
    return AnalysisCapabilitiesResponse(
        default_language=_runtime_config.language_behavior.default_language,
        fallback_language=_runtime_config.language_behavior.fallback_language,
        supported_languages=_runtime_config.language_behavior.supported_languages,
        document_text_mode=_runtime_config.execution_strategy.document_text_mode,
        document_base64_mode=_runtime_config.execution_strategy.document_base64_mode,
        allow_server_assist=_runtime_config.execution_strategy.allow_server_assist,
        offline_capable_modes=_runtime_config.execution_strategy.offline_capable_modes,
        network_required_modes=_runtime_config.execution_strategy.network_required_modes,
        mime_type_overrides=_runtime_config.execution_strategy.mime_type_overrides,
        service_version=_runtime_config.service_metadata.version,
    )


@router.post("/run", response_model=AnalysisRunResponse, status_code=status.HTTP_202_ACCEPTED)
async def run_analysis(request: AnalysisRunRequest) -> AnalysisRunResponse:
    record = job_store.create_job(request)
    asyncio.create_task(orchestrator.process_job(record.job_id, request))

    return AnalysisRunResponse(
        job_id=record.job_id,
        status=record.status,
        language=record.request.language,
        locale=record.request.language,
        created_at=record.created_at,
        execution_plan=execution_strategy_service.resolve(record.request),
    )


@router.get("/{job_id}/status", response_model=AnalysisStatusResponse)
async def get_analysis_status(
    job_id: str,
    language: str | None = Query(default=None),
    locale: str | None = Query(default=None),
) -> AnalysisStatusResponse:
    record = job_store.get_job(job_id)
    if not record:
        message = resolve_localized_text(
            _runtime_config.pipeline.errors.job_not_found,
            _resolve_query_language(language, locale),
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)

    return AnalysisStatusResponse(
        job_id=record.job_id,
        status=record.status,
        language=record.request.language,
        locale=record.request.language,
        created_at=record.created_at,
        updated_at=record.updated_at,
        execution_plan=execution_strategy_service.resolve(record.request),
        error_message=record.error_message,
    )


@router.get("/{job_id}/result", response_model=AnalysisResultResponse)
async def get_analysis_result(
    job_id: str,
    language: str | None = Query(default=None),
    locale: str | None = Query(default=None),
) -> AnalysisResultResponse:
    record = job_store.get_job(job_id)
    if not record:
        message = resolve_localized_text(
            _runtime_config.pipeline.errors.job_not_found,
            _resolve_query_language(language, locale),
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)

    if record.status in {AnalysisJobStatus.QUEUED, AnalysisJobStatus.PROCESSING}:
        message = resolve_localized_text(
            _runtime_config.pipeline.errors.analysis_not_finished,
            record.request.language,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=message,
        )

    output = AnalysisOutput.model_validate(record.result) if record.result else None

    return AnalysisResultResponse(
        job_id=record.job_id,
        status=record.status,
        language=record.request.language,
        locale=record.request.language,
        execution_plan=execution_strategy_service.resolve(record.request),
        result=output,
        error_message=record.error_message,
    )
