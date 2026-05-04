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
        "продавец",
        "агент",
        "комиссионер",
        "поверенный",
        "лицензиар",
        "правообладатель",
        "seller",
        "supplier",
        "vendor",
        "contractor",
        "executor",
        "agent",
        "commissioner",
        "licensor",
        "appaltatore",
        "fornitore",
        "venditore",
        "prestataire",
        "vendeur",
        "fournisseur",
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
        "cliente",
        "acquirente",
        "acheteur",
        "mandante",
        "mandant",
        "licenziatario",
        "licencie",
    },
    "worker": {"работник", "сотрудник", "гражданин", "employee", "worker", "dipendente", "lavoratore", "employe"},
    "employer": {"работодатель", "компания", "organization", "employer", "azienda", "societe", "employeur"},
    "tenant": {"арендатор", "tenant", "lessee", "conduttore", "locataire"},
    "landlord": {"арендодатель", "landlord", "lessor", "locatore", "bailleur"},
    "borrower": {"заемщик", "должник", "borrower", "mutuatario", "emprunteur"},
    "lender": {"займодавец", "кредитор", "lender", "creditore", "creancier"},
}

ROLE_LABELS_BY_VARIANT: dict[str, dict[str, str]] = {
    "исполнитель": {"ru": "исполнитель", "en": "contractor", "it": "appaltatore", "fr": "prestataire"},
    "подрядчик": {"ru": "подрядчик", "en": "contractor", "it": "appaltatore", "fr": "prestataire"},
    "seller": {"ru": "продавец", "en": "seller", "it": "venditore", "fr": "vendeur"},
    "vendor": {"ru": "поставщик", "en": "vendor", "it": "fornitore", "fr": "fournisseur"},
    "contractor": {"ru": "исполнитель", "en": "contractor", "it": "appaltatore", "fr": "prestataire"},
    "executor": {"ru": "исполнитель", "en": "executor", "it": "esecutore", "fr": "executant"},
    "agent": {"ru": "агент", "en": "agent", "it": "agente", "fr": "agent"},
    "licensor": {"ru": "лицензиар", "en": "licensor", "it": "licenziante", "fr": "concédant"},
    "заказчик": {"ru": "заказчик", "en": "customer", "it": "cliente", "fr": "client"},
    "покупатель": {"ru": "покупатель", "en": "buyer", "it": "acquirente", "fr": "acheteur"},
    "customer": {"ru": "заказчик", "en": "customer", "it": "cliente", "fr": "client"},
    "buyer": {"ru": "покупатель", "en": "buyer", "it": "acquirente", "fr": "acheteur"},
    "client": {"ru": "заказчик", "en": "client", "it": "cliente", "fr": "client"},
    "principal": {"ru": "принципал", "en": "principal", "it": "mandante", "fr": "mandant"},
    "licensee": {"ru": "лицензиат", "en": "licensee", "it": "licenziatario", "fr": "licencie"},
    "работник": {"ru": "работник", "en": "worker", "it": "lavoratore", "fr": "salarie"},
    "сотрудник": {"ru": "сотрудник", "en": "employee", "it": "dipendente", "fr": "employe"},
    "гражданин": {"ru": "гражданин", "en": "citizen", "it": "cittadino", "fr": "citoyen"},
    "работодатель": {"ru": "работодатель", "en": "employer", "it": "datore di lavoro", "fr": "employeur"},
    "компания": {"ru": "компания", "en": "company", "it": "azienda", "fr": "societe"},
    "organization": {"ru": "организация", "en": "organization", "it": "organizzazione", "fr": "organisation"},
    "арендатор": {"ru": "арендатор", "en": "tenant", "it": "conduttore", "fr": "locataire"},
    "арендодатель": {"ru": "арендодатель", "en": "landlord", "it": "locatore", "fr": "bailleur"},
    "tenant": {"ru": "арендатор", "en": "tenant", "it": "conduttore", "fr": "locataire"},
    "landlord": {"ru": "арендодатель", "en": "landlord", "it": "locatore", "fr": "bailleur"},
    "заемщик": {"ru": "заемщик", "en": "borrower", "it": "mutuatario", "fr": "emprunteur"},
    "займодавец": {"ru": "займодавец", "en": "lender", "it": "finanziatore", "fr": "preteur"},
    "borrower": {"ru": "заемщик", "en": "borrower", "it": "mutuatario", "fr": "emprunteur"},
    "lender": {"ru": "займодавец", "en": "lender", "it": "finanziatore", "fr": "preteur"},
}

ROLE_LABELS_BY_CANONICAL: dict[str, dict[str, str]] = {
    "executor": {"ru": "исполнитель", "en": "contractor", "it": "appaltatore", "fr": "prestataire"},
    "client": {"ru": "заказчик", "en": "customer", "it": "cliente", "fr": "client"},
    "worker": {"ru": "работник", "en": "worker", "it": "lavoratore", "fr": "salarie"},
    "employer": {"ru": "работодатель", "en": "employer", "it": "datore di lavoro", "fr": "employeur"},
    "tenant": {"ru": "арендатор", "en": "tenant", "it": "conduttore", "fr": "locataire"},
    "landlord": {"ru": "арендодатель", "en": "landlord", "it": "locatore", "fr": "bailleur"},
    "borrower": {"ru": "заемщик", "en": "borrower", "it": "mutuatario", "fr": "emprunteur"},
    "lender": {"ru": "займодавец", "en": "lender", "it": "finanziatore", "fr": "preteur"},
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


def localize_role_label(role: str | None, language: str) -> str:
    cleaned = normalize_contract_text(role or "").strip()
    normalized = cleaned.casefold()
    if not normalized:
        return ""

    resolved_language = language.strip().lower() if isinstance(language, str) else "ru"
    if resolved_language not in {"ru", "en", "it", "fr"}:
        resolved_language = "ru"

    labels = ROLE_LABELS_BY_VARIANT.get(normalized)
    if labels:
        return labels.get(resolved_language, labels.get("en", cleaned))

    labels = ROLE_LABELS_BY_CANONICAL.get(canonicalize_role(normalized))
    if labels:
        return labels.get(resolved_language, labels.get("en", cleaned))

    return cleaned


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
