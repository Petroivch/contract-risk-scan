import time
from typing import Any

from fastapi.testclient import TestClient

from app.main import app


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
        "role_context": {"role": "executor", "counterparty_role": "employer"},
        "document_text": "Исполнитель обязан выполнить работы в срок 10 дней.",
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


def test_status_and_result_flow_returns_completed_output_with_execution_plan() -> None:
    client = TestClient(app)

    payload = {
        "document_name": "scan.pdf",
        "role_context": {"role": "buyer", "counterparty_role": "seller"},
        "document_base64": "QnV5ZXIgbXVzdCBwYXkgd2l0aGluIDEwIGRheXMuIFBlbmFsdHkgMSUu",
        "locale": "IT",
        "mime_type": "application/pdf",
    }

    run_body = _run_job(client, payload)
    assert run_body["execution_plan"]["mode"] == "server_assist"
    assert run_body["execution_plan"]["network_required"] is True

    status_body = _wait_for_terminal_status(client, run_body["job_id"])
    assert status_body["status"] == "completed"
    assert status_body["language"] == "it"
    assert status_body["locale"] == "it"
    assert status_body["execution_plan"]["mode"] == "server_assist"

    result_response = client.get(f"/analysis/{run_body['job_id']}/result")
    assert result_response.status_code == 200
    result_body = result_response.json()

    assert result_body["status"] == "completed"
    assert result_body["language"] == "it"
    assert result_body["locale"] == "it"
    assert result_body["execution_plan"]["mode"] == "server_assist"
    assert result_body["result"]["language"] == "it"
    assert result_body["result"]["locale"] == "it"
    assert result_body["result"]["execution_plan"]["mode"] == "server_assist"
    assert result_body["result"]["execution_plan"]["offline_capable"] is False
    assert result_body["result"]["contract_brief"]
    assert result_body["result"]["risks"]
    assert result_body["result"]["role_focused_summary"]["role"] == "buyer"


def test_language_fallback_to_ru_for_invalid_code() -> None:
    client = TestClient(app)

    payload = {
        "document_name": "sample-contract.txt",
        "role_context": {"role": "executor", "counterparty_role": "employer"},
        "document_text": "Исполнитель обязан выполнить работы в срок 10 дней.",
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
        "document_text": "Исполнитель обязан выполнить работы в срок 10 дней.",
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
        "document_text": "Исполнитель обязан выполнить работы в срок 10 дней.",
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
        "document_text": "Исполнитель обязан выполнить работы в срок 10 дней.",
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
