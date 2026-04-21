from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from threading import Lock
from typing import Any
from uuid import uuid4

from app.schemas.analysis import AnalysisJobStatus, AnalysisRunRequest


@dataclass(slots=True)
class JobRecord:
    job_id: str
    status: AnalysisJobStatus
    created_at: datetime
    updated_at: datetime
    request: AnalysisRunRequest
    result: dict[str, Any] | None = None
    error_message: str | None = None


class InMemoryJobStore:
    """Thread-safe in-memory store for analysis jobs (MVP skeleton)."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._jobs: dict[str, JobRecord] = {}

    def create_job(self, request: AnalysisRunRequest) -> JobRecord:
        timestamp = datetime.now(timezone.utc)
        record = JobRecord(
            job_id=str(uuid4()),
            status=AnalysisJobStatus.QUEUED,
            created_at=timestamp,
            updated_at=timestamp,
            request=request,
        )

        with self._lock:
            self._jobs[record.job_id] = record

        return record

    def get_job(self, job_id: str) -> JobRecord | None:
        with self._lock:
            return self._jobs.get(job_id)

    def mark_processing(self, job_id: str) -> None:
        self._set_status(job_id, AnalysisJobStatus.PROCESSING)

    def mark_completed(self, job_id: str, result: dict[str, Any]) -> None:
        with self._lock:
            record = self._jobs[job_id]
            record.status = AnalysisJobStatus.COMPLETED
            record.updated_at = datetime.now(timezone.utc)
            record.result = result
            record.error_message = None

    def mark_failed(self, job_id: str, error_message: str) -> None:
        with self._lock:
            record = self._jobs[job_id]
            record.status = AnalysisJobStatus.FAILED
            record.updated_at = datetime.now(timezone.utc)
            record.error_message = error_message

    def _set_status(self, job_id: str, status: AnalysisJobStatus) -> None:
        with self._lock:
            record = self._jobs[job_id]
            record.status = status
            record.updated_at = datetime.now(timezone.utc)
