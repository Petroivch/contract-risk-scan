from __future__ import annotations

from app.config.runtime import get_runtime_config
from app.localization import normalize_analysis_language, resolve_localized_text
from app.schemas.analysis import DisputedClauseItem
from app.services.clause_segmentation import ClauseSegment
from app.services.contract_analysis import DetectedContractType
from app.services.text_normalization import normalize_contract_text, split_into_sentences


class ContractBriefGenerationService:
    """Builds a readable brief with complete sentences and contract context."""

    def __init__(self) -> None:
        runtime_config = get_runtime_config()
        self._templates = runtime_config.templates.contract_brief_sections
        self._summary_config = runtime_config.summary_generation
        self._fallback_template = runtime_config.templates.contract_brief

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

        sections = []
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
        sections.append(self._ensure_complete_sentence(intro))

        if role_obligations:
            sections.append(
                resolve_localized_text(self._templates.role_obligations, resolved_language).format(
                    role=role,
                    statements=self._join_statements(role_obligations),
                )
            )
        elif general_obligations:
            sections.append(
                resolve_localized_text(self._templates.general_obligations, resolved_language).format(
                    role=role,
                    statements=self._join_statements(general_obligations),
                )
            )

        if counterparty_role and counterparty_obligations:
            sections.append(
                resolve_localized_text(self._templates.counterparty_obligations, resolved_language).format(
                    counterparty_role=counterparty_role,
                    statements=self._join_statements(counterparty_obligations),
                )
            )

        if payment_terms:
            sections.append(
                resolve_localized_text(self._templates.payment_terms, resolved_language).format(
                    statements=self._join_statements(payment_terms),
                )
            )

        if deadlines:
            sections.append(
                resolve_localized_text(self._templates.deadlines, resolved_language).format(
                    statements=self._join_statements(deadlines),
                )
            )

        if penalties:
            sections.append(
                resolve_localized_text(self._templates.penalties, resolved_language).format(
                    statements=self._join_statements(penalties),
                )
            )

        if disputed_clauses:
            sections.append(
                resolve_localized_text(self._templates.disputed_clauses, resolved_language).format(
                    count=len(disputed_clauses),
                )
            )

        if len(sections) == 1:
            sections[0] = resolve_localized_text(self._fallback_template, resolved_language).format(
                document_name=document_name,
                clauses_count=len(clauses),
                role=role,
            )

        return " ".join(self._ensure_complete_sentence(section) for section in sections if section)

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

    @staticmethod
    def _join_statements(statements: list[str]) -> str:
        return "; ".join(normalize_contract_text(statement).rstrip(".!?") for statement in statements)

    @staticmethod
    def _ensure_complete_sentence(text: str) -> str:
        cleaned = normalize_contract_text(text)
        if cleaned and cleaned[-1] not in ".!?":
            cleaned = f"{cleaned}."
        return cleaned
