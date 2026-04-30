from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.contract_type_detector import ContractTypeDetector, DetectedContractType
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
class DetectedRole:
    role: str
    canonical_role: str
    offset_start: int
    offset_end: int


def canonicalize_role(role: str | None) -> str:
    normalized = (role or "").casefold().strip()
    if not normalized:
        return ""

    for canonical, aliases in ROLE_ALIASES.items():
        if normalized == canonical or normalized in aliases:
            return canonical

    return normalized


def role_aliases(role: str | None) -> set[str]:
    normalized = (role or "").casefold().strip()
    if not normalized:
        return set()

    aliases = {normalized}
    canonical = canonicalize_role(normalized)
    if canonical:
        aliases.add(canonical)
        aliases.update(alias.casefold() for alias in ROLE_ALIASES.get(canonical, set()))

    return aliases


def extract_roles_from_text(document_text: str) -> list[DetectedRole]:
    normalized_text = normalize_contract_text(document_text)
    lowered_text = normalized_text.casefold()
    detected_roles: list[DetectedRole] = []
    seen_offsets: set[tuple[str, int, int]] = set()

    for canonical, aliases in ROLE_ALIASES.items():
        for alias in sorted({canonical, *aliases}, key=len, reverse=True):
            lowered_alias = alias.casefold().strip()
            if not lowered_alias:
                continue

            for match in re.finditer(rf"(?<!\w){re.escape(lowered_alias)}(?!\w)", lowered_text):
                dedupe_key = (canonical, match.start(), match.end())
                if dedupe_key in seen_offsets:
                    continue
                seen_offsets.add(dedupe_key)
                detected_roles.append(
                    DetectedRole(
                        role=normalized_text[match.start() : match.end()],
                        canonical_role=canonical,
                        offset_start=match.start(),
                        offset_end=match.end(),
                    )
                )

    detected_roles.sort(key=lambda item: (item.offset_start, item.offset_end, item.canonical_role))
    return detected_roles


def find_role_matches(role: str | None, document_text: str) -> list[DetectedRole]:
    aliases = role_aliases(role)
    if not aliases:
        return []

    return [
        detected_role
        for detected_role in extract_roles_from_text(document_text)
        if detected_role.canonical_role in aliases or detected_role.role.casefold() in aliases
    ]


def is_role_present_in_text(role: str | None, document_text: str) -> bool:
    return bool(find_role_matches(role, document_text))
