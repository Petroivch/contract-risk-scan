from __future__ import annotations

from dataclasses import dataclass

from app.config.models import ContractTypeConfig
from app.config.runtime import get_runtime_config
from app.services.text_normalization import normalize_contract_text


@dataclass(slots=True)
class DetectedContractType:
    type_id: str
    confidence: float
    ru_name: str
    legal_framework: str


class ContractTypeDetector:
    def __init__(self) -> None:
        runtime_config = get_runtime_config()
        self._contract_types = runtime_config.contract_types

    def detect(self, document_text: str, document_name: str) -> DetectedContractType:
        if not self._contract_types:
            return self._general_contract()

        normalized_name = normalize_contract_text(document_name)
        normalized_text = normalize_contract_text(document_text)
        combined_text = self._build_search_text(normalized_name, normalized_text)
        title_text = self._build_title_text(normalized_name, normalized_text)

        scored_types = [
            (self._calculate_type_score(contract_type, title_text, combined_text), contract_type)
            for contract_type in self._contract_types
        ]
        scored_types.sort(key=lambda item: (item[0], item[1].id), reverse=True)

        best_score, best_type = scored_types[0]
        if best_score <= 0:
            return self._general_contract()

        second_best_score = scored_types[1][0] if len(scored_types) > 1 else 0.0
        confidence = self._normalize_confidence(best_score, second_best_score)
        return DetectedContractType(
            type_id=best_type.id,
            confidence=confidence,
            ru_name=best_type.ru_name,
            legal_framework=best_type.legal_framework,
        )

    @classmethod
    def _calculate_type_score(
        cls,
        contract_type: ContractTypeConfig,
        title_text: str,
        combined_text: str,
    ) -> float:
        if contract_type.required_markers and not all(
            cls._contains(combined_text, marker) for marker in contract_type.required_markers
        ):
            return 0.0

        title_hits = cls._count_matches(combined_text=title_text, patterns=cls._title_patterns(contract_type))
        keyword_hits = cls._count_matches(combined_text=combined_text, patterns=contract_type.keywords)
        marker_hits = cls._count_matches(combined_text=combined_text, patterns=contract_type.markers)
        clause_hits = cls._count_matches(
            combined_text=combined_text,
            patterns=contract_type.characteristic_clauses,
        )
        excluded_hits = cls._count_matches(combined_text=combined_text, patterns=contract_type.excluded_markers)

        score = 0.0
        score += min(title_hits, 2) * contract_type.title_weight
        score += keyword_hits * contract_type.keyword_weight
        score += marker_hits * contract_type.marker_weight
        score += clause_hits * contract_type.characteristic_clause_weight
        score -= excluded_hits * contract_type.excluded_marker_penalty

        if score < contract_type.minimum_score:
            return 0.0
        return round(score, 3)

    @staticmethod
    def _title_patterns(contract_type: ContractTypeConfig) -> list[str]:
        patterns = [contract_type.ru_name]
        if contract_type.en_name:
            patterns.append(contract_type.en_name)
        patterns.extend(contract_type.aliases)
        patterns.extend(contract_type.title_markers)
        return patterns

    @classmethod
    def _count_matches(cls, combined_text: str, patterns: list[str]) -> int:
        return sum(1 for pattern in cls._unique_patterns(patterns) if cls._contains(combined_text, pattern))

    @staticmethod
    def _unique_patterns(patterns: list[str]) -> list[str]:
        seen: set[str] = set()
        result: list[str] = []
        for pattern in patterns:
            normalized = normalize_contract_text(pattern).casefold().strip()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            result.append(normalized)
        return result

    @staticmethod
    def _contains(combined_text: str, pattern: str) -> bool:
        normalized_pattern = normalize_contract_text(pattern).casefold().strip()
        if not normalized_pattern:
            return False
        return normalized_pattern in combined_text

    @staticmethod
    def _build_search_text(document_name: str, document_text: str) -> str:
        return "\n".join(part for part in (document_name, document_text) if part).casefold()

    @staticmethod
    def _build_title_text(document_name: str, document_text: str) -> str:
        opening_lines = [line.strip() for line in document_text.splitlines()[:4] if line.strip()]
        opening_text = " ".join(opening_lines)[:400]
        return "\n".join(part for part in (document_name, opening_text) if part).casefold()

    @staticmethod
    def _general_contract() -> DetectedContractType:
        return DetectedContractType(
            type_id="general_contract",
            confidence=0.0,
            ru_name="Договор",
            legal_framework="Общие нормы ГК РФ",
        )

    @staticmethod
    def _normalize_confidence(best_score: float, second_best_score: float) -> float:
        if best_score <= 0:
            return 0.0
        dominance = max(best_score - second_best_score, 0.0)
        confidence = min(0.99, 0.35 + best_score / 12.0 + dominance / 20.0)
        return round(confidence, 2)
