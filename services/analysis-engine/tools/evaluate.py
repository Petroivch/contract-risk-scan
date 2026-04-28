from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

TOOLS_ROOT = Path(__file__).resolve().parent
SERVICE_ROOT = TOOLS_ROOT.parent

if str(TOOLS_ROOT) not in sys.path:
    sys.path.insert(0, str(TOOLS_ROOT))

from corpus_run import default_artifacts_root, default_manifest_path, load_manifest, resolve_path  # noqa: E402


def default_reports_root() -> Path:
    return SERVICE_ROOT / "reports"


def latest_run_dir(artifacts_root: Path) -> Path:
    candidates = [path for path in artifacts_root.iterdir() if path.is_dir()]
    if not candidates:
        raise FileNotFoundError(f"No run directories found in {artifacts_root}")
    if (artifacts_root / "results").exists():
        return artifacts_root
    return max(candidates, key=lambda path: path.stat().st_mtime)


def load_result_files(results_root: Path) -> dict[str, dict[str, Any]]:
    run_dir = latest_run_dir(results_root) if not (results_root / "results").exists() else results_root
    results_dir = run_dir / "results"
    results: dict[str, dict[str, Any]] = {}
    for path in sorted(results_dir.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        case_id = payload.get("case_id") or path.stem
        results[case_id] = payload
    return results


def resolve_expected_high_risk_ids(case: Any) -> list[str]:
    expected = case.expected or {}
    ids = expected.get("expected_high_risk_ids")
    if ids is None:
        ids = expected.get("high_risk_ids")
    return sorted({risk_id for risk_id in (ids or []) if risk_id})


def resolve_found_high_risk_ids(record: dict[str, Any]) -> list[str]:
    analysis = record.get("analysis") or record.get("result") or {}
    risks = analysis.get("risks", [])
    found = {
        risk.get("rule_id") or risk.get("risk_id")
        for risk in risks
        if risk.get("severity") in {"high", "critical"}
    }
    return sorted(risk_id for risk_id in found if risk_id)


def evaluate_case(case: Any, record: dict[str, Any]) -> dict[str, Any]:
    expected = set(resolve_expected_high_risk_ids(case))
    found = set(resolve_found_high_risk_ids(record))
    tp = sorted(expected & found)
    fp = sorted(found - expected)
    fn = sorted(expected - found)
    precision = round(len(tp) / len(found), 4) if found else 0.0
    recall = round(len(tp) / len(expected), 4) if expected else 0.0

    analysis = record.get("analysis") or record.get("result") or {}
    contract_type = analysis.get("contract_type") or {}
    extraction = record.get("ingestion_preflight") or {}
    expected_contract_type = (case.expected or {}).get("expected_contract_type") or (case.expected or {}).get("contract_type")
    contract_type_match = (
        True if expected_contract_type is None else contract_type.get("type_id") == expected_contract_type
    )
    return {
        "case_id": case.case_id,
        "relative_path": getattr(case, "relative_path", case.document_path.name),
        "role": case.role,
        "counterparty_role": case.counterparty_role,
        "status": record.get("status"),
        "extractor": extraction.get("extractor") or extraction.get("extraction_source"),
        "extraction_ok": extraction.get("extraction_ok"),
        "expected_contract_type": expected_contract_type,
        "actual_contract_type": contract_type.get("type_id"),
        "contract_type_match": contract_type_match,
        "expected_high_risk_ids": sorted(expected),
        "found_high_risk_ids": sorted(found),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "precision": precision,
        "recall": recall,
    }


def aggregate_case_reports(case_reports: list[dict[str, Any]]) -> dict[str, Any]:
    tp_total = sum(len(case_report["tp"]) for case_report in case_reports)
    fp_total = sum(len(case_report["fp"]) for case_report in case_reports)
    fn_total = sum(len(case_report["fn"]) for case_report in case_reports)
    expected_total = sum(len(case_report["expected_high_risk_ids"]) for case_report in case_reports)
    found_total = sum(len(case_report["found_high_risk_ids"]) for case_report in case_reports)
    precision = round(tp_total / (tp_total + fp_total), 4) if (tp_total + fp_total) else 0.0
    recall = round(tp_total / (tp_total + fn_total), 4) if (tp_total + fn_total) else 0.0
    contract_type_accuracy = round(
        sum(1 for case_report in case_reports if case_report["contract_type_match"]) / len(case_reports),
        4,
    ) if case_reports else 0.0
    extractor_counts = Counter(case_report.get("extractor") or "unknown" for case_report in case_reports)
    fp_counts = Counter(risk_id for case_report in case_reports for risk_id in case_report["fp"])
    fn_counts = Counter(risk_id for case_report in case_reports for risk_id in case_report["fn"])
    return {
        "total_cases": len(case_reports),
        "expected_high_risks": expected_total,
        "found_high_risks": found_total,
        "tp": tp_total,
        "fp": fp_total,
        "fn": fn_total,
        "precision": precision,
        "recall": recall,
        "contract_type_accuracy": contract_type_accuracy,
        "extractor_counts": dict(extractor_counts),
        "top_false_positives": dict(fp_counts.most_common(15)),
        "top_false_negatives": dict(fn_counts.most_common(15)),
    }


def render_markdown_report(report: dict[str, Any]) -> str:
    summary = report["summary"]
    lines = [
        "# Corpus Evaluation",
        "",
        f"- Generated at: `{report['generated_at']}`",
        f"- Golden set: `{report['golden_path']}`",
        f"- Results dir: `{report['results_dir']}`",
        f"- Cases: `{summary['total_cases']}`",
        f"- HIGH risk precision: `{summary['precision']:.2%}`",
        f"- HIGH risk recall: `{summary['recall']:.2%}`",
        f"- Contract type accuracy: `{summary['contract_type_accuracy']:.2%}`",
        "",
        "## Extractors",
        "",
    ]
    for extractor, count in summary["extractor_counts"].items():
        lines.append(f"- `{extractor}`: `{count}`")

    if summary["top_false_positives"]:
        lines.extend(["", "## Top False Positives", ""])
        for risk_id, count in summary["top_false_positives"].items():
            lines.append(f"- `{risk_id}`: `{count}`")

    if summary["top_false_negatives"]:
        lines.extend(["", "## Top False Negatives", ""])
        for risk_id, count in summary["top_false_negatives"].items():
            lines.append(f"- `{risk_id}`: `{count}`")

    failing_cases = [case_report for case_report in report["case_reports"] if case_report["fp"] or case_report["fn"]]
    if failing_cases:
        lines.extend(["", "## Case Detail", ""])
        for case_report in failing_cases[:25]:
            lines.append(
                f"- `{case_report['case_id']}` precision=`{case_report['precision']:.2f}` "
                f"recall=`{case_report['recall']:.2f}` "
                f"fp={case_report['fp']} fn={case_report['fn']}"
            )

    return "\n".join(lines) + "\n"


def evaluate_run(
    manifest_path: Path,
    run_dir: Path,
    reports_root: Path,
) -> dict[str, Any]:
    cases = load_manifest(manifest_path)
    results_by_case_id = load_result_files(run_dir)
    case_reports: list[dict[str, Any]] = []
    missing_case_ids: list[str] = []

    for case in cases:
        record = results_by_case_id.get(case.case_id)
        if record is None:
            missing_case_ids.append(case.case_id)
            case_reports.append(
                {
                    "case_id": case.case_id,
                    "relative_path": case.relative_path,
                    "role": case.role,
                    "counterparty_role": case.counterparty_role,
                    "status": "missing",
                    "extractor": None,
                    "extraction_ok": False,
                    "expected_contract_type": (case.expected or {}).get("contract_type"),
                    "actual_contract_type": None,
                    "contract_type_match": False,
                    "expected_high_risk_ids": resolve_expected_high_risk_ids(case),
                    "found_high_risk_ids": [],
                    "tp": [],
                    "fp": [],
                    "fn": resolve_expected_high_risk_ids(case),
                    "precision": 0.0,
                    "recall": 0.0,
                }
            )
            continue
        case_reports.append(evaluate_case(case, record))

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "golden_path": str(manifest_path),
        "results_dir": str(run_dir),
        "missing_case_ids": missing_case_ids,
        "summary": aggregate_case_reports(case_reports),
        "case_reports": case_reports,
    }
    reports_root.mkdir(parents=True, exist_ok=True)
    report_json_path = reports_root / "corpus_evaluation.json"
    report_md_path = reports_root / "corpus_evaluation.md"
    report_json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report_md_path.write_text(render_markdown_report(report), encoding="utf-8")
    return report


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate corpus-run results against a golden set.")
    parser.add_argument("--golden", default=str(default_manifest_path()), help="Golden set JSON manifest or directory.")
    parser.add_argument("--results", default=str(default_artifacts_root()), help="Corpus results directory.")
    parser.add_argument(
        "--out",
        default=str(default_reports_root() / "corpus_evaluation.json"),
        help="Output JSON path; Markdown will be written alongside it with the same basename.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    golden_input = resolve_path(args.golden, base_dir=Path.cwd())
    if golden_input.is_dir():
        manifest_path = golden_input / "cases.json"
    else:
        manifest_path = golden_input

    out_json = (Path.cwd() / args.out).resolve() if not Path(args.out).is_absolute() else Path(args.out).resolve()
    reports_root = out_json.parent
    report = evaluate_run(
        manifest_path=manifest_path,
        run_dir=resolve_path(args.results, base_dir=Path.cwd()),
        reports_root=reports_root,
    )
    if out_json.name != "corpus_evaluation.json":
        out_json.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        out_json.with_suffix(".md").write_text(render_markdown_report(report), encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
