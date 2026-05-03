from __future__ import annotations

import argparse
import asyncio
import base64
import json
import sys
import time
import traceback
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib import error as urlerror
from urllib import parse as urlparse
from urllib import request as urlrequest

SERVICE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = SERVICE_ROOT.parents[1]
WORKSPACE_ROOT = SERVICE_ROOT.parents[2]

if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

from app.schemas.analysis import (  # noqa: E402
    AnalysisOutput,
    AnalysisRunRequest,
    AsymmetrySignalItem,
    ContractTypeMetadata,
    IngestionMetadata,
)
from app.services.asymmetry_detector import AsymmetryDetector  # noqa: E402
from app.services.clause_segmentation import ClauseSegmentationService  # noqa: E402
from app.services.contract_analysis import ContractTypeDetector  # noqa: E402
from app.services.contract_brief import ContractBriefGenerationService  # noqa: E402
from app.services.execution_strategy import ExecutionStrategyService  # noqa: E402
from app.services.ingestion import IngestionService  # noqa: E402
from app.services.ocr import OCRService  # noqa: E402
from app.services.risk_scoring import RiskScoringService  # noqa: E402
from app.services.summary_generation import SummaryGenerationService  # noqa: E402


SUPPORTED_EXTENSIONS = {".txt", ".md", ".html", ".htm", ".pdf", ".docx", ".doc"}
ROLE_HINTS: list[tuple[str, str | None, tuple[str, ...]]] = [
    ("Исполнитель", "Заказчик", ("исполнитель", "заказчик", "оказания услуг", "техническое задание")),
    ("Подрядчик", "Заказчик", ("подрядчик", "заказчик", "работ", "смет")),
    ("Поставщик", "Покупатель", ("поставщик", "покупатель", "поставка", "товар")),
    ("Арендатор", "Арендодатель", ("арендатор", "арендодатель", "аренда", "наймодатель")),
    ("Работник", "Работодатель", ("работник", "работодатель", "трудовой договор", "заработная плата")),
    ("Заемщик", "Кредитор", ("заемщик", "кредитор", "займ", "кредит")),
    ("Лицензиат", "Лицензиар", ("лицензиат", "лицензиар", "лицензия", "исключительное право")),
    ("Гражданин", "Заказчик", ("гражданин", "целевом обучении", "образовательной программе")),
]


@dataclass(slots=True)
class CorpusCase:
    case_id: str
    document_path: Path
    relative_path: str
    document_name: str
    role: str
    counterparty_role: str | None
    language: str
    mime_type: str | None
    tags: list[str]
    expected: dict[str, Any]
    source_group: str


class LocalAnalysisRuntime:
    def __init__(self) -> None:
        self.ingestion_service = IngestionService()
        self.ocr_service = OCRService()
        self.clause_segmentation_service = ClauseSegmentationService()
        self.contract_type_detector = ContractTypeDetector()
        self.asymmetry_detector = AsymmetryDetector()
        self.risk_scoring_service = RiskScoringService()
        self.summary_generation_service = SummaryGenerationService()
        self.contract_brief_generation_service = ContractBriefGenerationService()
        self.execution_strategy_service = ExecutionStrategyService()

    def run(self, request: AnalysisRunRequest) -> tuple[AnalysisOutput, IngestionMetadata]:
        ingestion_payload = self.ingestion_service.ingest(request)
        text = ingestion_payload.text
        if request.mime_type and request.mime_type.startswith("image/"):
            text = asyncio.run(self.ocr_service.extract_text(ingestion_payload)).text

        clauses = self.clause_segmentation_service.segment(text, request.language)
        detected_contract_type = self.contract_type_detector.detect(text, request.document_name)
        asymmetry_signals = self.asymmetry_detector.detect_asymmetries(clauses)
        risks = self.risk_scoring_service.score(
            clauses=clauses,
            role=request.role_context.role,
            language=request.language,
            contract_type=(
                detected_contract_type.type_id if detected_contract_type.type_id != "general_contract" else None
            ),
            document_text=text,
            counterparty_role=request.role_context.counterparty_role,
            asymmetry_signals=asymmetry_signals,
        )
        disputed_clauses = self.risk_scoring_service.extract_disputed_clauses(clauses, request.language)
        role_focused_summary = self.summary_generation_service.generate(
            document_text=text,
            clauses=clauses,
            risks=risks,
            role=request.role_context.role,
            counterparty_role=request.role_context.counterparty_role,
            language=request.language,
        )
        contract_brief = self.contract_brief_generation_service.generate(
            document_name=request.document_name,
            document_text=text,
            clauses=clauses,
            role=request.role_context.role,
            counterparty_role=request.role_context.counterparty_role,
            language=request.language,
            disputed_clauses=disputed_clauses,
            detected_contract_type=detected_contract_type,
        )
        output = AnalysisOutput(
            language=request.language,
            locale=request.locale or request.language,
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
        )
        return output, output.ingestion or IngestionMetadata(
            extraction_source="unknown",
            extraction_ok=False,
            extraction_error="missing ingestion metadata",
        )


def default_manifest_path() -> Path:
    tests_manifest = SERVICE_ROOT / "tests" / "golden_set" / "cases.json"
    if tests_manifest.exists():
        return tests_manifest
    return SERVICE_ROOT / "golden_set" / "cases.json"


def default_artifacts_root() -> Path:
    return SERVICE_ROOT / "artifacts" / "corpus_results"


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def resolve_path(raw_path: str | Path, *, base_dir: Path | None = None) -> Path:
    candidate = Path(raw_path)
    if candidate.is_absolute():
        return candidate.resolve()

    search_roots = [base_dir, Path.cwd(), SERVICE_ROOT, REPO_ROOT, WORKSPACE_ROOT]
    for root in search_roots:
        if root is None:
            continue
        resolved = (root / candidate).resolve()
        if resolved.exists():
            return resolved
    return ((base_dir or WORKSPACE_ROOT) / candidate).resolve()


def resolve_output_dir(raw_path: str | Path) -> Path:
    candidate = Path(raw_path)
    if candidate.is_absolute():
        return candidate.resolve()
    return (Path.cwd() / candidate).resolve()


def slugify_case_id(relative_path: str) -> str:
    return relative_path.replace("\\", "/").replace("/", "__").replace(".", "_")


def infer_mime_type(document_path: Path) -> str | None:
    suffix = document_path.suffix.lower()
    if suffix == ".pdf":
        return "application/pdf"
    if suffix == ".docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    if suffix == ".doc":
        return "application/msword"
    if suffix in {".html", ".htm"}:
        return "text/html"
    if suffix in {".txt", ".md"}:
        return "text/plain"
    return None


def infer_role_context(document_name: str, text: str) -> tuple[str, str | None]:
    combined = f"{document_name}\n{text}".casefold()
    best_score = 0
    best_pair = ("Исполнитель", "Заказчик")
    for role, counterparty_role, markers in ROLE_HINTS:
        score = sum(1 for marker in markers if marker in combined)
        if score > best_score:
            best_score = score
            best_pair = (role, counterparty_role)
    return best_pair


def load_manifest(manifest_path: Path) -> list[CorpusCase]:
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    raw_cases = payload["cases"] if isinstance(payload, dict) else payload
    cases: list[CorpusCase] = []
    for raw_case in raw_cases:
        document_path = resolve_path(raw_case["document_path"], base_dir=manifest_path.parent)
        relative_path = raw_case.get("relative_path")
        if not relative_path:
            try:
                relative_path = document_path.relative_to(WORKSPACE_ROOT).as_posix()
            except ValueError:
                relative_path = document_path.name
        cases.append(
            CorpusCase(
                case_id=raw_case.get("case_id", slugify_case_id(relative_path)),
                document_path=document_path,
                relative_path=relative_path,
                document_name=raw_case.get("document_name", document_path.name),
                role=raw_case.get("role", "Исполнитель"),
                counterparty_role=raw_case.get("counterparty_role"),
                language=raw_case.get("language", "ru"),
                mime_type=raw_case.get("mime_type") or infer_mime_type(document_path),
                tags=list(raw_case.get("tags", [])),
                expected=dict(raw_case.get("expected", {})),
                source_group=raw_case.get("source_group", "manifest"),
            )
        )
    return cases


def collect_cases_from_input_dirs(input_dirs: list[Path], language: str = "ru") -> list[CorpusCase]:
    cases: list[CorpusCase] = []
    for input_dir in input_dirs:
        root = resolve_path(input_dir)
        for document_path in sorted(path for path in root.rglob("*") if path.is_file()):
            if document_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                continue
            relative_path = document_path.relative_to(WORKSPACE_ROOT).as_posix()
            cases.append(
                CorpusCase(
                    case_id=slugify_case_id(relative_path),
                    document_path=document_path.resolve(),
                    relative_path=relative_path,
                    document_name=document_path.name,
                    role="Исполнитель",
                    counterparty_role="Заказчик",
                    language=language,
                    mime_type=infer_mime_type(document_path),
                    tags=["ad_hoc"],
                    expected={},
                    source_group=input_dir.name,
                )
            )
    return cases


def build_request(case: CorpusCase, *, document_base64: str, role: str, counterparty_role: str | None) -> AnalysisRunRequest:
    return AnalysisRunRequest(
        document_name=case.document_name,
        role_context={"role": role, "counterparty_role": counterparty_role},
        document_text=None,
        document_base64=document_base64,
        language=case.language,
        mime_type=case.mime_type or infer_mime_type(case.document_path),
    )


def poll_analysis_result(run_url: str, job_id: str, language: str, *, timeout_seconds: float = 180.0) -> dict[str, Any]:
    base_url = run_url.rsplit("/run", 1)[0]
    result_url = f"{base_url}/{job_id}/result?language={urlparse.quote(language)}"
    status_url = f"{base_url}/{job_id}/status?language={urlparse.quote(language)}"
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        try:
            with urlrequest.urlopen(result_url, timeout=30) as response:
                if response.status == 200:
                    return json.loads(response.read().decode("utf-8"))
        except urlerror.HTTPError as exc:
            if exc.code != 409:
                raise
        with urlrequest.urlopen(status_url, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
        if payload.get("status") == "failed":
            raise RuntimeError(payload.get("error_message") or "analysis job failed")
        time.sleep(0.35)
    raise TimeoutError(f"Timed out waiting for {job_id}")


def run_case(
    case: CorpusCase,
    runtime: LocalAnalysisRuntime | None = None,
    *,
    call_analysis_api: str | None = None,
) -> dict[str, Any]:
    started_at = datetime.now(timezone.utc).isoformat()
    started_perf = time.perf_counter()
    record: dict[str, Any] = {
        "case_id": case.case_id,
        "relative_path": case.relative_path,
        "document_path": str(case.document_path),
        "document_name": case.document_name,
        "role": case.role,
        "counterparty_role": case.counterparty_role,
        "language": case.language,
        "mime_type": case.mime_type,
        "tags": case.tags,
        "source_group": case.source_group,
        "expected": case.expected,
        "started_at": started_at,
    }
    try:
        document_bytes = case.document_path.read_bytes()
        document_base64 = base64.b64encode(document_bytes).decode("ascii")
        mime_type = case.mime_type or infer_mime_type(case.document_path)

        if runtime is None and not call_analysis_api:
            runtime = LocalAnalysisRuntime()

        request = build_request(
            case,
            document_base64=document_base64,
            role=case.role,
            counterparty_role=case.counterparty_role,
        )

        if call_analysis_api:
            payload = request.model_dump(mode="json")
            http_request = urlrequest.Request(
                call_analysis_api,
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urlrequest.urlopen(http_request, timeout=60) as response:
                job_payload = json.loads(response.read().decode("utf-8"))
            result_payload = poll_analysis_result(
                call_analysis_api,
                job_payload["job_id"],
                request.language,
            )
            output = result_payload["result"]
            ingestion_meta = (output or {}).get("ingestion") or {}
            role = request.role_context.role
            counterparty_role = request.role_context.counterparty_role
        else:
            assert runtime is not None
            preflight_request = request
            preflight_payload = runtime.ingestion_service.ingest(preflight_request)
            if case.role == "Исполнитель" and case.counterparty_role == "Заказчик":
                inferred_role, inferred_counterparty = infer_role_context(case.document_name, preflight_payload.text)
                role = inferred_role
                counterparty_role = inferred_counterparty
                request = build_request(
                    case,
                    document_base64=document_base64,
                    role=role,
                    counterparty_role=counterparty_role,
                )
            else:
                role = case.role
                counterparty_role = case.counterparty_role
            output_model, ingestion_model = runtime.run(request)
            output = output_model.model_dump(mode="json")
            ingestion_meta = ingestion_model.model_dump(mode="json")

        record.update(
            {
                "status": "completed",
                "role": role,
                "counterparty_role": counterparty_role,
                "request": request.model_dump(mode="json"),
                "ingestion_preflight": {
                    "mime_type": mime_type,
                    "extractor": ingestion_meta.get("extraction_source"),
                    "extraction_source": ingestion_meta.get("extraction_source"),
                    "extraction_ok": ingestion_meta.get("extraction_ok"),
                    "error": ingestion_meta.get("extraction_error"),
                    "extraction_error": ingestion_meta.get("extraction_error"),
                    "sha256": ingestion_meta.get("sha256"),
                },
                "metrics": {
                    "risk_count": len((output or {}).get("risks", [])),
                    "high_risk_count": sum(
                        1
                        for risk in (output or {}).get("risks", [])
                        if risk.get("severity") in {"high", "critical"}
                    ),
                    "disputed_clause_count": len((output or {}).get("disputed_clauses", [])),
                    "asymmetry_signal_count": len((output or {}).get("asymmetry_signals", [])),
                    "contract_type": ((output or {}).get("contract_type") or {}).get("type_id"),
                },
                "analysis": output,
                "result": output,
            }
        )
    except Exception as exc:  # pragma: no cover - defensive CLI path
        record.update(
            {
                "status": "failed",
                "error": {
                    "type": type(exc).__name__,
                    "message": str(exc),
                    "traceback": traceback.format_exc(),
                },
            }
        )

    finished_at = datetime.now(timezone.utc).isoformat()
    record["finished_at"] = finished_at
    record["duration_ms"] = round((time.perf_counter() - started_perf) * 1000, 2)
    return record


def run_cases(
    cases: list[CorpusCase],
    output_dir: Path,
    manifest_path: Path | None = None,
    *,
    call_analysis_api: str | None = None,
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    results_dir = output_dir / "results"
    results_dir.mkdir(parents=True, exist_ok=True)

    runtime = None if call_analysis_api else LocalAnalysisRuntime()
    severity_counts: Counter[str] = Counter()
    contract_type_counts: Counter[str] = Counter()
    extractor_counts: Counter[str] = Counter()
    completed = 0
    failed = 0

    for case in cases:
        record = run_case(case, runtime, call_analysis_api=call_analysis_api)
        (results_dir / f"{case.case_id}.json").write_text(
            json.dumps(record, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        if record["status"] == "completed":
            completed += 1
            analysis = record.get("analysis", {})
            contract_type = (analysis.get("contract_type") or {}).get("type_id")
            if contract_type:
                contract_type_counts[contract_type] += 1
            extractor = (record.get("ingestion_preflight") or {}).get("extractor")
            if extractor:
                extractor_counts[extractor] += 1
            for risk in analysis.get("risks", []):
                severity_counts[risk["severity"]] += 1
        else:
            failed += 1

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "manifest_path": str(manifest_path) if manifest_path else None,
        "output_dir": str(output_dir),
        "total_cases": len(cases),
        "completed_cases": completed,
        "failed_cases": failed,
        "contract_type_counts": dict(contract_type_counts),
        "severity_counts": dict(severity_counts),
        "extractor_counts": dict(extractor_counts),
        "case_ids": [case.case_id for case in cases],
    }
    (output_dir / "run_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return summary


def filter_cases(cases: list[CorpusCase], case_ids: set[str] | None, limit: int | None) -> list[CorpusCase]:
    filtered = [case for case in cases if not case_ids or case.case_id in case_ids]
    return filtered[:limit] if limit is not None else filtered


def parse_input_dirs(raw_value: str | None) -> list[Path]:
    if not raw_value:
        return []
    return [resolve_path(part.strip()) for part in raw_value.split(",") if part.strip()]


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the analysis engine over a contract corpus.")
    parser.add_argument("--manifest", type=Path, default=None, help="Optional JSON manifest with explicit role labels.")
    parser.add_argument(
        "--input-dirs",
        help="Comma-separated input directories, e.g. \"договоры,договоры 2,договоры 3,договоры 4\".",
    )
    parser.add_argument("--language", default="ru", help="Default language for ad hoc runs.")
    parser.add_argument("--output-dir", default=str(default_artifacts_root()), help="Directory for per-file JSON.")
    parser.add_argument("--case-id", action="append", help="Optional case_id filter. Can be repeated.")
    parser.add_argument("--limit", type=int, help="Optional max number of cases.")
    parser.add_argument("--call-analysis-api", help="Optional POST /analysis/run endpoint for remote execution.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    output_dir = resolve_output_dir(args.output_dir)
    manifest_path = resolve_path(args.manifest, base_dir=Path.cwd()) if args.manifest else None

    if manifest_path:
        cases = load_manifest(manifest_path)
    else:
        input_dirs = parse_input_dirs(args.input_dirs)
        if not input_dirs:
            raise SystemExit("Either --manifest or --input-dirs is required.")
        cases = collect_cases_from_input_dirs(input_dirs, language=args.language)

    filtered_cases = filter_cases(cases, set(args.case_id or []), args.limit)
    summary = run_cases(
        filtered_cases,
        output_dir=output_dir,
        manifest_path=manifest_path,
        call_analysis_api=args.call_analysis_api,
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if summary["failed_cases"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
