import base64
import time
from typing import Any
from zipfile import ZipFile

from fastapi.testclient import TestClient

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
        f"5 0 obj\n<< /Length {len(content)} >>\nstream\n".encode("ascii") + content + b"\nendstream\nendobj\n",
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
    pdf += b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + str(xref_offset).encode("ascii") + b"\n%%EOF"

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
    assert result["risks"][0]["severity"] == "critical"
    assert any(item["severity"] == "high" for item in result["risks"])
    assert result["role_focused_summary"]["role"] == "buyer"
    assert any("Buyer must pay" in line for line in result["role_focused_summary"]["must_do"])
    assert any("deliver" in line.lower() for line in result["role_focused_summary"]["must_do"])
    assert any("pay" in line.lower() for line in result["role_focused_summary"]["payment_terms"])
    assert any("10 days" in line.lower() or "5 days" in line.lower() for line in result["role_focused_summary"]["deadlines"])
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
    assert any("termination" in item["title"].lower() for item in result["risks"])


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
    assert any("termination" in item["title"].lower() for item in result["risks"])


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
