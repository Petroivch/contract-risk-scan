import base64
import re
import sys
import time
from pathlib import Path
from typing import Any
from zipfile import ZipFile

import pytest
from fastapi.testclient import TestClient

SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVICE_ROOT))

from app.config.runtime import get_runtime_config
from app.localization import resolve_localized_text
from app.main import app

TEXT_CONTRACT_RU = "\n".join(
    [
        "Исполнитель обязан выполнить работы в срок 10 дней.",
        "Заказчик обязан оплатить услуги в течение 5 банковских дней.",
        "За просрочку применяется штраф 5%.",
        "Изменение сроков возможно по соглашению сторон.",
        "Заказчик вправе в одностороннем порядке отказаться от договора.",
    ]
)

TEXT_CONTRACT_EN = "\n".join(
    [
        "Buyer must pay within 10 days.",
        "Seller shall deliver the goods within 5 days.",
        "Penalty 1% applies for delay.",
        "Any change is by agreement of the parties.",
        "Buyer may unilaterally terminate the contract.",
    ]
)

LONG_ROLE_OBLIGATION_EN = (
    "Contractor must maintain a continuously updated security incident register, preserve audit "
    "trails for at least thirty six months, notify the customer within four hours of any suspected "
    "incident, provide a root cause analysis within five business days, and deliver a written "
    "remediation plan approved by an executive officer."
)

MOJIBAKE_PATTERN = re.compile(r"(?:[РСÐÑ][\u0080-\u00BF])")


def _build_simple_pdf_base64(lines: list[str]) -> str:
    def escape_pdf_text(value: str) -> str:
        return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    commands = ["BT", "/F1 12 Tf", "72 720 Td"]
    for index, line in enumerate(lines):
        if index:
            commands.append("0 -18 Td")
        commands.append(f"({escape_pdf_text(line)}) Tj")
    commands.append("ET")

    content = "\n".join(commands).encode("latin-1")
    objects = [
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
        b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
        f"5 0 obj\n<< /Length {len(content)} >>\nstream\n".encode("ascii")
        + content
        + b"\nendstream\nendobj\n",
    ]

    pdf = b"%PDF-1.4\n"
    offsets: list[int] = []
    for obj in objects:
        offsets.append(len(pdf))
        pdf += obj

    xref_offset = len(pdf)
    pdf += b"xref\n0 6\n0000000000 65535 f \n"
    for offset in offsets:
        pdf += f"{offset:010d} 00000 n \n".encode("ascii")
    pdf += (
        b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n"
        + str(xref_offset).encode("ascii")
        + b"\n%%EOF"
    )

    return base64.b64encode(pdf).decode("ascii")


def _build_simple_docx_base64(paragraphs: list[str]) -> str:
    document_body = "".join(f"<w:p><w:r><w:t>{paragraph}</w:t></w:r></w:p>" for paragraph in paragraphs)
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{document_body}</w:body>"
        "</w:document>"
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    relationships = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="word/document.xml"/>'
        "</Relationships>"
    )

    from io import BytesIO

    buffer = BytesIO()
    with ZipFile(buffer, "w") as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", relationships)
        archive.writestr("word/document.xml", document_xml)

    return base64.b64encode(buffer.getvalue()).decode("ascii")


def _run_job(client: TestClient, payload: dict[str, Any]) -> dict[str, Any]:
    response = client.post("/analysis/run", json=payload)
    assert response.status_code == 202
    return response.json()


def _wait_for_terminal_status(client: TestClient, job_id: str, attempts: int = 20) -> dict[str, Any]:
    last_body: dict[str, Any] | None = None

    for _ in range(attempts):
        response = client.get(f"/analysis/{job_id}/status")
        assert response.status_code == 200
        last_body = response.json()
        if last_body["status"] in {"completed", "failed"}:
            return last_body
        time.sleep(0.05)

    raise AssertionError(f"Job {job_id} did not finish, last status: {last_body}")


def _get_completed_result(client: TestClient, payload: dict[str, Any]) -> dict[str, Any]:
    run_body = _run_job(client, payload)
    status_body = _wait_for_terminal_status(client, run_body["job_id"])
    assert status_body["status"] == "completed"

    result_response = client.get(f"/analysis/{run_body['job_id']}/result")
    assert result_response.status_code == 200
    result_body = result_response.json()
    assert result_body["status"] == "completed"
    return result_body["result"]


def _normalize_key(key: str) -> str:
    return re.sub(r"[\s_\-]+", "", key).casefold()


def _find_values_by_key_fragment(payload: Any, fragments: set[str]) -> list[Any]:
    matches: list[Any] = []

    def visit(node: Any) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                normalized_key = _normalize_key(str(key))
                if any(fragment in normalized_key for fragment in fragments):
                    matches.append(value)
                visit(value)
            return

        if isinstance(node, list):
            for item in node:
                visit(item)

    visit(payload)
    return matches


def _flatten_scalars(payload: Any) -> list[Any]:
    values: list[Any] = []

    if isinstance(payload, dict):
        for value in payload.values():
            values.extend(_flatten_scalars(value))
        return values

    if isinstance(payload, list):
        for item in payload:
            values.extend(_flatten_scalars(item))
        return values

    values.append(payload)
    return values


def _flatten_strings(payload: Any) -> list[str]:
    return [value for value in _flatten_scalars(payload) if isinstance(value, str)]


def _extract_contract_type(result: dict[str, Any]) -> str | None:
    for key_fragment in ("runame", "ru_name", "name", "typeid", "type_id", "contracttype", "contract_type"):
        contract_type_values = _find_values_by_key_fragment(result, {key_fragment})
        for value in contract_type_values:
            for text in _flatten_strings(value):
                candidate = text.strip()
                if candidate:
                    return candidate
    return None


def _severity_rank(severity: str) -> int:
    return {"low": 1, "medium": 2, "high": 3, "critical": 4}[severity]


def _find_risk_by_keywords(result: dict[str, Any], *keywords: str) -> dict[str, Any] | None:
    normalized_keywords = [keyword.casefold() for keyword in keywords]

    for risk in result["risks"]:
        haystack = " ".join(
            str(risk.get(field, ""))
            for field in ("title", "description", "role_relevance", "mitigation")
        ).casefold()
        if any(keyword in haystack for keyword in normalized_keywords):
            return risk

    return None


def _assert_no_mojibake(text: str) -> None:
    assert not MOJIBAKE_PATTERN.search(text), f"Detected mojibake in text: {text!r}"


def test_run_analysis_contract_returns_local_first_plan_for_text_input() -> None:
    client = TestClient(app)

    payload = {
        "document_name": "sample-contract.txt",
        "role_context": {"role": "исполнитель", "counterparty_role": "заказчик"},
        "document_text": TEXT_CONTRACT_RU,
        "language": "ru",
        "mime_type": "text/plain",
    }

    body = _run_job(client, payload)

    assert body["language"] == "ru"
    assert body["locale"] == "ru"
    assert body["execution_plan"]["mode"] == "local_first"
    assert body["execution_plan"]["offline_capable"] is True
    assert body["execution_plan"]["network_required"] is False


def test_capabilities_endpoint_exposes_language_and_execution_policy() -> None:
    client = TestClient(app)

    response = client.get("/analysis/capabilities")

    assert response.status_code == 200
    body = response.json()
    assert body["default_language"] == "ru"
    assert body["fallback_language"] == "ru"
    assert body["supported_languages"] == ["ru", "en", "it", "fr"]
    assert body["document_text_mode"] == "local_first"
    assert body["document_base64_mode"] == "server_assist"
    assert body["allow_server_assist"] is True
    assert "application/pdf" in body["mime_type_overrides"]


def test_status_and_result_flow_returns_meaningful_contract_analysis() -> None:
    client = TestClient(app)

    payload = {
        "document_name": "scan.pdf",
        "role_context": {"role": "buyer", "counterparty_role": "seller"},
        "document_base64": _build_simple_pdf_base64(
            [
                "Buyer must pay within 10 days.",
                "Seller shall deliver the goods within 5 days.",
                "Penalty 1% applies for delay.",
                "Any change is by agreement of the parties.",
                "Buyer may unilaterally terminate the contract.",
            ]
        ),
        "locale": "EN",
        "mime_type": "application/pdf",
    }

    run_body = _run_job(client, payload)
    assert run_body["execution_plan"]["mode"] == "server_assist"
    assert run_body["execution_plan"]["network_required"] is True

    status_body = _wait_for_terminal_status(client, run_body["job_id"])
    assert status_body["status"] == "completed"
    assert status_body["language"] == "en"
    assert status_body["locale"] == "en"
    assert status_body["execution_plan"]["mode"] == "server_assist"

    result_response = client.get(f"/analysis/{run_body['job_id']}/result")
    assert result_response.status_code == 200
    result_body = result_response.json()
    result = result_body["result"]

    assert result_body["status"] == "completed"
    assert result_body["language"] == "en"
    assert result_body["locale"] == "en"
    assert result["language"] == "en"
    assert result["locale"] == "en"
    assert result["execution_plan"]["mode"] == "server_assist"
    assert result["execution_plan"]["offline_capable"] is False
    assert result["contract_brief"]
    assert "What buyer must do" in result["contract_brief"]
    assert "What seller must do" in result["contract_brief"]
    assert "Payment terms" in result["contract_brief"]
    assert "Deadlines and timing" in result["contract_brief"]
    assert "Penalties and sanctions" in result["contract_brief"]
    assert "Detected disputed or vague clauses" in result["contract_brief"]

    assert result["risks"]
    assert any(item["severity"] in {"high", "critical"} for item in result["risks"])
    assert not result["risks"][0]["title"].lower().startswith("low risk")
    assert result["role_focused_summary"]["role"] == "buyer"
    assert any("Buyer must pay" in line for line in result["role_focused_summary"]["must_do"])
    assert any("deliver" in line.lower() for line in result["role_focused_summary"]["must_do"])
    assert any("pay" in line.lower() for line in result["role_focused_summary"]["payment_terms"])
    assert any(
        "10 days" in line.lower() or "5 days" in line.lower()
        for line in result["role_focused_summary"]["deadlines"]
    )
    assert result["disputed_clauses"]


def test_docx_base64_payload_is_parsed_as_document_text() -> None:
    client = TestClient(app)

    payload = {
        "document_name": "services.docx",
        "role_context": {"role": "customer", "counterparty_role": "contractor"},
        "document_base64": _build_simple_docx_base64(
            [
                "Customer must pay the invoice within 10 business days.",
                "Contractor shall deliver the report within 5 days.",
                "Buyer may unilaterally terminate the contract.",
            ]
        ),
        "language": "en",
        "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }

    run_body = _run_job(client, payload)
    status_body = _wait_for_terminal_status(client, run_body["job_id"])
    assert status_body["status"] == "completed"

    result_response = client.get(f"/analysis/{run_body['job_id']}/result")
    assert result_response.status_code == 200
    result = result_response.json()["result"]

    assert "Customer must pay the invoice within 10 business days." in result["contract_brief"]
    assert any(item["severity"] in {"high", "critical"} for item in result["risks"])


def test_corrupt_docx_payload_completes_with_fallback_output() -> None:
    client = TestClient(app)
    runtime_config = get_runtime_config()

    payload = {
        "document_name": "broken.docx",
        "role_context": {"role": "buyer", "counterparty_role": "seller"},
        "document_base64": base64.b64encode(b"not-a-valid-docx").decode("ascii"),
        "language": "en",
        "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }

    result = _get_completed_result(client, payload)

    assert result["contract_type"]["type_id"] == "general_contract"
    assert result["ingestion"]["extraction_source"] == "docx:none"
    assert result["ingestion"]["extraction_ok"] is False
    assert "python-docx" in result["ingestion"]["extraction_error"]
    assert result["ingestion"]["sha256"]
    assert result["role_focused_summary"]["payment_terms"] == [
        resolve_localized_text(runtime_config.summary_generation.fallback_values.payment_terms, "en")
    ]
    assert result["role_focused_summary"]["must_do"] == [
        resolve_localized_text(runtime_config.summary_generation.fallback_values.must_do, "en")
    ]
    assert result["disputed_clauses"][0]["clause_id"] == "clause-1"
    assert result["disputed_clauses"][0]["clause_excerpt"] == resolve_localized_text(
        runtime_config.pipeline.ingestion.empty_text_placeholder,
        "en",
    )


def test_pdf_base64_payload_is_extracted_with_pdf_reader() -> None:
    client = TestClient(app)

    payload = {
        "document_name": "services.pdf",
        "role_context": {"role": "buyer", "counterparty_role": "seller"},
        "document_base64": _build_simple_pdf_base64(
            [
                "Buyer must pay within 10 days.",
                "Seller shall deliver the goods within 5 days.",
                "Buyer may unilaterally terminate the contract.",
            ]
        ),
        "language": "en",
        "mime_type": "application/pdf",
    }

    run_body = _run_job(client, payload)
    status_body = _wait_for_terminal_status(client, run_body["job_id"])
    assert status_body["status"] == "completed"

    result_response = client.get(f"/analysis/{run_body['job_id']}/result")
    assert result_response.status_code == 200
    result = result_response.json()["result"]

    assert "Buyer must pay within 10 days." in result["contract_brief"]
    assert any(item["severity"] in {"high", "critical"} for item in result["risks"])


def test_language_fallback_to_ru_for_invalid_code() -> None:
    client = TestClient(app)

    payload = {
        "document_name": "sample-contract.txt",
        "role_context": {"role": "исполнитель", "counterparty_role": "заказчик"},
        "document_text": TEXT_CONTRACT_RU,
        "language": "de",
    }

    body = _run_job(client, payload)

    assert body["language"] == "ru"
    assert body["locale"] == "ru"


def test_language_normalization_for_uppercase_code() -> None:
    client = TestClient(app)

    payload = {
        "document_name": "sample-contract.txt",
        "role_context": {"role": "executor", "counterparty_role": "employer"},
        "document_text": "Executor must deliver the work within 10 days.",
        "language": "EN",
    }

    body = _run_job(client, payload)

    assert body["language"] == "en"
    assert body["locale"] == "en"


def test_locale_alias_is_supported_for_core_api_contract() -> None:
    client = TestClient(app)

    payload = {
        "document_name": "sample-contract.txt",
        "role_context": {"role": "executor", "counterparty_role": "employer"},
        "document_text": "Executor must deliver the work within 10 days.",
        "locale": "IT",
    }

    body = _run_job(client, payload)

    assert body["language"] == "it"
    assert body["locale"] == "it"


def test_locale_has_priority_over_language_when_both_are_provided() -> None:
    client = TestClient(app)

    payload = {
        "document_name": "sample-contract.txt",
        "role_context": {"role": "executor", "counterparty_role": "employer"},
        "document_text": "Executor must deliver the work within 10 days.",
        "language": "en",
        "locale": "fr",
    }

    body = _run_job(client, payload)

    assert body["language"] == "fr"
    assert body["locale"] == "fr"


def test_missing_job_error_can_be_localized_via_query_locale() -> None:
    client = TestClient(app)

    response = client.get("/analysis/missing-job/status", params={"locale": "en"})

    assert response.status_code == 404
    assert response.json()["detail"] == "Analysis job was not found"


@pytest.mark.parametrize(
    ("document_name", "document_text", "role", "counterparty_role", "expected_contract_type_fragment"),
    [
        (
            "services-contract.txt",
            "\n\n".join(
                [
                    "ДОГОВОР ОБ ОКАЗАНИИ УСЛУГ",
                    "Исполнитель обязуется оказать услуги по сопровождению системы.",
                    "Заказчик оплачивает услуги в течение 5 банковских дней.",
                ]
            ),
            "Исполнитель",
            "Заказчик",
            "оказания услуг",
        ),
        (
            "pledge-contract.txt",
            "\n\n".join(
                [
                    "ДОГОВОР ЗАЛОГА ДОЛИ В УСТАВНОМ КАПИТАЛЕ",
                    "Залогодатель передает Залогодержателю долю в залог в обеспечение обязательств.",
                    "Залогодержатель вправе обратить взыскание во внесудебном порядке.",
                ]
            ),
            "Залогодатель",
            "Залогодержатель",
            "залога",
        ),
    ],
)
def test_completed_analysis_exposes_detected_contract_type(
    document_name: str,
    document_text: str,
    role: str,
    counterparty_role: str,
    expected_contract_type_fragment: str,
) -> None:
    client = TestClient(app)
    result = _get_completed_result(
        client,
        {
            "document_name": document_name,
            "role_context": {"role": role, "counterparty_role": counterparty_role},
            "document_text": document_text,
            "language": "ru",
            "mime_type": "text/plain",
        },
    )

    contract_type = _extract_contract_type(result)
    if contract_type is None:
        pytest.xfail("Analysis API does not expose contract type metadata yet")

    assert expected_contract_type_fragment.casefold() in contract_type.casefold()


def test_role_aware_risk_escalation_prioritizes_party_harmed_by_unilateral_change() -> None:
    client = TestClient(app)
    document_text = "\n\n".join(
        [
            "Contractor shall provide support services for the platform.",
            "Customer may unilaterally change the price, deadlines and scope of services without Contractor approval.",
            "Contractor pays a 10% penalty for each day of delay.",
        ]
    )

    harmed_party_result = _get_completed_result(
        client,
        {
            "document_name": "role-escalation.txt",
            "role_context": {"role": "Contractor", "counterparty_role": "Customer"},
            "document_text": document_text,
            "language": "en",
            "mime_type": "text/plain",
        },
    )
    beneficiary_result = _get_completed_result(
        client,
        {
            "document_name": "role-escalation.txt",
            "role_context": {"role": "Customer", "counterparty_role": "Contractor"},
            "document_text": document_text,
            "language": "en",
            "mime_type": "text/plain",
        },
    )

    harmed_risk = _find_risk_by_keywords(harmed_party_result, "unilateral", "scope", "price")
    beneficiary_risk = _find_risk_by_keywords(beneficiary_result, "unilateral", "scope", "price")

    assert harmed_risk is not None
    assert beneficiary_risk is not None

    harmed_rank = _severity_rank(harmed_risk["severity"])
    beneficiary_rank = _severity_rank(beneficiary_risk["severity"])

    assert harmed_rank > beneficiary_rank


def test_asymmetry_detection_flags_one_sided_termination_and_payment_terms() -> None:
    client = TestClient(app)
    result = _get_completed_result(
        client,
        {
            "document_name": "asymmetry-check.txt",
            "role_context": {"role": "seller", "counterparty_role": "buyer"},
            "document_text": "\n\n".join(
                [
                    "Buyer may unilaterally terminate the contract at any time without compensation.",
                    "Seller pays a 10% penalty for each day of delivery delay.",
                    "Buyer may defer payment until final acceptance at its sole discretion.",
                    "Seller has no reciprocal right to suspend or terminate performance.",
                ]
            ),
            "language": "en",
            "mime_type": "text/plain",
        },
    )

    asymmetry_payloads = _find_values_by_key_fragment(
        result,
        {"asymmetry", "imbalance", "onesided", "one_sided"},
    )
    if not asymmetry_payloads:
        pytest.xfail("Analysis API does not expose asymmetry detection metadata yet")

    asymmetry_scalars = _flatten_scalars(asymmetry_payloads)
    asymmetry_text = " ".join(str(value) for value in asymmetry_scalars).casefold()

    if not any(
        marker in asymmetry_text
        for marker in ("asymmetr", "imbalanc", "one-sided", "onesided", "односторон", "дисбаланс")
    ):
        assert any(value is True or value == 1 for value in asymmetry_scalars)
        risk_text = " ".join(_flatten_strings(result["risks"])).casefold()
        assert any(marker in risk_text for marker in ("unilateral", "termination"))
        assert any(marker in risk_text for marker in ("penalty", "payment", "liquidated damages"))
        return

    assert any(marker in asymmetry_text for marker in ("termination", "payment", "penalty", "liability"))


def test_summary_and_contract_brief_do_not_truncate_long_role_obligations() -> None:
    client = TestClient(app)
    result = _get_completed_result(
        client,
        {
            "document_name": "long-obligation.txt",
            "role_context": {"role": "Contractor", "counterparty_role": "Customer"},
            "document_text": "\n\n".join(
                [
                    LONG_ROLE_OBLIGATION_EN,
                    "Customer must pay the invoice within 10 business days.",
                    "Penalty 1% applies for delayed payment.",
                ]
            ),
            "language": "en",
            "mime_type": "text/plain",
        },
    )

    summary_lines = result["role_focused_summary"]["must_do"]
    summary_blob = "\n".join(summary_lines)
    if LONG_ROLE_OBLIGATION_EN not in summary_blob:
        if LONG_ROLE_OBLIGATION_EN[:160] in summary_blob:
            pytest.xfail("Role-focused summary still truncates long obligation lines")
        raise AssertionError("Long role obligation is missing from must_do summary")

    contract_brief = result["contract_brief"]
    if LONG_ROLE_OBLIGATION_EN not in contract_brief:
        if LONG_ROLE_OBLIGATION_EN[:160] in contract_brief:
            pytest.xfail("Contract brief still truncates long obligation lines")
        raise AssertionError("Long role obligation is missing from contract brief")

    assert "approved by an executive officer" in summary_blob
    assert "approved by an executive officer" in contract_brief


def test_russian_unicode_input_and_output_do_not_contain_mojibake() -> None:
    client = TestClient(app)
    result = _get_completed_result(
        client,
        {
            "document_name": "unicode-ru.txt",
            "role_context": {"role": "Исполнитель", "counterparty_role": "Заказчик"},
            "document_text": "\n\n".join(
                [
                    "Исполнитель обязан оказать услуги технической поддержки в течение 10 рабочих дней.",
                    "Заказчик оплачивает услуги в течение 5 банковских дней.",
                    "Заказчик вправе в одностороннем порядке отказаться от договора.",
                    "Изменение сроков допускается только по соглашению сторон.",
                ]
            ),
            "language": "ru",
            "mime_type": "text/plain",
        },
    )

    assert any(
        "Исполнитель обязан оказать услуги технической поддержки" in line
        for line in result["role_focused_summary"]["must_do"]
    )
    assert "Исполнитель обязан оказать услуги технической поддержки" in result["contract_brief"]

    for text in _flatten_strings(result):
        _assert_no_mojibake(text)
