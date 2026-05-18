from __future__ import annotations

from app.config.runtime import get_runtime_config
from app.localization import normalize_analysis_language, resolve_localized_text
from app.dto.analysis import RiskItem, RiskSeverity, RoleFocusedSummary, SummaryRecord
from app.services.clause_segmentation import ClauseSegment
from app.services.contract_analysis import localize_role_label, role_aliases
from app.services.summary_record_formatter import SummaryRecordFormatter, ensure_sentence, smart_truncate_text
from app.services.text_normalization import normalize_contract_text, split_into_sentences


class SummaryGenerationService:
    """Role-aware summary generation with sentence-safe output."""

    def __init__(self) -> None:
        self._config = get_runtime_config().summary_generation
        self._record_formatter = SummaryRecordFormatter()
        self._record_templates = self._record_formatter.templates

    def generate(
        self,
        document_text: str,
        clauses: list[ClauseSegment],
        risks: list[RiskItem],
        role: str,
        counterparty_role: str | None,
        language: str,
    ) -> RoleFocusedSummary:
        resolved_language = normalize_analysis_language(language)
        display_role = localize_role_label(role, resolved_language) or role
        candidates = self._candidate_lines(document_text, clauses)
        role_terms = self._expand_role_terms(role)
        counterparty_terms = self._expand_role_terms(counterparty_role)
        max_items = self._config.max_items_per_section

        must_do = self._collect_lines(
            candidates,
            self._config.markers["must_do"],
            prioritized_terms=role_terms,
            max_items=max_items,
        )
        should_review = self._collect_lines(
            candidates,
            self._config.markers["should_review"],
            prioritized_terms=[*role_terms, *counterparty_terms],
            max_items=max_items,
        )
        payment_terms = self._collect_lines(
            candidates,
            self._config.markers["payment_terms"],
            prioritized_terms=[*role_terms, *counterparty_terms],
            max_items=max_items,
        )
        deadlines = self._collect_lines(
            candidates,
            self._config.markers["deadlines"],
            prioritized_terms=[*role_terms, *counterparty_terms],
            max_items=max_items,
        )
        penalties = self._collect_lines(
            candidates,
            self._config.markers["penalties"],
            prioritized_terms=[*role_terms, *counterparty_terms],
            max_items=max_items,
        )

        overview = self._build_overview(
            clauses_count=len(clauses),
            risks=risks,
            role=display_role,
            language=resolved_language,
            must_do=must_do,
            should_review=should_review,
            payment_terms=payment_terms,
            deadlines=deadlines,
            penalties=penalties,
        )

        fallback_values = self._config.fallback_values

        return RoleFocusedSummary(
            role=display_role,
            overview=overview,
            must_do=must_do or [resolve_localized_text(fallback_values.must_do, resolved_language)],
            should_review=should_review
            or [resolve_localized_text(fallback_values.should_review, resolved_language)],
            payment_terms=payment_terms
            or [resolve_localized_text(fallback_values.payment_terms, resolved_language)],
            deadlines=deadlines or [resolve_localized_text(fallback_values.deadlines, resolved_language)],
            penalties=penalties or [resolve_localized_text(fallback_values.penalties, resolved_language)],
        )

    def generate_records(
        self,
        summary: RoleFocusedSummary,
        clauses_count: int,
        risks: list[RiskItem],
    ) -> list[SummaryRecord]:
        high_risks_count = len(
            [risk for risk in risks if risk.severity.value in {RiskSeverity.HIGH.value, RiskSeverity.CRITICAL.value}]
        )
        records: list[SummaryRecord] = [
            self._record_formatter.build_record(
                record_id="role-summary-overview",
                template=self._record_templates.role_overview,
                context={
                    "role": localize_role_label(summary.role, "ru") or summary.role,
                    "clauses_count": clauses_count,
                    "risks_count": len(risks),
                    "high_risks_count": high_risks_count,
                },
                evidence=self._summary_evidence(summary),
            )
        ]
        records.extend(
            self._build_section_records(
                section_id="must-do",
                template=self._record_templates.must_do,
                items=summary.must_do,
                role=localize_role_label(summary.role, "ru") or summary.role,
            )
        )
        records.extend(
            self._build_section_records(
                section_id="should-review",
                template=self._record_templates.should_review,
                items=summary.should_review,
                role=localize_role_label(summary.role, "ru") or summary.role,
            )
        )
        records.extend(
            self._build_section_records(
                section_id="payment-terms",
                template=self._record_templates.payment_terms,
                items=summary.payment_terms,
                role=localize_role_label(summary.role, "ru") or summary.role,
            )
        )
        records.extend(
            self._build_section_records(
                section_id="deadlines",
                template=self._record_templates.deadlines,
                items=summary.deadlines,
                role=localize_role_label(summary.role, "ru") or summary.role,
            )
        )
        records.extend(
            self._build_section_records(
                section_id="penalties",
                template=self._record_templates.penalties,
                items=summary.penalties,
                role=localize_role_label(summary.role, "ru") or summary.role,
            )
        )
        return records

    def _candidate_lines(self, text: str, clauses: list[ClauseSegment]) -> list[str]:
        candidates: list[str] = []
        seen: set[str] = set()

        for raw_block in [text, *(clause.text for clause in clauses)]:
            for sentence in split_into_sentences(raw_block):
                normalized_line = self._prepare_line(sentence)
                if not normalized_line:
                    continue

                normalized_key = normalized_line.casefold()
                if normalized_key in seen:
                    continue

                seen.add(normalized_key)
                candidates.append(normalized_line)

        return candidates

    def _collect_lines(
        self,
        candidates: list[str],
        markers: list[str],
        prioritized_terms: list[str],
        max_items: int,
    ) -> list[str]:
        lines: list[str] = []
        markers_normalized = [marker.casefold() for marker in markers]
        prioritized_terms_normalized = [term.casefold().strip() for term in prioritized_terms if term.strip()]

        def append_matching_lines(require_priority_match: bool) -> None:
            for line in candidates:
                if len(lines) >= max_items:
                    return

                normalized = line.casefold()
                if not any(marker in normalized for marker in markers_normalized):
                    continue

                has_priority_term = any(term in normalized for term in prioritized_terms_normalized)
                if require_priority_match and prioritized_terms_normalized and not has_priority_term:
                    continue
                if not require_priority_match and prioritized_terms_normalized and has_priority_term:
                    continue

                if line not in lines:
                    lines.append(line)

        append_matching_lines(require_priority_match=True)
        if len(lines) < max_items:
            append_matching_lines(require_priority_match=False)

        return lines

    def _build_overview(
        self,
        *,
        clauses_count: int,
        risks: list[RiskItem],
        role: str,
        language: str,
        must_do: list[str],
        should_review: list[str],
        payment_terms: list[str],
        deadlines: list[str],
        penalties: list[str],
    ) -> str:
        base_overview = resolve_localized_text(self._config.overview_templates, language).format(
            clauses_count=clauses_count,
            risks_count=len(risks),
            role=role,
        )
        recommendation = self._build_evidence_driven_recommendation(
            risks=risks,
            role=role,
            language=language,
            must_do=must_do,
            should_review=should_review,
            payment_terms=payment_terms,
            deadlines=deadlines,
            penalties=penalties,
        )
        return " ".join(part for part in [ensure_sentence(base_overview), recommendation] if part)

    def _build_actionable_recommendation(
        self,
        *,
        risks: list[RiskItem],
        language: str,
        must_do: list[str],
        should_review: list[str],
        payment_terms: list[str],
        deadlines: list[str],
        penalties: list[str],
    ) -> str:
        high_risks = [risk for risk in risks if risk.severity.value in {"high", "critical"}]

        if high_risks and payment_terms and deadlines and penalties:
            return self._localized_recommendation(
                "high_risk_payment_deadlines_penalties",
                language,
            )
        if high_risks and payment_terms and penalties:
            return self._localized_recommendation(
                "high_risk_payment_penalties",
                language,
            )
        if high_risks and deadlines and penalties:
            return self._localized_recommendation(
                "high_risk_deadlines_penalties",
                language,
            )
        if high_risks and penalties:
            return self._localized_recommendation(
                "high_risk_penalties",
                language,
            )
        if high_risks and payment_terms and deadlines:
            return self._localized_recommendation(
                "high_risk_payment_deadlines",
                language,
            )
        if high_risks and payment_terms:
            return self._localized_recommendation(
                "high_risk_payment",
                language,
            )
        if high_risks and deadlines:
            return self._localized_recommendation(
                "high_risk_deadlines",
                language,
            )
        if high_risks:
            return self._localized_recommendation(
                "high_risk_generic",
                language,
            )
        if should_review:
            return self._localized_recommendation(
                "should_review",
                language,
            )
        if payment_terms and deadlines and penalties:
            return self._localized_recommendation(
                "payment_deadlines_penalties",
                language,
            )
        if payment_terms and penalties:
            return self._localized_recommendation(
                "payment_penalties",
                language,
            )
        if deadlines and penalties:
            return self._localized_recommendation(
                "deadlines_penalties",
                language,
            )
        if payment_terms and deadlines:
            return self._localized_recommendation(
                "payment_deadlines",
                language,
            )
        if payment_terms:
            return self._localized_recommendation(
                "payment_only",
                language,
            )
        if deadlines:
            return self._localized_recommendation(
                "deadlines_only",
                language,
            )
        if penalties:
            return self._localized_recommendation(
                "penalties_only",
                language,
            )
        if must_do:
            return self._localized_recommendation(
                "must_do_only",
                language,
            )
        return self._localized_recommendation(
            "generic",
            language,
        )

    @staticmethod
    def _localized_recommendation(key: str, language: str) -> str:
        recommendations = {
            "high_risk_payment_deadlines_penalties": {
                "ru": "Проверьте вручную пункты с высоким риском. Подтвердите событие оплаты, ключевые сроки и предел санкций до подписания.",
                "en": "Review the high-risk clauses manually. Confirm the payment trigger, key deadlines, and penalty cap before signing.",
                "it": "Rivedi manualmente le clausole ad alto rischio. Conferma l'evento di pagamento, le scadenze chiave e il tetto delle penali prima della firma.",
                "fr": "Examinez manuellement les clauses a haut risque. Confirmez le declencheur du paiement, les echeances cles et le plafond des penalites avant signature.",
            },
            "high_risk_payment_penalties": {
                "ru": "Проверьте вручную пункты с высоким риском. Подтвердите сумму, событие оплаты и предел санкций до подписания.",
                "en": "Review the high-risk clauses manually. Confirm the payment amount, trigger, and penalty cap before signing.",
                "it": "Rivedi manualmente le clausole ad alto rischio. Conferma l'importo del pagamento, il relativo trigger e il tetto delle penali prima della firma.",
                "fr": "Examinez manuellement les clauses a haut risque. Confirmez le montant du paiement, son declencheur et le plafond des penalites avant signature.",
            },
            "high_risk_deadlines_penalties": {
                "ru": "Проверьте вручную пункты с высоким риском. Подтвердите дедлайны, основания санкций и лимит ответственности до подписания.",
                "en": "Review the high-risk clauses manually. Confirm the deadlines, penalty triggers, and liability cap before signing.",
                "it": "Rivedi manualmente le clausole ad alto rischio. Conferma le scadenze, i trigger delle penali e il limite di responsabilita prima della firma.",
                "fr": "Examinez manuellement les clauses a haut risque. Confirmez les echeances, les declencheurs des penalites et le plafond de responsabilite avant signature.",
            },
            "high_risk_penalties": {
                "ru": "Проверьте вручную пункты с высоким риском. Подтвердите основание санкции, размер взыскания и общий лимит ответственности до подписания.",
                "en": "Review the high-risk clauses manually. Confirm the penalty trigger, amount, and overall liability cap before signing.",
                "it": "Rivedi manualmente le clausole ad alto rischio. Conferma il trigger della penale, il relativo importo e il limite complessivo di responsabilita prima della firma.",
                "fr": "Examinez manuellement les clauses a haut risque. Confirmez le declencheur de la penalite, son montant et le plafond global de responsabilite avant signature.",
            },
            "high_risk_payment_deadlines": {
                "ru": "Проверьте вручную пункты с высоким риском. Подтвердите событие оплаты и зафиксируйте ключевые сроки до подписания.",
                "en": "Review the high-risk clauses manually. Confirm the payment trigger and lock the key deadlines before signing.",
                "it": "Rivedi manualmente le clausole ad alto rischio. Conferma il trigger del pagamento e fissa le scadenze chiave prima della firma.",
                "fr": "Examinez manuellement les clauses a haut risque. Confirmez le declencheur du paiement et verrouillez les echeances cles avant signature.",
            },
            "high_risk_payment": {
                "ru": "Проверьте вручную пункты с высоким риском. Подтвердите сумму, событие оплаты и дату перечисления до подписания.",
                "en": "Review the high-risk clauses manually. Confirm the payment amount, trigger, and transfer date before signing.",
                "it": "Rivedi manualmente le clausole ad alto rischio. Conferma importo, trigger e data del pagamento prima della firma.",
                "fr": "Examinez manuellement les clauses a haut risque. Confirmez le montant, le declencheur et la date du paiement avant signature.",
            },
            "high_risk_deadlines": {
                "ru": "Проверьте вручную пункты с высоким риском. Подтвердите дату запуска срока и конечный дедлайн до подписания.",
                "en": "Review the high-risk clauses manually. Confirm the trigger date and the final deadline before signing.",
                "it": "Rivedi manualmente le clausole ad alto rischio. Conferma la data di decorrenza e la scadenza finale prima della firma.",
                "fr": "Examinez manuellement les clauses a haut risque. Confirmez la date de depart et l'echeance finale avant signature.",
            },
            "high_risk_generic": {
                "ru": "Проверьте вручную пункты с высоким риском. Уточните ключевые обязательства и спорные полномочия сторон до подписания.",
                "en": "Review the high-risk clauses manually. Clarify the key obligations and any discretionary powers before signing.",
                "it": "Rivedi manualmente le clausole ad alto rischio. Chiarisci gli obblighi chiave e gli eventuali poteri discrezionali prima della firma.",
                "fr": "Examinez manuellement les clauses a haut risque. Clarifiez les obligations cles et les pouvoirs discretionnaires avant signature.",
            },
            "should_review": {
                "ru": "Проверьте дискреционные формулировки, замените их измеримыми критериями и согласуйте понятный порядок одобрения.",
                "en": "Review the discretionary wording, replace it with measurable criteria, and agree a clear approval flow.",
                "it": "Rivedi il testo discrezionale, sostituiscilo con criteri misurabili e concorda un flusso di approvazione chiaro.",
                "fr": "Examinez le libelle discretionnaire, remplacez-le par des criteres mesurables et convenez d'un circuit d'approbation clair.",
            },
            "payment_deadlines_penalties": {
                "ru": "Подтвердите событие оплаты, ключевые сроки и предел санкций до подписания.",
                "en": "Confirm the payment trigger, key deadlines, and penalty cap before signing.",
                "it": "Conferma il trigger del pagamento, le scadenze chiave e il tetto delle penali prima della firma.",
                "fr": "Confirmez le declencheur du paiement, les echeances cles et le plafond des penalites avant signature.",
            },
            "payment_penalties": {
                "ru": "Подтвердите сумму платежа, основание санкции и предел ответственности до подписания.",
                "en": "Confirm the payment amount, penalty trigger, and liability cap before signing.",
                "it": "Conferma l'importo del pagamento, il trigger della penale e il limite di responsabilita prima della firma.",
                "fr": "Confirmez le montant du paiement, le declencheur de la penalite et le plafond de responsabilite avant signature.",
            },
            "deadlines_penalties": {
                "ru": "Подтвердите сроки, основания начисления санкций и предел ответственности до подписания.",
                "en": "Confirm the deadlines, penalty triggers, and liability cap before signing.",
                "it": "Conferma le scadenze, i trigger delle penali e il limite di responsabilita prima della firma.",
                "fr": "Confirmez les echeances, les declencheurs des penalites et le plafond de responsabilite avant signature.",
            },
            "payment_deadlines": {
                "ru": "Подтвердите событие оплаты, ответственного за исполнение и ключевые сроки до подписания.",
                "en": "Confirm the payment trigger, the responsible owner, and the key deadlines before signing.",
                "it": "Conferma il trigger del pagamento, il responsabile operativo e le scadenze chiave prima della firma.",
                "fr": "Confirmez le declencheur du paiement, le responsable d'execution et les echeances cles avant signature.",
            },
            "payment_only": {
                "ru": "Подтвердите сумму, основание платежа и дату перечисления до подписания.",
                "en": "Confirm the payment amount, basis, and transfer date before signing.",
                "it": "Conferma importo, base di pagamento e data di trasferimento prima della firma.",
                "fr": "Confirmez le montant, la base du paiement et la date de virement avant signature.",
            },
            "deadlines_only": {
                "ru": "Подтвердите дату начала срока, конечный дедлайн и ответственного за исполнение.",
                "en": "Confirm when each deadline starts, when it ends, and who is responsible for delivery.",
                "it": "Conferma quando decorre ogni scadenza, quando termina e chi e responsabile della consegna.",
                "fr": "Confirmez le point de depart de chaque echeance, sa date de fin et le responsable de la livraison.",
            },
            "penalties_only": {
                "ru": "Подтвердите основание санкции, размер взыскания и предел ответственности.",
                "en": "Confirm the penalty trigger, amount, and liability cap before signing.",
                "it": "Conferma il trigger della penale, il relativo importo e il limite di responsabilita prima della firma.",
                "fr": "Confirmez le declencheur de la penalite, son montant et le plafond de responsabilite avant signature.",
            },
            "must_do_only": {
                "ru": "Назначьте ответственного по каждому обязательству и зафиксируйте способ подтверждения исполнения.",
                "en": "Assign an owner to each obligation and document how performance will be confirmed.",
                "it": "Assegna un responsabile a ogni obbligo e documenta come verra confermato l'adempimento.",
                "fr": "Attribuez un responsable a chaque obligation et documentez la preuve d'execution attendue.",
            },
            "generic": {
                "ru": "Проверьте вручную ключевые обязательства, логику расчетов и условия ответственности до подписания.",
                "en": "Validate the main obligations, payment logic, and liability terms manually before signing.",
                "it": "Verifica manualmente gli obblighi principali, la logica dei pagamenti e i termini di responsabilita prima della firma.",
                "fr": "Verifiez manuellement les obligations principales, la logique de paiement et les clauses de responsabilite avant signature.",
            },
        }
        template = recommendations[key].get(language, recommendations[key]["ru"])
        return ensure_sentence(template)

    def _build_evidence_driven_recommendation(
        self,
        *,
        risks: list[RiskItem],
        role: str,
        language: str,
        must_do: list[str],
        should_review: list[str],
        payment_terms: list[str],
        deadlines: list[str],
        penalties: list[str],
    ) -> str:
        dominant_risk = self._pick_dominant_risk(risks)
        supporting_line = next(
            (
                item
                for item in [*must_do, *should_review, *payment_terms, *deadlines, *penalties]
                if item
            ),
            "",
        )
        parts: list[str] = []

        if dominant_risk is not None:
            parts.append(
                self._localized_risk_focus(
                    language=language,
                    role=role,
                    risk=dominant_risk,
                )
            )
            next_step = dominant_risk.mitigation or supporting_line
            if next_step:
                parts.append(self._localized_next_step(language, next_step))
        elif supporting_line:
            parts.append(self._localized_line_focus(language, role, supporting_line))
        else:
            parts.append(self._localized_generic_follow_up(language, role))

        return " ".join(ensure_sentence(part) for part in parts if part)

    @staticmethod
    def _pick_dominant_risk(risks: list[RiskItem]) -> RiskItem | None:
        if not risks:
            return None

        severity_rank = {
            RiskSeverity.LOW: 1,
            RiskSeverity.MEDIUM: 2,
            RiskSeverity.HIGH: 3,
            RiskSeverity.CRITICAL: 4,
        }
        return sorted(
            risks,
            key=lambda risk: (
                -severity_rank[risk.severity],
                -(risk.confidence or 0.0),
                risk.clause_id or "",
            ),
        )[0]

    def _localized_risk_focus(self, *, language: str, role: str, risk: RiskItem) -> str:
        title = self._plain_risk_title(risk.title)
        description = smart_truncate_text(ensure_sentence(risk.description), 180)
        templates = {
            "ru": "Главный риск для роли \"{role}\": {title}. {description}",
            "en": "The main risk for role \"{role}\" is {title}. {description}",
            "it": "Il rischio principale per il ruolo \"{role}\" e {title}. {description}",
            "fr": "Le risque principal pour le role \"{role}\" est {title}. {description}",
        }
        template = templates.get(language, templates["ru"])
        return template.format(role=role, title=title, description=description)

    @staticmethod
    def _localized_next_step(language: str, text: str) -> str:
        step = smart_truncate_text(ensure_sentence(text), 180)
        templates = {
            "ru": "Сначала проверьте: {text}",
            "en": "Check this first: {text}",
            "it": "Verifica prima di tutto questo: {text}",
            "fr": "Verifiez d'abord ceci : {text}",
        }
        template = templates.get(language, templates["ru"])
        return template.format(text=step)

    @staticmethod
    def _localized_line_focus(language: str, role: str, text: str) -> str:
        line = smart_truncate_text(ensure_sentence(text), 180)
        templates = {
            "ru": "Для роли \"{role}\" сначала проверьте пункт: {text}",
            "en": "For role \"{role}\", start with this clause: {text}",
            "it": "Per il ruolo \"{role}\", inizia da questa clausola: {text}",
            "fr": "Pour le role \"{role}\", commencez par cette clause : {text}",
        }
        template = templates.get(language, templates["ru"])
        return template.format(role=role, text=line)

    @staticmethod
    def _localized_generic_follow_up(language: str, role: str) -> str:
        templates = {
            "ru": "Для роли \"{role}\" вручную проверьте сроки, оплату, ответственность и право на односторонние действия.",
            "en": "For role \"{role}\", manually review deadlines, payment terms, liability, and unilateral rights.",
            "it": "Per il ruolo \"{role}\", controlla manualmente scadenze, pagamenti, responsabilita e diritti unilaterali.",
            "fr": "Pour le role \"{role}\", verifiez manuellement les delais, les paiements, la responsabilite et les droits unilateraux.",
        }
        template = templates.get(language, templates["ru"])
        return template.format(role=role)

    @staticmethod
    def _plain_risk_title(title: str) -> str:
        return title.split(": ", 1)[-1].strip()

    def _build_section_records(
        self,
        *,
        section_id: str,
        template: object,
        items: list[str],
        role: str,
    ) -> list[SummaryRecord]:
        total = len(items)
        return [
            self._record_formatter.build_record(
                record_id=f"role-summary-{section_id}-{index}",
                template=template,
                context={"role": role, "item_number": index, "items_count": total},
                evidence=[item],
            )
            for index, item in enumerate(items, start=1)
        ]

    @staticmethod
    def _summary_evidence(summary: RoleFocusedSummary) -> list[str]:
        evidence = (
            summary.must_do[:1]
            + summary.should_review[:1]
            + summary.payment_terms[:1]
            + summary.deadlines[:1]
            + summary.penalties[:1]
        )
        seen: set[str] = set()
        unique_items: list[str] = []
        for item in evidence:
            normalized = item.casefold()
            if normalized in seen:
                continue
            seen.add(normalized)
            unique_items.append(item)
        return unique_items

    @staticmethod
    def _expand_role_terms(role: str | None) -> list[str]:
        if not role or not role.strip():
            return []
        aliases = role_aliases(role)
        aliases.add(role.casefold().strip())
        return sorted(aliases, key=len, reverse=True)

    def _prepare_line(self, line: str) -> str:
        cleaned = normalize_contract_text(line)
        if not cleaned:
            return ""
        return smart_truncate_text(cleaned, max_chars=self._config.max_line_length)

