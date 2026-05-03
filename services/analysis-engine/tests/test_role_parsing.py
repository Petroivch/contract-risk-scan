from app.services.contract_analysis import extract_roles_from_text, find_role_matches


def test_extract_roles_from_text_returns_roles_with_offsets() -> None:
    document_text = "\n".join(
        [
            "Исполнитель обязуется выполнить работы в течение 10 дней.",
            "Заказчик оплачивает услуги в течение 5 банковских дней.",
        ]
    )

    detected_roles = extract_roles_from_text(document_text)

    assert detected_roles
    assert [role.canonical_role for role in detected_roles[:2]] == ["executor", "client"]
    assert detected_roles[0].role == "Исполнитель"
    assert detected_roles[0].offset_start == 0
    assert detected_roles[0].offset_end > detected_roles[0].offset_start
    assert document_text[detected_roles[1].offset_start : detected_roles[1].offset_end] == "Заказчик"


def test_find_role_matches_supports_alias_lookup() -> None:
    document_text = "Подрядчик выполняет работы, а Заказчик принимает результат."

    matches = find_role_matches("Исполнитель", document_text)

    assert len(matches) == 1
    assert matches[0].canonical_role == "executor"
    assert matches[0].role == "Подрядчик"
