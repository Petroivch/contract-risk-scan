import { DEFAULT_LOCALE, SupportedLocale } from '../i18n/supported-locale.enum';

interface LocalizedReportText {
  defaultTitle: string;
  defaultContractType: string;
  pdfContractType: string;
  docxContractType: string;
  textContractType: string;
  unknownClauseRef: string;
  mustDoDueCondition: string;
  paymentDueCondition: string;
  deadlineDueCondition: string;
  reviewDueCondition: string;
  disputedRewriteFallback: string;
}

export const CONTRACT_REPORT_TEXT_POLICY: Record<SupportedLocale, LocalizedReportText> = {
  [SupportedLocale.RU]: {
    defaultTitle: 'Сводка по договору',
    defaultContractType: 'Договор',
    pdfContractType: 'PDF-договор',
    docxContractType: 'DOCX-договор',
    textContractType: 'Текстовый договор',
    unknownClauseRef: 'Без номера пункта',
    mustDoDueCondition: 'Обязательство требует контроля по основным условиям договора.',
    paymentDueCondition: 'Следите за сроками оплаты и условиями выставления счета.',
    deadlineDueCondition: 'Контролируйте сроки исполнения и условия приемки.',
    reviewDueCondition: 'Пункт требует отдельной юридической проверки перед согласованием.',
    disputedRewriteFallback: 'Уточните формулировку и симметрично распределите риски между сторонами.'
  },
  [SupportedLocale.EN]: {
    defaultTitle: 'Contract overview',
    defaultContractType: 'Contract',
    pdfContractType: 'PDF contract',
    docxContractType: 'DOCX contract',
    textContractType: 'Text contract',
    unknownClauseRef: 'Clause reference not found',
    mustDoDueCondition: 'This obligation should be tracked against the core contract terms.',
    paymentDueCondition: 'Track payment deadlines and invoice acceptance conditions.',
    deadlineDueCondition: 'Track delivery deadlines and acceptance milestones.',
    reviewDueCondition: 'This point should be reviewed by legal before approval.',
    disputedRewriteFallback:
      'Clarify the wording and rebalance risk allocation symmetrically for both parties.'
  },
  [SupportedLocale.IT]: {
    defaultTitle: 'Panoramica del contratto',
    defaultContractType: 'Contratto',
    pdfContractType: 'Contratto PDF',
    docxContractType: 'Contratto DOCX',
    textContractType: 'Contratto testuale',
    unknownClauseRef: 'Riferimento clausola non trovato',
    mustDoDueCondition: 'Questo obbligo va monitorato rispetto ai termini principali del contratto.',
    paymentDueCondition: 'Monitorare le scadenze di pagamento e le condizioni di accettazione della fattura.',
    deadlineDueCondition: 'Monitorare le scadenze di esecuzione e le tappe di accettazione.',
    reviewDueCondition: 'Questo punto richiede una revisione legale prima dell\'approvazione.',
    disputedRewriteFallback:
      'Chiarire la formulazione e riequilibrare la distribuzione dei rischi tra le parti.'
  },
  [SupportedLocale.FR]: {
    defaultTitle: 'Vue d’ensemble du contrat',
    defaultContractType: 'Contrat',
    pdfContractType: 'Contrat PDF',
    docxContractType: 'Contrat DOCX',
    textContractType: 'Contrat texte',
    unknownClauseRef: 'Référence de clause introuvable',
    mustDoDueCondition: 'Cette obligation doit être suivie au regard des termes essentiels du contrat.',
    paymentDueCondition: 'Suivez les échéances de paiement et les conditions d’acceptation de facture.',
    deadlineDueCondition: 'Suivez les délais d’exécution et les jalons de réception.',
    reviewDueCondition: 'Ce point doit être revu par le service juridique avant validation.',
    disputedRewriteFallback:
      'Clarifiez la rédaction et rééquilibrez la répartition des risques entre les parties.'
  }
};

export function getContractReportText(locale: SupportedLocale): LocalizedReportText {
  return CONTRACT_REPORT_TEXT_POLICY[locale] ?? CONTRACT_REPORT_TEXT_POLICY[DEFAULT_LOCALE];
}
