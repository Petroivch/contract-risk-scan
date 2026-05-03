from __future__ import annotations

import argparse
import asyncio
import base64
import json
import mimetypes
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.schemas.analysis import (  # noqa: E402
    AnalysisOutput,
    AnalysisRunRequest,
    ContractTypeMetadata,
    DetectedRoleItem,
    IngestionMetadata,
    RoleFocusedSummary,
    TextOffset,
)
from app.services.clause_segmentation import ClauseSegmentationService  # noqa: E402
from app.services.contract_analysis import (  # noqa: E402
    ContractTypeDetector,
    DetectedRole,
    extract_roles_from_text,
    find_role_matches,
)
from app.services.contract_brief import ContractBriefGenerationService  # noqa: E402
from app.services.execution_strategy import ExecutionStrategyService  # noqa: E402
from app.services.ingestion import IngestionService  # noqa: E402
from app.services.ocr import OCRService  # noqa: E402
from app.services.risk_scoring import RiskScoringService  # noqa: E402
from app.services.summary_generation import SummaryGenerationService  # noqa: E402


SUPPORTED_SUFFIXES = {
    ".bmp",
    ".doc",
    ".docx",
    ".htm",
    ".html",
    ".jpeg",
    ".jpg",
    ".md",
    ".pdf",
    ".png",
    ".rtf",
    ".tif",
    ".tiff",
    ".txt",
}


@dataclass(slots=True)
class AnalysisServices:
    execution_strategy: ExecutionStrategyService
    ingestion: IngestionService
    ocr: OCRService
    segmentation: ClauseSegmentationService
    risk_scoring: RiskScoringService
    summary_generation: SummaryGenerationService
    contract_brief: ContractBriefGenerationService
    contract_type_detector: ContractTypeDetector


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Batch-analyze contract files from any input directory and write a JSON report.",
    )
    parser.add_argument("input_dir", help="Directory with contract files to analyze.")
    parser.add_argument(
        "--output",
        default="analysis-report.json",
        help="Path to the output JSON report. Defaults to ./analysis-report.json.",
    )
    parser.add_argument(
        "--role",
        required=True,
        help="Selected role for role-focused analysis.",
    )
    parser.add_argument(
        "--counterparty-role",
        default=None,
        help="Optional counterparty role label.",
    )
    parser.add_argument(
        "--language",
        default="ru",
        help="Analysis language passed to the engine. Defaults to ru.",
    )
    parser.add_argument(
        "--recursive",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Recursively traverse the input directory. Defaults to true.",
    )
    parser.add_argument(
        "--include-unsupported",
        action="store_true",
        help="Include files with unsupported extensions and let ingestion try UTF-8 fallback decoding.",
    )
    return parser.parse_args()


def build_services() -> AnalysisServices:
    return AnalysisServices(
        execution_strategy=ExecutionStrategyService(),
        ingestion=IngestionService(),
        ocr=OCRService(),
        segmentation=ClauseSegmentationService(),
        risk_scoring=RiskScoringService(),
        summary_generation=SummaryGenerationService(),
        contract_brief=ContractBriefGenerationService(),
        contract_type_detector=ContractTypeDetector(),
    )


def discover_files(
    input_dir: Path,
    output_path: Path,
    *,
    recursive: bool,
    include_unsupported: bool,
) -> tuple[list[Path], list[dict[str, str]]]:
    iterator = input_dir.rglob("*") if recursive else input_dir.glob("*")
    supported_files: list[Path] = []
    skipped_files: list[dict[str, str]] = []

    output_resolved = output_path.resolve()
    for path in sorted(candidate for candidate in iterator if candidate.is_file()):
        if path.resolve() == output_resolved:
            continue

        if include_unsupported or path.suffix.casefold() in SUPPORTED_SUFFIXES:
            supported_files.append(path)
            continue

        skipped_files.append(
            {
                "path": str(path),
                "status": "skipped",
                "reason": f"Unsupported extension '{path.suffix or '<none>'}'.",
            }
        )

    return supported_files, skipped_files


def detect_mime_type(path: Path) -> str | None:
    guessed_type, _ = mimetypes.guess_type(path.name)
    return guessed_type or None


def build_role_not_found_message(selected_role: str, detected_roles: list[DetectedRole]) -> str:
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


def build_request(
    path: Path,
    *,
    role: str,
    counterparty_role: str | None,
    language: str,
) -> AnalysisRunRequest:
    payload = base64.b64encode(path.read_bytes()).decode("ascii")
    return AnalysisRunRequest(
        document_name=path.name,
        role_context={"role": role, "counterparty_role": counterparty_role},
        document_base64=payload,
        mime_type=detect_mime_type(path),
        language=language,
    )


async def analyze_file(
    path: Path,
    input_dir: Path,
    services: AnalysisServices,
    *,
    role: str,
    counterparty_role: str | None,
    language: str,
) -> dict[str, object]:
    request = build_request(
        path,
        role=role,
        counterparty_role=counterparty_role,
        language=language,
    )
    execution_plan = services.execution_strategy.resolve(request)
    ingestion_payload = services.ingestion.ingest(request)
    ocr_result = await services.ocr.extract_text(ingestion_payload)

    clauses = services.segmentation.segment(ocr_result.text, request.language)
    detected_contract_type = services.contract_type_detector.detect(
        ocr_result.text,
        request.document_name,
    )
    detected_roles = extract_roles_from_text(ocr_result.text)
    selected_role_matches = find_role_matches(request.role_context.role, ocr_result.text)
    role_not_found = (
        bool(request.role_context.role.strip())
        and bool(detected_roles)
        and not selected_role_matches
    )
    message = (
        build_role_not_found_message(request.role_context.role, detected_roles)
        if role_not_found
        else None
    )

    if role_not_found:
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
        role_focused_summary_records = []
        contract_brief = message or ""
        contract_brief_records = []
    else:
        risks = services.risk_scoring.score(
            clauses,
            request.role_context.role,
            request.language,
            contract_type=(
                detected_contract_type.type_id
                if detected_contract_type.type_id != "general_contract"
                else None
            ),
            document_text=ocr_result.text,
            counterparty_role=request.role_context.counterparty_role,
            asymmetry_signals=[],
        )
        disputed_clauses = services.risk_scoring.extract_disputed_clauses(clauses, request.language)
        role_focused_summary = services.summary_generation.generate(
            ocr_result.text,
            clauses,
            risks,
            request.role_context.role,
            request.role_context.counterparty_role,
            request.language,
        )
        role_focused_summary_records = services.summary_generation.generate_records(
            role_focused_summary,
            len(clauses),
            risks,
        )
        contract_brief = services.contract_brief.generate(
            document_name=request.document_name,
            document_text=ocr_result.text,
            clauses=clauses,
            role=request.role_context.role,
            counterparty_role=request.role_context.counterparty_role,
            language=request.language,
            disputed_clauses=disputed_clauses,
            detected_contract_type=detected_contract_type,
        )
        contract_brief_records = services.contract_brief.generate_records(
            document_name=request.document_name,
            document_text=ocr_result.text,
            clauses=clauses,
            role=request.role_context.role,
            counterparty_role=request.role_context.counterparty_role,
            language=request.language,
            disputed_clauses=disputed_clauses,
            detected_contract_type=detected_contract_type,
        )

    output = AnalysisOutput(
        language=request.language,
        locale=request.language,
        execution_plan=execution_plan,
        contract_brief=contract_brief,
        contract_brief_records=contract_brief_records,
        risks=risks,
        disputed_clauses=disputed_clauses,
        role_focused_summary=role_focused_summary,
        role_focused_summary_records=role_focused_summary_records,
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
        asymmetry_signals=[],
        role_not_found=role_not_found,
        message=message,
    )

    high_risks_count = len(
        [
            risk
            for risk in risks
            if getattr(risk.severity, "value", str(risk.severity)) in {"high", "critical"}
        ]
    )

    return {
        "path": str(path),
        "relative_path": str(path.relative_to(input_dir)),
        "mime_type": request.mime_type,
        "size_bytes": path.stat().st_size,
        "status": "completed",
        "metrics": {
            "clauses_count": len(clauses),
            "risks_count": len(risks),
            "high_risks_count": high_risks_count,
            "disputed_clauses_count": len(disputed_clauses),
            "role_not_found": role_not_found,
        },
        "result": output.model_dump(mode="json"),
    }


async def run_batch(args: argparse.Namespace) -> dict[str, object]:
    input_dir = Path(args.input_dir).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()

    if not input_dir.exists() or not input_dir.is_dir():
        raise ValueError(f"Input directory does not exist or is not a directory: {input_dir}")

    services = build_services()
    files, skipped = discover_files(
        input_dir,
        output_path,
        recursive=args.recursive,
        include_unsupported=args.include_unsupported,
    )

    results: list[dict[str, object]] = [*skipped]
    for index, path in enumerate(files, start=1):
        print(f"[{index}/{len(files)}] {path}")
        try:
            result = await analyze_file(
                path,
                input_dir,
                services,
                role=args.role,
                counterparty_role=args.counterparty_role,
                language=args.language,
            )
        except Exception as exc:  # pragma: no cover - defensive CLI behavior
            result = {
                "path": str(path),
                "relative_path": str(path.relative_to(input_dir)),
                "mime_type": detect_mime_type(path),
                "size_bytes": path.stat().st_size,
                "status": "failed",
                "error": str(exc),
            }
        results.append(result)

    completed = sum(1 for item in results if item.get("status") == "completed")
    failed = sum(1 for item in results if item.get("status") == "failed")
    skipped_count = sum(1 for item in results if item.get("status") == "skipped")

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "input_dir": str(input_dir),
        "output_path": str(output_path),
        "role": args.role,
        "counterparty_role": args.counterparty_role,
        "language": args.language,
        "recursive": args.recursive,
        "files_total": len(results),
        "files_selected": len(files),
        "completed": completed,
        "failed": failed,
        "skipped": skipped_count,
        "results": results,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return report


def main() -> int:
    args = parse_args()

    try:
        report = asyncio.run(run_batch(args))
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(
        "Report written to "
        f"{report['output_path']} "
        f"(completed={report['completed']}, failed={report['failed']}, skipped={report['skipped']})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
