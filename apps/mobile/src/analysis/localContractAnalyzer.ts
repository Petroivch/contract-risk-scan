import type { AnalysisReport, DisputedClause, RiskItem, UploadContractRequest } from '../api/types';
import type { SupportedLanguage } from '../i18n/types';
import { defaultLanguage } from '../i18n/types';

import { extractContractText } from './fileTextExtraction';

interface ClauseSegment {
  clauseId: string;
  text: string;
}

interface RiskRule {
  id: string;
  severity: RiskItem['severity'];
  keywords: string[];
  title: Record<SupportedLanguage, string>;
  description: Record<SupportedLanguage, string>;
  recommendation: Record<SupportedLanguage, string>;
}

interface DisputeMarker {
  id: string;
  markers: string[];
  reason: Record<SupportedLanguage, string>;
  suggestion: Record<SupportedLanguage, string>;
}

interface AnalysisLocalization {
  contractTypes: Record<string, string>;
  unknownContractType: string;
  reportTitle: string;
  shortDescription: string;
  obligationsFallback: string;
  disputedFallback: string;
  disputedFallbackSuggestion: string;
  lowSignalRiskTitle: string;
  lowSignalRiskDescription: string;
  lowSignalRiskRecommendation: string;
  extractionRiskTitle: string;
  extractionRiskRecommendation: string;
}

const clauseIdPrefix = 'clause-';
const maxSummaryItems = 4;
const maxClauseExcerptLength = 220;

const localizedStrings: Record<SupportedLanguage, AnalysisLocalization> = {
  ru: {
    contractTypes: {
      services: 'Договор оказания услуг',
      employment: 'Трудовой договор',
      nda: 'Соглашение о конфиденциальности',
      supply: 'Договор поставки',
      contractWork: 'Договор подряда',
    },
    unknownContractType: 'Договор общего типа',
    reportTitle: 'Анализ договора',
    shortDescription:
      'Документ содержит {clausesCount} пунктов. Для роли "{role}" в фокусе обязательства, сроки, платежи и условия с повышенным риском.',
    obligationsFallback:
      'Явные обязательства для выбранной роли не найдены, нужен ручной просмотр разделов со сроками, оплатой и ответственностью.',
    disputedFallback:
      'Явные спорные формулировки не найдены, но договор все равно требует ручной юридической проверки.',
    disputedFallbackSuggestion: 'Проверьте разделы об ответственности, приемке, изменении условий и расторжении.',
    lowSignalRiskTitle: 'Низкий сигнал риска',
    lowSignalRiskDescription: 'Явные маркеры высокого риска не найдены, но документ требует ручной проверки общих условий.',
    lowSignalRiskRecommendation:
      'Проверьте лимиты ответственности, порядок приемки, оплату и право односторонних действий.',
    extractionRiskTitle: 'Ограниченное качество извлечения текста',
    extractionRiskRecommendation: 'Для более точного офлайн-анализа используйте текстовый PDF, DOCX или TXT.',
  },
  en: {
    contractTypes: {
      services: 'Service agreement',
      employment: 'Employment agreement',
      nda: 'Non-disclosure agreement',
      supply: 'Supply agreement',
      contractWork: 'Contract work agreement',
    },
    unknownContractType: 'General contract',
    reportTitle: 'Contract analysis',
    shortDescription:
      'The document contains {clausesCount} clauses. For the "{role}" role, the analysis prioritizes obligations, deadlines, payment terms, and elevated-risk conditions.',
    obligationsFallback:
      'No explicit obligations were found for the selected role. Review deadlines, payment, and liability sections manually.',
    disputedFallback: 'No explicit disputed wording was found, but the contract still requires legal review.',
    disputedFallbackSuggestion: 'Review liability, acceptance, change control, and termination sections.',
    lowSignalRiskTitle: 'Low-signal risk',
    lowSignalRiskDescription: 'No explicit high-risk markers were detected, but the document still needs manual review.',
    lowSignalRiskRecommendation: 'Check liability caps, acceptance mechanics, payment terms, and unilateral rights.',
    extractionRiskTitle: 'Limited text extraction quality',
    extractionRiskRecommendation: 'For more accurate offline analysis, use a text-based PDF, DOCX, or TXT file.',
  },
  it: {
    contractTypes: {
      services: 'Contratto di servizi',
      employment: 'Contratto di lavoro',
      nda: 'Accordo di riservatezza',
      supply: 'Contratto di fornitura',
      contractWork: 'Contratto d opera',
    },
    unknownContractType: 'Contratto generico',
    reportTitle: 'Analisi del contratto',
    shortDescription:
      'Il documento contiene {clausesCount} clausole. Per il ruolo "{role}" l analisi mette a fuoco obblighi, scadenze, pagamenti e condizioni a rischio elevato.',
    obligationsFallback:
      'Non sono stati trovati obblighi espliciti per il ruolo selezionato. Verificare manualmente termini, pagamenti e responsabilita.',
    disputedFallback:
      'Non sono state trovate formule chiaramente controverse, ma il contratto richiede comunque revisione legale.',
    disputedFallbackSuggestion: 'Controllare responsabilita, accettazione, variazioni contrattuali e risoluzione.',
    lowSignalRiskTitle: 'Rischio a basso segnale',
    lowSignalRiskDescription:
      'Non sono stati rilevati marcatori di rischio elevato, ma il documento richiede comunque verifica manuale.',
    lowSignalRiskRecommendation: 'Controllare limiti di responsabilita, accettazione, pagamento e diritti unilaterali.',
    extractionRiskTitle: 'Qualita limitata di estrazione del testo',
    extractionRiskRecommendation: 'Per un analisi offline piu precisa usare PDF testuale, DOCX o TXT.',
  },
  fr: {
    contractTypes: {
      services: 'Contrat de services',
      employment: 'Contrat de travail',
      nda: 'Accord de confidentialite',
      supply: 'Contrat de fourniture',
      contractWork: 'Contrat d entreprise',
    },
    unknownContractType: 'Contrat general',
    reportTitle: 'Analyse du contrat',
    shortDescription:
      'Le document contient {clausesCount} clauses. Pour le role "{role}", l analyse priorise les obligations, delais, paiements et conditions a risque eleve.',
    obligationsFallback:
      'Aucune obligation explicite n a ete detectee pour le role choisi. Verifiez manuellement les delais, paiements et responsabilites.',
    disputedFallback:
      'Aucune formulation manifestement litigieuse n a ete detectee, mais le contrat exige quand meme une revue juridique.',
    disputedFallbackSuggestion: 'Verifier les sections responsabilite, acceptation, modification contractuelle et resiliation.',
    lowSignalRiskTitle: 'Risque a faible signal',
    lowSignalRiskDescription:
      'Aucun marqueur de risque eleve n a ete detecte, mais le document necessite une verification manuelle.',
    lowSignalRiskRecommendation: 'Verifier plafonds de responsabilite, acceptation, paiement et droits unilateraux.',
    extractionRiskTitle: 'Qualite limitee de l extraction de texte',
    extractionRiskRecommendation: 'Pour une analyse hors ligne plus fiable, utilisez un PDF texte, DOCX ou TXT.',
  },
};

const summaryMarkers = {
  obligations: ['обязан', 'должен', 'обязуется', 'must', 'shall', 'undertakes', 'deve', 'obbliga', 'doit', 'devra'],
  payment: ['оплат', 'вознагражд', 'цена', 'payment', 'price', 'invoice', 'fee', 'pagamento', 'prix', 'paiement'],
  deadlines: ['срок', 'дней', 'рабочих дней', 'deadline', 'within', 'days', 'termine', 'giorni', 'delai', 'jours'],
  liability: ['ответствен', 'убыт', 'штраф', 'неустойк', 'liability', 'penalty', 'damages', 'responsabil', 'penale'],
};

const riskRules: RiskRule[] = [
  {
    id: 'unilateral',
    severity: 'high',
    keywords: ['односторон', 'unilateral', 'sole discretion', 'facolta unilaterale', 'resiliation unilaterale'],
    title: {
      ru: 'Одностороннее изменение или расторжение',
      en: 'Unilateral change or termination',
      it: 'Modifica o risoluzione unilaterale',
      fr: 'Modification ou resiliation unilaterale',
    },
    description: {
      ru: 'Найдена формулировка, позволяющая одной стороне менять условия или прекращать договор без симметричных гарантий.',
      en: 'A clause allows one party to change terms or terminate the contract without symmetric safeguards.',
      it: 'Una clausola consente a una parte di modificare termini o risolvere il contratto senza garanzie simmetriche.',
      fr: 'Une clause permet a une partie de modifier les conditions ou de resilier sans garanties symetriques.',
    },
    recommendation: {
      ru: 'Закрепите двустороннее согласование существенных изменений и одинаковый срок уведомления.',
      en: 'Require bilateral approval for material changes and the same notice period for both parties.',
      it: 'Richiedere approvazione bilaterale per modifiche rilevanti e lo stesso preavviso per entrambe le parti.',
      fr: 'Exiger un accord bilaterale pour les changements materiels et le meme preavis pour les deux parties.',
    },
  },
  {
    id: 'penalties',
    severity: 'high',
    keywords: ['штраф', 'неустойк', 'penalty', 'liquidated damages', 'penale', 'penalite'],
    title: {
      ru: 'Штрафы и санкции',
      en: 'Penalties and sanctions',
      it: 'Penali e sanzioni',
      fr: 'Penalites et sanctions',
    },
    description: {
      ru: 'Обнаружено условие о штрафах, неустойке или иных санкциях.',
      en: 'A penalty, liquidated damages, or similar sanction clause was detected.',
      it: 'E stata rilevata una clausola su penali, danni liquidati o sanzioni simili.',
      fr: 'Une clause de penalite, dommages forfaitaires ou sanction similaire a ete detectee.',
    },
    recommendation: {
      ru: 'Проверьте лимиты, основания начисления и соразмерность санкций.',
      en: 'Review caps, trigger conditions, and proportionality of penalties.',
      it: 'Verificare limiti, condizioni di applicazione e proporzionalita delle penali.',
      fr: 'Verifier plafonds, conditions de declenchement et proportionnalite des penalites.',
    },
  },
  {
    id: 'liability',
    severity: 'medium',
    keywords: ['ответствен', 'liability', 'indemn', 'возмещен', 'manleva', 'responsabil', 'indemni'],
    title: {
      ru: 'Ответственность и возмещение убытков',
      en: 'Liability and indemnification',
      it: 'Responsabilita e manleva',
      fr: 'Responsabilite et indemnisation',
    },
    description: {
      ru: 'В договоре есть условия об ответственности, убытках или возмещении.',
      en: 'The contract contains liability, damages, or indemnification language.',
      it: 'Il contratto contiene clausole su responsabilita, danni o manleva.',
      fr: 'Le contrat contient des clauses sur la responsabilite, les dommages ou l indemnisation.',
    },
    recommendation: {
      ru: 'Уточните лимиты ответственности, исключения и события, запускающие компенсацию.',
      en: 'Clarify liability caps, exclusions, and triggering events for compensation.',
      it: 'Chiarire limiti di responsabilita, esclusioni ed eventi che attivano la compensazione.',
      fr: 'Preciser les plafonds de responsabilite, exclusions et evenements declencheurs.',
    },
  },
  {
    id: 'acceptance',
    severity: 'medium',
    keywords: ['приемк', 'акт', 'acceptance', 'sign-off', 'collaudo', 'acceptation'],
    title: {
      ru: 'Неясная приемка результата',
      en: 'Unclear acceptance process',
      it: 'Procedura di accettazione poco chiara',
      fr: 'Procedure d acceptation peu claire',
    },
    description: {
      ru: 'Нашлись формулировки о приемке, подтверждении результата или подписании актов.',
      en: 'Acceptance, sign-off, or completion confirmation language was detected.',
      it: 'Sono state rilevate formule su accettazione, collaudo o conferma del risultato.',
      fr: 'Des formulations sur l acceptation, la recette ou la confirmation du resultat ont ete detectees.',
    },
    recommendation: {
      ru: 'Добавьте измеримые критерии приемки и срок ответа на замечания.',
      en: 'Define measurable acceptance criteria and a deadline for comments.',
      it: 'Definire criteri misurabili di accettazione e un termine per le osservazioni.',
      fr: 'Definir des criteres d acceptation mesurables et un delai de reponse aux remarques.',
    },
  },
];

const disputeMarkers: DisputeMarker[] = [
  {
    id: 'future-agreement',
    markers: ['по соглашению сторон', 'by agreement of the parties', 'di comune accordo', 'd un commun accord'],
    reason: {
      ru: 'Условие зависит от будущего соглашения сторон и не фиксирует четкий порядок исполнения.',
      en: 'The clause depends on future agreement between the parties and leaves execution mechanics undefined.',
      it: 'La clausola dipende da un accordo futuro tra le parti e non fissa una procedura chiara.',
      fr: 'La clause depend d un accord futur des parties et ne fixe pas de mecanisme d execution clair.',
    },
    suggestion: {
      ru: 'Закрепите точный порядок, сроки и ответственных лиц прямо в тексте договора.',
      en: 'Specify the exact workflow, deadlines, and responsible persons directly in the contract.',
      it: 'Specificare nel contratto procedura, termini e soggetti responsabili.',
      fr: 'Preciser dans le contrat la procedure, les delais et les responsables.',
    },
  },
  {
    id: 'reasonable-time',
    markers: ['разумный срок', 'reasonable time', 'termine ragionevole', 'delai raisonnable'],
    reason: {
      ru: 'Указан субъективный срок без точной границы.',
      en: 'A subjective timeline is used without a precise limit.',
      it: 'Viene usato un termine soggettivo senza limite preciso.',
      fr: 'Un delai subjectif est utilise sans limite precise.',
    },
    suggestion: {
      ru: 'Замените формулировку на конкретное число рабочих или календарных дней.',
      en: 'Replace the wording with a concrete number of business or calendar days.',
      it: 'Sostituire la formula con un numero preciso di giorni lavorativi o di calendario.',
      fr: 'Remplacer la formule par un nombre precis de jours ouvrables ou calendaires.',
    },
  },
  {
    id: 'discretionary-right',
    markers: ['вправе', 'may at its discretion', 'sole discretion', 'ha facolta', 'est autorise'],
    reason: {
      ru: 'Одна из сторон получила дискреционное право без достаточных ограничений.',
      en: 'One party received a discretionary right without sufficient boundaries.',
      it: 'Una delle parti ha ottenuto un diritto discrezionale senza limiti sufficienti.',
      fr: 'Une partie dispose d un droit discretionnaire sans limites suffisantes.',
    },
    suggestion: {
      ru: 'Ограничьте такое право критериями, сроками и обязательным уведомлением другой стороны.',
      en: 'Limit the right with objective criteria, deadlines, and mandatory notice to the counterparty.',
      it: 'Limitare tale diritto con criteri oggettivi, termini e notifica obbligatoria alla controparte.',
      fr: 'Encadrer ce droit par des criteres objectifs, des delais et une notification obligatoire.',
    },
  },
];

const contractTypeDetectors: Record<string, string[]> = {
  services: ['услуг', 'service agreement', 'statement of work', 'servizi', 'services'],
  employment: ['трудов', 'работодатель', 'employee', 'employment', 'lavoro', 'travail'],
  nda: ['конфиден', 'non-disclosure', 'nda', 'riservatezza', 'confidentialite'],
  supply: ['поставк', 'supply', 'delivery', 'fornitura', 'fourniture'],
  contractWork: ['подряд', 'work result', 'contract work', 'appalto', 'entreprise'],
};

const normalizeLanguage = (language?: SupportedLanguage): SupportedLanguage => {
  return language && localizedStrings[language] ? language : defaultLanguage;
};

const normalizeText = (input: string): string => input.replace(/\r/g, '\n').replace(/\s+/g, ' ').trim();

const segmentClauses = (text: string): ClauseSegment[] => {
  const rawClauses = text
    .replace(/\r/g, '\n')
    .split(/\n{2,}|(?=\d+\.\d+)|(?=\d+\))/)
    .map((clause) => clause.trim())
    .filter(Boolean);

  const clauses = rawClauses.length > 0 ? rawClauses : text.split('\n').map((clause) => clause.trim()).filter(Boolean);
  return clauses.map((clause, index) => ({ clauseId: `${clauseIdPrefix}${index + 1}`, text: clause }));
};

const collectCandidateLines = (text: string, clauses: ClauseSegment[]): string[] => {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const source of [text, ...clauses.map((item) => item.text)]) {
    const parts = source.replace(/\r/g, '\n').split(/[\n;]+/);
    for (const part of parts) {
      const normalized = normalizeText(part);
      if (!normalized) {
        continue;
      }

      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      lines.push(normalized.slice(0, maxClauseExcerptLength));
    }
  }

  return lines;
};

const collectLines = (
  candidates: string[],
  markers: string[],
  prioritizedTerms: string[],
  maxItems: number,
): string[] => {
  const normalizedMarkers = markers.map((item) => item.toLowerCase());
  const normalizedTerms = prioritizedTerms.map((item) => item.toLowerCase()).filter(Boolean);
  const prioritized: string[] = [];
  const secondary: string[] = [];

  for (const line of candidates) {
    const normalized = line.toLowerCase();
    if (!normalizedMarkers.some((marker) => normalized.includes(marker))) {
      continue;
    }

    const hasPriorityTerm = normalizedTerms.some((term) => normalized.includes(term));
    if (hasPriorityTerm) {
      prioritized.push(line);
    } else {
      secondary.push(line);
    }
  }

  return [...prioritized, ...secondary].slice(0, maxItems);
};

const detectContractType = (text: string, language: SupportedLanguage): string => {
  const normalized = text.toLowerCase();
  const localization = localizedStrings[language];

  for (const [key, markers] of Object.entries(contractTypeDetectors)) {
    if (markers.some((marker) => normalized.includes(marker))) {
      return localization.contractTypes[key] ?? localization.unknownContractType;
    }
  }

  return localization.unknownContractType;
};

const buildRiskItems = (
  clauses: ClauseSegment[],
  role: string,
  language: SupportedLanguage,
  warnings: string[],
): RiskItem[] => {
  const results: RiskItem[] = [];
  const seen = new Set<string>();

  for (const clause of clauses) {
    const normalized = clause.text.toLowerCase();
    for (const rule of riskRules) {
      if (!rule.keywords.some((keyword) => normalized.includes(keyword))) {
        continue;
      }

      const dedupeKey = `${rule.id}:${clause.clauseId}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);

      results.push({
        id: `risk-${results.length + 1}`,
        severity: rule.severity,
        clauseRef: clause.clauseId,
        title: rule.title[language],
        description: rule.description[language],
        recommendation: rule.recommendation[language],
      });
    }
  }

  if (warnings.length > 0) {
    const strings = localizedStrings[language];
    results.unshift({
      id: 'risk-warning-1',
      severity: 'medium',
      clauseRef: 'system',
      title: strings.extractionRiskTitle,
      description: warnings.join(' '),
      recommendation: strings.extractionRiskRecommendation,
    });
  }

  if (results.length === 0) {
    const strings = localizedStrings[language];
    results.push({
      id: 'risk-1',
      severity: 'low',
      clauseRef: role ? role : 'overview',
      title: strings.lowSignalRiskTitle,
      description: strings.lowSignalRiskDescription,
      recommendation: strings.lowSignalRiskRecommendation,
    });
  }

  return results
    .sort((left, right) => {
      const rank = { high: 3, medium: 2, low: 1 };
      return rank[right.severity] - rank[left.severity];
    })
    .map((item, index) => ({ ...item, id: `risk-${index + 1}` }));
};

const buildDisputedClauses = (clauses: ClauseSegment[], language: SupportedLanguage): DisputedClause[] => {
  const results: DisputedClause[] = [];
  const strings = localizedStrings[language];

  for (const clause of clauses) {
    const normalized = clause.text.toLowerCase();
    for (const marker of disputeMarkers) {
      if (!marker.markers.some((item) => normalized.includes(item))) {
        continue;
      }

      results.push({
        id: `disputed-${results.length + 1}`,
        clauseRef: clause.clauseId,
        whyDisputed: marker.reason[language],
        suggestedRewrite: marker.suggestion[language],
      });
      break;
    }
  }

  if (results.length === 0) {
    results.push({
      id: 'disputed-1',
      clauseRef: 'overview',
      whyDisputed: strings.disputedFallback,
      suggestedRewrite: strings.disputedFallbackSuggestion,
    });
  }

  return results;
};

const formatTemplate = (template: string, values: Record<string, string | number>): string => {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
};

export const analyzeContractLocally = async (
  payload: UploadContractRequest,
  languageInput?: SupportedLanguage,
): Promise<AnalysisReport> => {
  const language = normalizeLanguage(languageInput ?? payload.language);
  const strings = localizedStrings[language];
  const { text: extractedText, warnings } = await extractContractText(payload, language);
  const normalizedText = normalizeText(extractedText);
  const clauses = segmentClauses(normalizedText);
  const candidates = collectCandidateLines(normalizedText, clauses);
  const prioritizedTerms = [payload.selectedRole, 'исполнитель', 'заказчик', 'работодатель', 'employee', 'contractor'];

  const obligations = collectLines(candidates, summaryMarkers.obligations, prioritizedTerms, maxSummaryItems);
  const paymentTerms = collectLines(candidates, summaryMarkers.payment, prioritizedTerms, 2);
  const deadlines = collectLines(candidates, summaryMarkers.deadlines, prioritizedTerms, 2);
  const liabilityItems = collectLines(candidates, summaryMarkers.liability, prioritizedTerms, 2);

  const risks = buildRiskItems(clauses, payload.selectedRole, language, warnings);
  const disputedClauses = buildDisputedClauses(clauses, language);
  const summaryItems = [obligations[0], paymentTerms[0], deadlines[0], liabilityItems[0]].filter(Boolean);

  return {
    analysisId: `analysis_${Date.now()}`,
    selectedRole: payload.selectedRole,
    generatedAt: new Date().toISOString(),
    summary: {
      title: `${strings.reportTitle}: ${payload.fileName}`,
      contractType: detectContractType(normalizedText, language),
      shortDescription: formatTemplate(strings.shortDescription, {
        clausesCount: clauses.length,
        role: payload.selectedRole,
      }),
      obligationsForSelectedRole: summaryItems.length > 0 ? summaryItems : [strings.obligationsFallback],
    },
    risks,
    disputedClauses,
  };
};
