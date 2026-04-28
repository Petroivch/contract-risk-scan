from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
TOOLS_ROOT = SERVICE_ROOT / "tools"


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


corpus_run = _load_module("analysis_engine_corpus_run_tool", TOOLS_ROOT / "corpus_run.py")
evaluate = _load_module("analysis_engine_evaluate_tool", TOOLS_ROOT / "evaluate.py")


def _subset_manifest(service_root: Path, tmp_path: Path, case_ids: list[str]) -> Path:
    source_manifest = corpus_run.default_manifest_path()
    source_payload = json.loads(source_manifest.read_text(encoding="utf-8"))
    filtered_cases = [case for case in source_payload["cases"] if case["case_id"] in case_ids]

    for case in filtered_cases:
        document_path = (source_manifest.parent / case["document_path"]).resolve()
        case["document_path"] = str(document_path)

    manifest_path = tmp_path / "subset_cases.json"
    manifest_path.write_text(
        json.dumps({"version": source_payload["version"], "cases": filtered_cases}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return manifest_path


def test_run_cases_writes_result_files(tmp_path: Path) -> None:
    manifest_path = _subset_manifest(SERVICE_ROOT, tmp_path, ["agency_goods_ru", "rent_ru"])
    cases = corpus_run.load_manifest(manifest_path)
    output_dir = tmp_path / "corpus_run"

    summary = corpus_run.run_cases(cases, output_dir=output_dir, manifest_path=manifest_path)

    assert summary["total_cases"] == 2
    assert summary["completed_cases"] == 2
    assert (output_dir / "results" / "agency_goods_ru.json").exists()
    assert (output_dir / "results" / "rent_ru.json").exists()


def test_evaluate_run_passes_for_subset(tmp_path: Path) -> None:
    manifest_path = _subset_manifest(
        SERVICE_ROOT,
        tmp_path,
        ["agency_goods_ru", "autstaffing_ru", "household_contract_ru"],
    )
    cases = corpus_run.load_manifest(manifest_path)
    output_dir = tmp_path / "corpus_run"
    reports_dir = tmp_path / "reports"

    corpus_run.run_cases(cases, output_dir=output_dir, manifest_path=manifest_path)
    report = evaluate.evaluate_run(manifest_path=manifest_path, run_dir=output_dir, reports_root=reports_dir)

    assert report["missing_case_ids"] == []
    assert report["summary"]["total_cases"] == 3
    assert report["summary"]["contract_type_accuracy"] == 1.0
    assert all(case_report["contract_type_match"] for case_report in report["case_reports"])
    assert (reports_dir / "corpus_evaluation.json").exists()
    assert (reports_dir / "corpus_evaluation.md").exists()
