from __future__ import annotations

from dataclasses import dataclass

from app.config.runtime import get_runtime_config
from app.services.text_normalization import normalize_contract_text


ROLE_ALIASES: dict[str, set[str]] = {
    "executor": {
        "исполнитель",
        "подрядчик",
        "поставщик",
        "агент",
        "комиссионер",
        "поверенный",
        "лицензиар",
        "правообладатель",
        "seller",
        "vendor",
        "contractor",
        "executor",
        "agent",
        "commissioner",
        "licensor",
    },
    "client": {
        "заказчик",
        "покупатель",
        "комитент",
        "принципал",
        "лицензиат",
        "customer",
        "buyer",
        "client",
        "principal",
        "licensee",
    },
    "worker": {"работник", "сотрудник", "гражданин", "employee", "worker"},
    "employer": {"работодатель", "компания", "organization", "employer"},
    "tenant": {"арендатор", "tenant", "lessee"},
    "landlord": {"арендодатель", "landlord", "lessor"},
    "borrower": {"заемщик", "должник", "borrower"},
    "lender": {"займодавец", "кредитор", "lender"},
}


@dataclass(slots=True)
class DetectedContractType:
    type_id: str
    confidence: float
    ru_name: str
    legal_framework: str


class ContractTypeDetector:
    def __init__(self) -> None:
        self._runtime_config = get_runtime_config()
        self._contract_types = self._runtime_config.contract_types

    def detect(self, document_text: str, document_name: str) -> DetectedContractType:
        combined = f"{document_name}\n{normalize_contract_text(document_text)}".casefold()

        if not self._contract_types:
            return DetectedContractType(
                type_id="general_contract",
                confidence=0.0,
                ru_name="Договор",
                legal_framework="Общие нормы ГК РФ",
            )

        scored_types: list[tuple[float, object]] = []
        for contract_type in self._contract_types:
            score = self._calculate_type_score(contract_type, combined)
            scored_types.append((score, contract_type))

        scored_types.sort(key=lambda item: item[0], reverse=True)
        best_score, best_type = scored_types[0]
        if best_score <= 0:
            return DetectedContractType(
                type_id="general_contract",
                confidence=0.0,
                ru_name="Договор",
                legal_framework="Общие нормы ГК РФ",
            )
        second_best_score = scored_types[1][0] if len(scored_types) > 1 else 0.0
        confidence = self._normalize_confidence(best_score, second_best_score)

        return DetectedContractType(
            type_id=best_type.id,
            confidence=confidence,
            ru_name=best_type.ru_name,
            legal_framework=best_type.legal_framework,
        )

    @staticmethod
    def _calculate_type_score(contract_type: object, text: str) -> float:
        keyword_matches = sum(1 for keyword in contract_type.keywords if keyword.casefold() in text)
        marker_matches = sum(1 for marker in contract_type.markers if marker.casefold() in text)
        clause_matches = sum(
            1 for clause_marker in contract_type.characteristic_clauses if clause_marker.casefold() in text
        )
        exact_title_bonus = 3.0 if contract_type.ru_name.casefold() in text else 0.0
        return keyword_matches * 1.0 + marker_matches * 2.0 + clause_matches * 1.5 + exact_title_bonus

    @staticmethod
    def _normalize_confidence(best_score: float, second_best_score: float) -> float:
        if best_score <= 0:
            return 0.0
        dominance = max(best_score - second_best_score, 0.0)
        confidence = min(0.99, 0.35 + best_score / 12.0 + dominance / 20.0)
        return round(confidence, 2)


def canonicalize_role(role: str | None) -> str:
    normalized = (role or "").casefold().strip()
    if not normalized:
        return ""

    for canonical, aliases in ROLE_ALIASES.items():
        if normalized == canonical or normalized in aliases:
            return canonical

    return normalized
