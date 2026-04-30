from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

from tests.golden_set import GOLDEN_CASES

SERVICE_ROOT = Path(__file__).resolve().parents[1]
TOOLS_ROOT = SERVICE_ROOT / "tools"
GOLDEN_CASES_BY_ID = {case.case_id: case for case in GOLDEN_CASES}


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


corpus_run = _load_module("analysis_engine_corpus_run_tool", TOOLS_ROOT / "corpus_run.py")
evaluate = _load_module("analysis_engine_evaluate_tool", TOOLS_ROOT / "evaluate.py")


def _manifest_case(case_id: str, docs_dir: Path) -> dict[str, object]:
    case = GOLDEN_CASES_BY_ID[case_id]
    document_path = docs_dir / case.document_name
    document_path.write_text(case.document_text, encoding="utf-8")
    return {
        "case_id": case.case_id,
        "document_path": str(document_path),
        "document_name": case.document_name,
        "role": case.role,
        "counterparty_role": case.counterparty_role,
        "language": case.language,
        "mime_type": "text/plain",
        "expected": {
            "contract_type": case.expected_contract_type,
            "expected_high_risk_ids": list(case.expected_risk_ids),
        },
    }


def _build_manifest(tmp_path: Path, case_ids: list[str]) -> Path:
    docs_dir = tmp_path / "documents"
    docs_dir.mkdir(parents=True, exist_ok=True)
    manifest_payload = {
        "version": "smoke",
        "cases": [_manifest_case(case_id, docs_dir) for case_id in case_ids],
    }
    manifest_path = tmp_path / "cases.json"
    manifest_path.write_text(
        json.dumps(manifest_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return manifest_path


def test_run_cases_writes_result_files_for_compact_manifest(tmp_path: Path) -> None:
    manifest_path = _build_manifest(tmp_path, ["service_agreement_ru", "supply_agreement_ru"])
    cases = corpus_run.load_manifest(manifest_path)
    output_dir = tmp_path / "corpus_run"

    summary = corpus_run.run_cases(cases, output_dir=output_dir, manifest_path=manifest_path)

    assert summary["total_cases"] == 2
    assert summary["completed_cases"] == 2
    assert (output_dir / "results" / "service_agreement_ru.json").exists()
    assert (output_dir / "results" / "supply_agreement_ru.json").exists()


def test_evaluate_run_passes_for_compact_manifest(tmp_path: Path) -> None:
    manifest_path = _build_manifest(tmp_path, ["service_agreement_ru", "supply_agreement_ru"])
    cases = corpus_run.load_manifest(manifest_path)
    output_dir = tmp_path / "corpus_run"
    reports_dir = tmp_path / "reports"

    corpus_run.run_cases(cases, output_dir=output_dir, manifest_path=manifest_path)
    report = evaluate.evaluate_run(manifest_path=manifest_path, run_dir=output_dir, reports_root=reports_dir)

    assert report["missing_case_ids"] == []
    assert report["summary"]["total_cases"] == 2
    assert report["summary"]["contract_type_accuracy"] == 1.0
    assert report["summary"]["precision"] >= 0.75
    assert report["summary"]["recall"] >= 0.8
    assert all(case_report["contract_type_match"] for case_report in report["case_reports"])
    assert (reports_dir / "corpus_evaluation.json").exists()
    assert (reports_dir / "corpus_evaluation.md").exists()
