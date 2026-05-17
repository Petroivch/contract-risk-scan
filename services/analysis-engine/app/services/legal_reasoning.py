from __future__ import annotations

from app.localization import normalize_analysis_language
from app.schemas.analysis import DisputedClauseItem, RiskItem, RiskSeverity, RoleFocusedSummary, SummaryRecord
from app.services.asymmetry_detector import AsymmetrySignal


class LegalReasoningService:
    """Builds deterministic AI-style reasoning from risk, role and asymmetry signals."""

    def build_insights(
        self,
        *,
        role_summary: RoleFocusedSummary,
        risks: list[RiskItem],
        disputed_clauses: list[DisputedClauseItem],
        asymmetry_signals: list[AsymmetrySignal],
        language: str,
    ) -> list[str]:
        resolved_language = normalize_analysis_language(language)
        high_risks = [
            risk
            for risk in risks
            if risk.severity in {RiskSeverity.HIGH, RiskSeverity.CRITICAL}
        ]
        risk_ids = {risk.rule_id or risk.risk_id for risk in risks}
        asymmetry_ids = {signal.risk_id for signal in asymmetry_signals}
        insights: list[str] = []

        if len(high_risks) >= 2:
            insights.append(self._text("high_risk_cluster", resolved_language))

        if {"payment_asymmetry", "payment_deadline", "payment_delay"}.intersection(risk_ids | asymmetry_ids):
            if role_summary.payment_terms and role_summary.deadlines:
                insights.append(self._text("payment_timing", resolved_language))

        if any("unilateral" in risk_id or "termination" in risk_id for risk_id in risk_ids | asymmetry_ids):
            if any(risk.severity in {RiskSeverity.HIGH, RiskSeverity.CRITICAL} for risk in risks):
                insights.append(self._text("one_sided_control", resolved_language))

        if disputed_clauses:
            insights.append(self._text("disputed_wording", resolved_language))

        if not insights:
            insights.append(self._text("fallback", resolved_language))

        return self._dedupe(insights)[:3]

    def enrich_contract_brief(
        self,
        contract_brief: str,
        insights: list[str],
        language: str,
    ) -> str:
        if not insights:
            return contract_brief

        prefix = self._label("contract_brief_prefix", normalize_analysis_language(language))
        additions = [f"{prefix}: {insight}" for insight in insights if insight not in contract_brief]
        if not additions:
            return contract_brief

        return " ".join([contract_brief, *additions])

    def enrich_records(
        self,
        records: list[SummaryRecord],
        insights: list[str],
        language: str,
        record_id: str,
    ) -> list[SummaryRecord]:
        if not insights:
            return records

        resolved_language = normalize_analysis_language(language)
        return [
            *records,
            SummaryRecord(
                id=record_id,
                headline=self._label("record_headline", resolved_language),
                description=insights[0],
                recommendation=insights[1] if len(insights) > 1 else self._text("record_recommendation", resolved_language),
                evidence=insights[:3],
            ),
        ]

    @staticmethod
    def _dedupe(values: list[str]) -> list[str]:
        seen: set[str] = set()
        result: list[str] = []
        for value in values:
            normalized = value.casefold()
            if normalized in seen:
                continue
            seen.add(normalized)
            result.append(value)
        return result

    @staticmethod
    def _label(key: str, language: str) -> str:
        labels = {
            "contract_brief_prefix": {
                "ru": "AI-приоритет",
                "en": "AI priority",
                "it": "Priorita AI",
                "fr": "Priorite IA",
            },
            "record_headline": {
                "ru": "AI-приоритет проверки.",
                "en": "AI review priority.",
                "it": "Priorita AI di revisione.",
                "fr": "Priorite IA de revue.",
            },
        }
        return labels[key].get(language, labels[key]["ru"])

    @staticmethod
    def _text(key: str, language: str) -> str:
        messages = {
            "high_risk_cluster": {
                "ru": "Несколько независимых высоких рисков усиливают общий риск сделки; сначала согласуйте самые жесткие условия.",
                "en": "Multiple independent high-risk signals compound the deal exposure; start with the strictest clauses.",
                "it": "Piu segnali indipendenti ad alto rischio aumentano l esposizione dell accordo; iniziare dalle clausole piu rigide.",
                "fr": "Plusieurs signaux independants a haut risque aggravent l exposition; commencez par les clauses les plus strictes.",
            },
            "payment_timing": {
                "ru": "Связка оплаты и сроков требует проверки события оплаты, крайней даты перечисления и права приостановить исполнение.",
                "en": "The payment and timing combination requires checking the payment trigger, outside payment date, and suspension right.",
                "it": "La combinazione pagamento-scadenze richiede verifica del trigger di pagamento, data limite e diritto di sospensione.",
                "fr": "Le lien paiement-delais exige de verifier le declencheur du paiement, la date limite et le droit de suspension.",
            },
            "one_sided_control": {
                "ru": "Односторонний контроль должен быть ограничен закрытым перечнем оснований, уведомлением и встречным правом возражения.",
                "en": "One-sided control should be limited by a closed list of grounds, notice, and a reciprocal objection right.",
                "it": "Il controllo unilaterale va limitato da presupposti chiusi, preavviso e diritto reciproco di opposizione.",
                "fr": "Le controle unilateral doit etre limite par une liste fermee de motifs, un preavis et un droit reciproque d objection.",
            },
            "disputed_wording": {
                "ru": "Спорные формулировки лучше заменить измеримыми критериями, сроками и подтверждающими документами.",
                "en": "Disputed wording should be replaced with measurable criteria, deadlines, and supporting documents.",
                "it": "Le formulazioni controverse vanno sostituite con criteri misurabili, scadenze e documenti di prova.",
                "fr": "Les formulations litigieuses doivent etre remplacees par des criteres mesurables, des delais et des preuves.",
            },
            "fallback": {
                "ru": "Критичных связок немного, но сроки, оплату, ответственность и односторонние права все равно нужно проверить вручную.",
                "en": "Few critical combinations were found, but deadlines, payment, liability, and unilateral rights still need manual review.",
                "it": "Sono emerse poche combinazioni critiche, ma scadenze, pagamenti, responsabilita e diritti unilaterali vanno comunque rivisti.",
                "fr": "Peu de combinaisons critiques sont apparues, mais delais, paiement, responsabilite et droits unilateraux restent a verifier.",
            },
            "record_recommendation": {
                "ru": "Начните правки с пунктов, где одновременно есть срок, сумма, санкция или право другой стороны действовать без согласования.",
                "en": "Start edits with clauses combining a deadline, amount, sanction, or counterparty right to act without approval.",
                "it": "Iniziare dalle clausole che combinano scadenza, importo, sanzione o diritto della controparte senza approvazione.",
                "fr": "Commencez par les clauses combinant delai, montant, sanction ou droit de la contrepartie sans accord.",
            },
        }
        return messages[key].get(language, messages[key]["ru"])
