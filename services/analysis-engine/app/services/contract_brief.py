from __future__ import annotations

from dataclasses import dataclass

from app.config.runtime import get_runtime_config
from app.localization import normalize_analysis_language, resolve_localized_text
from app.schemas.analysis import DisputedClauseItem, SummaryRecord
from app.services.clause_segmentation import ClauseSegment
from app.services.contract_analysis import DetectedContractType
from app.services.summary_record_formatter import SummaryRecordFormatter
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

        sections = [self._ensure_complete_sentence(payload.intro)]

        if payload.role_obligations:
            sections.append(
                resolve_localized_text(self._templates.role_obligations, resolved_language).format(
                    role=role,
                    statements=self._join_statements(payload.role_obligations),
                )
            )
        elif payload.general_obligations:
            sections.append(
                resolve_localized_text(self._templates.general_obligations, resolved_language).format(
                    role=role,
                    statements=self._join_statements(payload.general_obligations),
                )
            )

        if counterparty_role and payload.counterparty_obligations:
            sections.append(
                resolve_localized_text(self._templates.counterparty_obligations, resolved_language).format(
                    counterparty_role=counterparty_role,
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
                role=role,
            )

        return " ".join(self._ensure_complete_sentence(section) for section in sections if section)

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
                    "role": role,
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
                    context={"role": role},
                )
            )
        elif payload.general_obligations:
            records.extend(
                self._build_section_records(
                    section_id="general-obligations",
                    template=self._record_templates.contract_general_obligations,
                    items=payload.general_obligations,
                    context={"role": role},
                )
            )

        if counterparty_role and payload.counterparty_obligations:
            records.extend(
                self._build_section_records(
                    section_id="counterparty-obligations",
                    template=self._record_templates.contract_counterparty_obligations,
                    items=payload.counterparty_obligations,
                    context={"counterparty_role": counterparty_role},
                )
            )

        if payload.payment_terms:
            records.extend(
                self._build_section_records(
                    section_id="payment-terms",
                    template=self._record_templates.contract_payment_terms,
                    items=payload.payment_terms,
                    context={"role": role},
                )
            )

        if payload.deadlines:
            records.extend(
                self._build_section_records(
                    section_id="deadlines",
                    template=self._record_templates.contract_deadlines,
                    items=payload.deadlines,
                    context={"role": role},
                )
            )

        if payload.penalties:
            records.extend(
                self._build_section_records(
                    section_id="penalties",
                    template=self._record_templates.contract_penalties,
                    items=payload.penalties,
                    context={"role": role},
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
                normalized_key = statement.casefold()
                if normalized_key in seen:
                    continue
                seen.add(normalized_key)
                candidates.append(self._ensure_complete_sentence(statement))

        return candidates

    def _collect_statements(
        self,
        statements: list[str],
        markers: list[str],
        actor_terms: list[str],
        max_items: int,
    ) -> list[str]:
        actor_terms_normalized = [term.casefold().strip() for term in actor_terms if term and term.strip()]
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
            role=role,
        )
        if detected_contract_type and detected_contract_type.type_id != "general_contract":
            intro += (
                f" Определен тип договора: {detected_contract_type.ru_name}"
                f" (уверенность {int(detected_contract_type.confidence * 100)}%,"
                f" правовая рамка: {detected_contract_type.legal_framework})."
            )

        return ContractBriefSectionsPayload(
            intro=self._ensure_complete_sentence(intro),
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

    @staticmethod
    def _join_statements(statements: list[str]) -> str:
        return "; ".join(normalize_contract_text(statement).rstrip(".!?") for statement in statements)

    @staticmethod
    def _ensure_complete_sentence(text: str) -> str:
        cleaned = normalize_contract_text(text)
        if cleaned and cleaned[-1] not in ".!?":
            cleaned = f"{cleaned}."
        return cleaned
