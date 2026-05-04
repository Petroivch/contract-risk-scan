import json
import re
from pathlib import Path
from typing import Any


CYRILLIC_RE = re.compile(r"[\u0400-\u04FF]")
LOCALIZED_FIELDS = {"title", "description", "mitigation", "headline", "recommendation", "reason"}
ALLOWED_NON_RU_CYRILLIC_PATH_PARTS = {"legal_basis", "evidence", "clause_excerpt", "source_excerpt"}


def test_non_ru_localized_config_fields_do_not_leak_cyrillic() -> None:
    config_path = Path(__file__).resolve().parents[1] / "app" / "config" / "analysis_config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    failures: list[str] = []

    def walk(value: Any, path: tuple[str, ...], localized_context: bool = False) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                next_path = (*path, key)
                walk(child, next_path, localized_context or key in LOCALIZED_FIELDS)
            return

        if isinstance(value, list):
            for index, child in enumerate(value):
                walk(child, (*path, str(index)), localized_context)
            return

        if not isinstance(value, str):
            return

        if not localized_context or not path or path[-1] not in {"en", "it", "fr"}:
            return
        if any(part in ALLOWED_NON_RU_CYRILLIC_PATH_PARTS for part in path):
            return
        if CYRILLIC_RE.search(value):
            failures.append(".".join(path))

    walk(config, ())

    assert failures == []
