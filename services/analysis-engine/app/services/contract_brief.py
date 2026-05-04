from __future__ import annotations

from dataclasses import dataclass

from app.config.runtime import get_runtime_config
from app.localization import normalize_analysis_language, resolve_localized_text
from app.schemas.analysis import DisputedClauseItem, SummaryRecord
from app.services.clause_segmentation import ClauseSegment
from app.services.contract_analysis import DetectedContractType, localize_role_label, role_aliases
from app.services.summary_record_formatter import (
    SummaryRecordFormatter,
    ensure_sentence,
    sentence_to_fragment,
    smart_truncate_text,
)
from app.services.text_normalization import normalize_contract_text, split_into_sentences


@dataclass(slots=True)
class ContractBriefSectionsPayload:
    intro: str
    role_obligations: list[str]
    counterparty_obligations: list[str]
    general_obligations: list[str]
    payment_terms: list[str]
    deadlines: list[str]
    penalties: list[str]
    disputed_count: int


class ContractBriefGenerationService:
    """Builds a readable brief with complete sentences and contract context."""

    def __init__(self) -> None:
        runtime_config = get_runtime_config()
        self._templates = runtime_config.templates.contract_brief_sections
        self._summary_config = runtime_config.summary_generation
        self._fallback_template = runtime_config.templates.contract_brief
        self._record_formatter = SummaryRecordFormatter()
        self._record_templates = self._record_formatter.templates

    def generate(
        self,
        document_name: str,
        document_text: str,
        clauses: list[ClauseSegment],
        role: str,
        counterparty_role: str | None,
        language: str,
        disputed_clauses: list[DisputedClauseItem],
        detected_contract_type: DetectedContractType | None = None,
    ) -> str:
        resolved_language = normalize_analysis_language(language)
        display_role = localize_role_label(role, resolved_language) or role
        display_counterparty_role = (
            localize_role_label(counterparty_role, resolved_language) if counterparty_role else ""
        ) or (counterparty_role or "")
        payload = self._build_sections_payload(
            document_name=document_name,
            document_text=document_text,
            clauses=clauses,
            role=role,
            counterparty_role=counterparty_role,
            language=resolved_language,
            disputed_clauses=disputed_clauses,
            detected_contract_type=detected_contract_type,
        )

        sections = [ensure_sentence(payload.intro)]

        if payload.role_obligations:
            sections.append(
                resolve_localized_text(self._templates.role_obligations, resolved_language).format(
                    role=display_role,
                    statements=self._join_statements(payload.role_obligations),
                )
            )
        elif payload.general_obligations:
            sections.append(
                resolve_localized_text(self._templates.general_obligations, resolved_language).format(
                    role=display_role,
                    statements=self._join_statements(payload.general_obligations),
                )
            )

        if counterparty_role and payload.counterparty_obligations:
            sections.append(
                resolve_localized_text(self._templates.counterparty_obligations, resolved_language).format(
                    counterparty_role=display_counterparty_role,
                    statements=self._join_statements(payload.counterparty_obligations),
                )
            )

        if payload.payment_terms:
            sections.append(
                resolve_localized_text(self._templates.payment_terms, resolved_language).format(
                    statements=self._join_statements(payload.payment_terms),
                )
            )

        if payload.deadlines:
            sections.append(
                resolve_localized_text(self._templates.deadlines, resolved_language).format(
                    statements=self._join_statements(payload.deadlines),
                )
            )

        if payload.penalties:
            sections.append(
                resolve_localized_text(self._templates.penalties, resolved_language).format(
                    statements=self._join_statements(payload.penalties),
                )
            )

        if payload.disputed_count:
            sections.append(
                resolve_localized_text(self._templates.disputed_clauses, resolved_language).format(
                    count=payload.disputed_count,
                )
            )

        if len(sections) == 1:
            sections[0] = resolve_localized_text(self._fallback_template, resolved_language).format(
                document_name=document_name,
                clauses_count=len(clauses),
                role=display_role,
            )

        return " ".join(ensure_sentence(section) for section in sections if section)

    def generate_records(
        self,
        document_name: str,
        document_text: str,
        clauses: list[ClauseSegment],
        role: str,
        counterparty_role: str | None,
        language: str,
        disputed_clauses: list[DisputedClauseItem],
        detected_contract_type: DetectedContractType | None = None,
    ) -> list[SummaryRecord]:
        display_role_ru = localize_role_label(role, "ru") or role
        display_counterparty_role_ru = (
            localize_role_label(counterparty_role, "ru") if counterparty_role else ""
        ) or (counterparty_role or "")
        payload = self._build_sections_payload(
            document_name=document_name,
            document_text=document_text,
            clauses=clauses,
            role=role,
            counterparty_role=counterparty_role,
            language=language,
            disputed_clauses=disputed_clauses,
            detected_contract_type=detected_contract_type,
        )
        contract_type_name = (
            detected_contract_type.ru_name
            if detected_contract_type and detected_contract_type.type_id != "general_contract"
            else "Общий договор"
        )
        legal_framework = (
            detected_contract_type.legal_framework
            if detected_contract_type and detected_contract_type.type_id != "general_contract"
            else "Общие нормы ГК РФ"
        )

        records: list[SummaryRecord] = [
            self._record_formatter.build_record(
                record_id="contract-brief-intro",
                template=self._record_templates.contract_intro,
                context={
                    "document_name": document_name,
                    "clauses_count": len(clauses),
                    "role": display_role_ru,
                    "contract_type_name": contract_type_name,
                    "disputed_count": payload.disputed_count,
                    "legal_framework": legal_framework,
                },
                evidence=[
                    f"Тип договора: {contract_type_name}.",
                    f"Правовая рамка: {legal_framework}.",
                    f"Количество спорных пунктов: {payload.disputed_count}.",
                ],
            )
        ]

        if payload.role_obligations:
            records.extend(
                self._build_section_records(
                    section_id="role-obligations",
                    template=self._record_templates.contract_role_obligations,
                    items=payload.role_obligations,
                    context={"role": display_role_ru},
                )
            )
        elif payload.general_obligations:
            records.extend(
                self._build_section_records(
                    section_id="general-obligations",
                    template=self._record_templates.contract_general_obligations,
                    items=payload.general_obligations,
                    context={"role": display_role_ru},
                )
            )

        if counterparty_role and payload.counterparty_obligations:
            records.extend(
                self._build_section_records(
                    section_id="counterparty-obligations",
                    template=self._record_templates.contract_counterparty_obligations,
                    items=payload.counterparty_obligations,
                    context={"counterparty_role": display_counterparty_role_ru},
                )
            )

        if payload.payment_terms:
            records.extend(
                self._build_section_records(
                    section_id="payment-terms",
                    template=self._record_templates.contract_payment_terms,
                    items=payload.payment_terms,
                    context={"role": display_role_ru},
                )
            )

        if payload.deadlines:
            records.extend(
                self._build_section_records(
                    section_id="deadlines",
                    template=self._record_templates.contract_deadlines,
                    items=payload.deadlines,
                    context={"role": display_role_ru},
                )
            )

        if payload.penalties:
            records.extend(
                self._build_section_records(
                    section_id="penalties",
                    template=self._record_templates.contract_penalties,
                    items=payload.penalties,
                    context={"role": display_role_ru},
                )
            )

        if payload.disputed_count:
            records.append(
                self._record_formatter.build_record(
                    record_id="contract-brief-disputed-clauses",
                    template=self._record_templates.contract_disputed_clauses,
                    context={"disputed_count": payload.disputed_count},
                    evidence=[clause.clause_excerpt for clause in disputed_clauses[:2]],
                )
            )

        return records

    def _candidate_statements(self, document_text: str, clauses: list[ClauseSegment]) -> list[str]:
        raw_segments = [document_text, *(clause.text for clause in clauses)]
        candidates: list[str] = []
        seen: set[str] = set()

        for raw_segment in raw_segments:
            for statement in split_into_sentences(raw_segment):
                normalized_statement = self._prepare_statement(statement)
                if not normalized_statement:
                    continue
                normalized_key = normalized_statement.casefold()
                if normalized_key in seen:
                    continue
                seen.add(normalized_key)
                candidates.append(normalized_statement)

        return candidates

    def _collect_statements(
        self,
        statements: list[str],
        markers: list[str],
        actor_terms: list[str],
        max_items: int,
    ) -> list[str]:
        actor_terms_normalized = self._expand_actor_terms(actor_terms)
        markers_normalized = [marker.casefold() for marker in markers]

        prioritized = self._filter_statements(
            statements,
            markers_normalized,
            actor_terms_normalized,
            require_actor=True,
            max_items=max_items,
        )
        if len(prioritized) >= max_items or actor_terms_normalized:
            return prioritized

        return self._filter_statements(
            statements,
            markers_normalized,
            actor_terms_normalized,
            require_actor=False,
            max_items=max_items,
        )

    def _filter_statements(
        self,
        statements: list[str],
        markers: list[str],
        actor_terms: list[str],
        require_actor: bool,
        max_items: int,
    ) -> list[str]:
        results: list[str] = []

        for statement in statements:
            normalized = statement.casefold()
            if not any(marker in normalized for marker in markers):
                continue

            has_actor = any(term in normalized for term in actor_terms) if actor_terms else False
            if require_actor and not has_actor:
                continue
            if not require_actor and actor_terms and has_actor:
                continue

            results.append(statement)
            if len(results) >= max_items:
                break

        return results

    def _build_sections_payload(
        self,
        *,
        document_name: str,
        document_text: str,
        clauses: list[ClauseSegment],
        role: str,
        counterparty_role: str | None,
        language: str,
        disputed_clauses: list[DisputedClauseItem],
        detected_contract_type: DetectedContractType | None,
    ) -> ContractBriefSectionsPayload:
        resolved_language = normalize_analysis_language(language)
        display_role = localize_role_label(role, resolved_language) or role
        statements = self._candidate_statements(document_text, clauses)
        max_items = min(3, self._summary_config.max_items_per_section)

        role_obligations = self._collect_statements(
            statements,
            self._summary_config.markers["must_do"],
            actor_terms=[role],
            max_items=max_items,
        )
        counterparty_obligations = self._collect_statements(
            statements,
            self._summary_config.markers["must_do"],
            actor_terms=[counterparty_role] if counterparty_role else [],
            max_items=max_items,
        )
        general_obligations = self._collect_statements(
            statements,
            self._summary_config.markers["must_do"],
            actor_terms=[],
            max_items=max_items,
        )
        payment_terms = self._collect_statements(
            statements,
            self._summary_config.markers["payment_terms"],
            actor_terms=[],
            max_items=max_items,
        )
        deadlines = self._collect_statements(
            statements,
            self._summary_config.markers["deadlines"],
            actor_terms=[],
            max_items=max_items,
        )
        penalties = self._collect_statements(
            statements,
            self._summary_config.markers["penalties"],
            actor_terms=[],
            max_items=max_items,
        )

        intro = resolve_localized_text(self._templates.intro, resolved_language).format(
            document_name=document_name,
            clauses_count=len(clauses),
            role=display_role,
        )
        if detected_contract_type and detected_contract_type.type_id != "general_contract":
            intro = f"{intro} {self._localized_contract_type_context(resolved_language, detected_contract_type)}"

        return ContractBriefSectionsPayload(
            intro=ensure_sentence(intro),
            role_obligations=role_obligations,
            counterparty_obligations=counterparty_obligations,
            general_obligations=general_obligations,
            payment_terms=payment_terms,
            deadlines=deadlines,
            penalties=penalties,
            disputed_count=len(disputed_clauses),
        )

    def _build_section_records(
        self,
        *,
        section_id: str,
        template: object,
        items: list[str],
        context: dict[str, str],
    ) -> list[SummaryRecord]:
        total = len(items)
        return [
            self._record_formatter.build_record(
                record_id=f"contract-brief-{section_id}-{index}",
                template=template,
                context={**context, "item_number": index, "items_count": total},
                evidence=[item],
            )
            for index, item in enumerate(items, start=1)
        ]

    def _prepare_statement(self, statement: str) -> str:
        cleaned = normalize_contract_text(statement)
        if not cleaned:
            return ""
        return smart_truncate_text(cleaned, max_chars=self._summary_config.max_line_length)

    @staticmethod
    def _expand_actor_terms(actor_terms: list[str]) -> list[str]:
        expanded_terms: set[str] = set()

        for actor_term in actor_terms:
            if not actor_term or not actor_term.strip():
                continue

            expanded_terms.add(actor_term.casefold().strip())
            expanded_terms.update(alias.casefold() for alias in role_aliases(actor_term))

        return sorted(expanded_terms, key=len, reverse=True)

    @staticmethod
    def _ensure_complete_sentence(text: str) -> str:
        return ensure_sentence(text)

    @staticmethod
    def _localized_contract_type_context(language: str, detected_contract_type: DetectedContractType) -> str:
        templates = {
            "ru": "Определен тип договора: {contract_type} (уверенность {confidence}%, правовая рамка: {legal_framework}).",
            "en": "Detected contract type: {contract_type} (confidence {confidence}%, legal framework: {legal_framework}).",
            "it": "Tipo di contratto rilevato: {contract_type} (affidabilita {confidence}%, quadro giuridico: {legal_framework}).",
            "fr": "Type de contrat detecte : {contract_type} (confiance {confidence}%, cadre juridique : {legal_framework}).",
        }
        template = templates.get(language, templates["ru"])
        return template.format(
            contract_type=detected_contract_type.ru_name,
            confidence=int(detected_contract_type.confidence * 100),
            legal_framework=detected_contract_type.legal_framework,
        )

    @staticmethod
    def _join_statements(statements: list[str]) -> str:
        fragments = [sentence_to_fragment(statement) for statement in statements]
        return "; ".join(fragment for fragment in fragments if fragment)
