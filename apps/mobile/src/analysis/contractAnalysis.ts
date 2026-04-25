import type { AnalysisReport, DisputedClause, RiskItem } from '../api/types';
import type { SupportedLanguage } from '../i18n/types';
import { defaultLanguage } from '../i18n/types';

import {
  normalizeExtractedText,
  normalizeSearchText,
  repairMojibakeText,
  uniqueStrings,
} from './textNormalization';

export interface ClauseSegment {
  clauseId: string;
  clauseRef: string;
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

interface BuildAnalysisArtifactsInput {
  text: string;
  fileName: string;
  selectedRole: string;
  language: SupportedLanguage;
  warnings: string[];
}

interface AnalysisArtifacts {
  summary: AnalysisReport['summary'];
  risks: RiskItem[];
  disputedClauses: DisputedClause[];
}

interface RiskCandidate {
  rule: RiskRule;
  clauseRef: string;
  clauseIndex: number;
  fragmentIndex: number;
  excerpt: string;
  normalizedText: string;
  normalizedClauseText: string;
  markerHits: number;
  lexicalScore: number;
  contextualScore: number;
  totalScore: number;
}

interface DisputeCandidate {
  marker: DisputeMarker;
  clauseRef: string;
  clauseIndex: number;
  fragmentIndex: number;
  excerpt: string;
  normalizedText: string;
  normalizedClauseText: string;
  markerHits: number;
  lexicalScore: number;
  contextualScore: number;
  totalScore: number;
}

const clauseIdPrefix = 'clause-';
const maxSummaryItems = 12;
const maxClauseExcerptLength = 240;
const shortMojibakeTokenFixes: Record<string, string> = {
  'Р°': 'а',
  Рђ: 'А',
  РІ: 'в',
  'Р’': 'В',
  Рё: 'и',
  'Р': 'И',
  СЃ: 'с',
  РЎ: 'С',
  Рє: 'к',
  Рљ: 'К',
  Рѕ: 'о',
  Рћ: 'О',
  Сѓ: 'у',
  РЈ: 'У',
};

const repairStaticString = (value: string): string => {
  const repaired = repairMojibakeText(value);

  return repaired.replace(/\S+/gu, (token) => {
    const match = token.match(/^([^\p{L}\p{N}]*)((?:[\p{L}\p{N}]|_)+)([^\p{L}\p{N}]*)$/u);
    if (!match) {
      return shortMojibakeTokenFixes[token] ?? token;
    }

    const [, prefix, core, suffix] = match;
    return `${prefix}${shortMojibakeTokenFixes[core] ?? core}${suffix}`;
  });
};

const repairDeepStrings = <T>(value: T): T => {
  if (typeof value === 'string') {
    return repairStaticString(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => repairDeepStrings(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, repairDeepStrings(item)]),
    ) as T;
  }

  return value;
};

const appendMappedItems = <TInput, TOutput>(
  source: TInput[],
  mapper: (item: TInput, index: number) => TOutput[],
): TOutput[] => {
  const output: TOutput[] = [];

  for (let index = 0; index < source.length; index += 1) {
    output.push(...mapper(source[index], index));
  }

  return output;
};

const localizedStrings: Record<SupportedLanguage, AnalysisLocalization> = repairDeepStrings({
  ru: {
    contractTypes: {
      services: 'Р”РѕРіРѕРІРѕСЂ РѕРєР°Р·Р°РЅРёСЏ СѓСЃР»СѓРі',
      employment: 'РўСЂСѓРґРѕРІРѕР№ РґРѕРіРѕРІРѕСЂ',
      agency: 'РђРіРµРЅС‚СЃРєРёР№ РґРѕРіРѕРІРѕСЂ',
      nda: 'РЎРѕРіР»Р°С€РµРЅРёРµ Рѕ РєРѕРЅС„РёРґРµРЅС†РёР°Р»СЊРЅРѕСЃС‚Рё',
      loan: 'Р”РѕРіРѕРІРѕСЂ Р·Р°Р№РјР°',
      cession: 'Р”РѕРіРѕРІРѕСЂ С†РµСЃСЃРёРё',
      supply: 'Р”РѕРіРѕРІРѕСЂ РїРѕСЃС‚Р°РІРєРё',
      contractWork: 'Р”РѕРіРѕРІРѕСЂ РїРѕРґСЂСЏРґР°',
      rent: 'Р”РѕРіРѕРІРѕСЂ Р°СЂРµРЅРґС‹',
    },
    unknownContractType: 'Р”РѕРіРѕРІРѕСЂ РѕР±С‰РµРіРѕ С‚РёРїР°',
    reportTitle: 'РђРЅР°Р»РёР· РґРѕРіРѕРІРѕСЂР°',
    shortDescription:
      'Р”РѕРєСѓРјРµРЅС‚ СЃРѕРґРµСЂР¶РёС‚ {clausesCount} РїСѓРЅРєС‚РѕРІ. Р”Р»СЏ СЂРѕР»Рё "{role}" РІ С„РѕРєСѓСЃРµ РѕР±СЏР·Р°С‚РµР»СЊСЃС‚РІР°, СЃСЂРѕРєРё, РїР»Р°С‚РµР¶Рё Рё СѓСЃР»РѕРІРёСЏ СЃ РїРѕРІС‹С€РµРЅРЅС‹Рј СЂРёСЃРєРѕРј.',
    obligationsFallback:
      'РЇРІРЅС‹Рµ РѕР±СЏР·Р°С‚РµР»СЊСЃС‚РІР° РґР»СЏ РІС‹Р±СЂР°РЅРЅРѕР№ СЂРѕР»Рё РЅРµ РЅР°Р№РґРµРЅС‹, РЅСѓР¶РµРЅ СЂСѓС‡РЅРѕР№ РїСЂРѕСЃРјРѕС‚СЂ СЂР°Р·РґРµР»РѕРІ СЃРѕ СЃСЂРѕРєР°РјРё, РѕРїР»Р°С‚РѕР№ Рё РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚СЊСЋ.',
    disputedFallback:
      'РЇРІРЅС‹Рµ СЃРїРѕСЂРЅС‹Рµ С„РѕСЂРјСѓР»РёСЂРѕРІРєРё РЅРµ РЅР°Р№РґРµРЅС‹, РЅРѕ РґРѕРіРѕРІРѕСЂ РІСЃРµ СЂР°РІРЅРѕ С‚СЂРµР±СѓРµС‚ СЂСѓС‡РЅРѕР№ СЋСЂРёРґРёС‡РµСЃРєРѕР№ РїСЂРѕРІРµСЂРєРё.',
    disputedFallbackSuggestion:
      'РџСЂРѕРІРµСЂСЊС‚Рµ СЂР°Р·РґРµР»С‹ РѕР± РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚Рё, РїСЂРёРµРјРєРµ, РёР·РјРµРЅРµРЅРёРё СѓСЃР»РѕРІРёР№ Рё СЂР°СЃС‚РѕСЂР¶РµРЅРёРё.',
    lowSignalRiskTitle: 'РќРёР·РєРёР№ СЃРёРіРЅР°Р» СЂРёСЃРєР°',
    lowSignalRiskDescription:
      'РЇРІРЅС‹Рµ РјР°СЂРєРµСЂС‹ РІС‹СЃРѕРєРѕРіРѕ СЂРёСЃРєР° РЅРµ РЅР°Р№РґРµРЅС‹, РЅРѕ РґРѕРєСѓРјРµРЅС‚ С‚СЂРµР±СѓРµС‚ СЂСѓС‡РЅРѕР№ РїСЂРѕРІРµСЂРєРё РѕР±С‰РёС… СѓСЃР»РѕРІРёР№.',
    lowSignalRiskRecommendation:
      'РџСЂРѕРІРµСЂСЊС‚Рµ Р»РёРјРёС‚С‹ РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚Рё, РїРѕСЂСЏРґРѕРє РїСЂРёРµРјРєРё, РѕРїР»Р°С‚Сѓ Рё РїСЂР°РІРѕ РѕРґРЅРѕСЃС‚РѕСЂРѕРЅРЅРёС… РґРµР№СЃС‚РІРёР№.',
    extractionRiskTitle:
      'РћРіСЂР°РЅРёС‡РµРЅРЅРѕРµ РєР°С‡РµСЃС‚РІРѕ РёР·РІР»РµС‡РµРЅРёСЏ С‚РµРєСЃС‚Р°',
    extractionRiskRecommendation:
      'Для более точного офлайн-анализа используйте текстовый PDF, DOCX или TXT-файл.',
  },
  en: {
    contractTypes: {
      services: 'Service agreement',
      employment: 'Employment agreement',
      agency: 'Agency agreement',
      nda: 'Non-disclosure agreement',
      loan: 'Loan agreement',
      cession: 'Assignment agreement',
      supply: 'Supply agreement',
      contractWork: 'Contract work agreement',
      rent: 'Lease agreement',
    },
    unknownContractType: 'General contract',
    reportTitle: 'Contract analysis',
    shortDescription:
      'The document contains {clausesCount} clauses. For the "{role}" role, the analysis prioritizes obligations, deadlines, payment terms, and elevated-risk conditions.',
    obligationsFallback:
      'No explicit obligations were found for the selected role. Review deadlines, payment, and liability sections manually.',
    disputedFallback:
      'No explicit disputed wording was found, but the contract still requires legal review.',
    disputedFallbackSuggestion:
      'Review liability, acceptance, change control, and termination sections.',
    lowSignalRiskTitle: 'Low-signal risk',
    lowSignalRiskDescription:
      'No explicit high-risk markers were detected, but the document still needs manual review.',
    lowSignalRiskRecommendation:
      'Check liability caps, acceptance mechanics, payment terms, and unilateral rights.',
    extractionRiskTitle: 'Limited text extraction quality',
    extractionRiskRecommendation:
      'For more accurate offline analysis, use a text-based PDF, DOCX, or TXT file.',
  },
  it: {
    contractTypes: {
      services: 'Contratto di servizi',
      employment: 'Contratto di lavoro',
      agency: 'Contratto di agenzia',
      nda: 'Accordo di riservatezza',
      loan: 'Contratto di prestito',
      cession: 'Contratto di cessione',
      supply: 'Contratto di fornitura',
      contractWork: "Contratto d'opera",
      rent: 'Contratto di locazione',
    },
    unknownContractType: 'Contratto generico',
    reportTitle: 'Analisi del contratto',
    shortDescription:
      'Il documento contiene {clausesCount} clausole. Per il ruolo "{role}" l analisi mette a fuoco obblighi, scadenze, pagamenti e condizioni a rischio elevato.',
    obligationsFallback:
      'Non sono stati trovati obblighi espliciti per il ruolo selezionato. Verificare manualmente termini, pagamenti e responsabilita.',
    disputedFallback:
      'Non sono state trovate formule chiaramente controverse, ma il contratto richiede comunque revisione legale.',
    disputedFallbackSuggestion:
      'Controllare responsabilita, accettazione, variazioni contrattuali e risoluzione.',
    lowSignalRiskTitle: 'Rischio a basso segnale',
    lowSignalRiskDescription:
      'Non sono stati rilevati marcatori di rischio elevato, ma il documento richiede comunque verifica manuale.',
    lowSignalRiskRecommendation:
      'Controllare limiti di responsabilita, accettazione, pagamento e diritti unilaterali.',
    extractionRiskTitle: 'Qualita limitata di estrazione del testo',
    extractionRiskRecommendation:
      'Per un analisi offline piu precisa usare PDF testuale, DOCX o TXT.',
  },
  fr: {
    contractTypes: {
      services: 'Contrat de services',
      employment: 'Contrat de travail',
      agency: "Contrat d'agence",
      nda: 'Accord de confidentialite',
      loan: 'Contrat de pret',
      cession: 'Contrat de cession',
      supply: 'Contrat de fourniture',
      contractWork: 'Contrat d entreprise',
      rent: 'Contrat de location',
    },
    unknownContractType: 'Contrat general',
    reportTitle: 'Analyse du contrat',
    shortDescription:
      'Le document contient {clausesCount} clauses. Pour le role "{role}", l analyse priorise les obligations, delais, paiements et conditions a risque eleve.',
    obligationsFallback:
      'Aucune obligation explicite n a ete detectee pour le role choisi. Verifiez manuellement les delais, paiements et responsabilites.',
    disputedFallback:
      'Aucune formulation manifestement litigieuse n a ete detectee, mais le contrat exige quand meme une revue juridique.',
    disputedFallbackSuggestion:
      'Verifier les sections responsabilite, acceptation, modification contractuelle et resiliation.',
    lowSignalRiskTitle: 'Risque a faible signal',
    lowSignalRiskDescription:
      'Aucun marqueur de risque eleve n a ete detecte, mais le document necessite une verification manuelle.',
    lowSignalRiskRecommendation:
      'Verifier plafonds de responsabilite, acceptation, paiement et droits unilateraux.',
    extractionRiskTitle: 'Qualite limitee de l extraction de texte',
    extractionRiskRecommendation:
      'Pour une analyse hors ligne plus fiable, utilisez un PDF texte, DOCX ou TXT.',
  },
});

const summaryMarkers = repairDeepStrings({
  obligations: [
    'обязан',
    'должен',
    'обязуется',
    'передает',
    'передавать',
    'предоставляет',
    'поручает',
    'принимает',
    'принимает на себя',
    'возвращает',
    'возвратить',
    'перечисляет',
    'вносит',
    'выплачивает',
    'выполнить',
    'исполнять',
    'исполняет',
    'использовать',
    'сдавать',
    'получить',
    'производить',
    'организовать',
    'организует',
    'устанавливать',
    'соблюдать',
    'предоставлять',
    'принимать',
    'выплатить',
    'осуществлять',
    'заключить',
    'заключает',
    'уведомить',
    'уведомлять',
    'реализовать',
    'получать',
    'оформлять',
    'согласовывать',
    'информировать',
    'перечислить',
    'возместить',
    'возмещает',
    'компенсирует',
    'разместить',
    'провести',
    'назначить',
    'обеспечить',
    'освоить',
    'осуществить',
    'проходить',
    'пройти',
    'содействовать',
    'предпринять',
    'сохранять',
    'оплатить',
    'оплачивать',
    'уплачивать',
    'подписать',
    'сообщать',
    'проработать',
    'бережно относиться',
    'передать',
    'shall',
    'must',
    'undertakes',
    'transfers',
    'provides',
    'accepts',
    'returns',
    'required to',
    'agree to',
    'deve',
    'devera',
    'si impegna',
    'obbliga',
    'doit',
    'sera tenu',
    'est tenu',
  ],
  carryLead: [
    'следующие обязательства',
    'следующие обязанности',
    'обязан:',
    'обязуется:',
    'обязанности:',
    'shall:',
    'must:',
    'undertakes:',
  ],
  payment: [
    'РѕРїР»Р°С‚',
    'РІРѕР·РЅР°РіСЂР°Р¶Рґ',
    'С†РµРЅР°',
    'payment',
    'payments',
    'price',
    'invoice',
    'fee',
    'fees',
    'payable',
    'remuneration',
    'compenso',
    'corrispettivo',
    'facture',
    'paiement',
    'prix',
  ],
  deadlines: [
    'СЃСЂРѕРє',
    'РґРЅРµР№',
    'СЂР°Р±РѕС‡РёС… РґРЅРµР№',
    'deadline',
    'deadlines',
    'within',
    'days',
    'termine',
    'giorni',
    'delai',
    'jours',
    'entro',
    'no later than',
  ],
  exclude: [
    'не несет ответственности',
    'не несет материальной ответственности',
    'не отвечает',
    'освобождается от ответственности',
    'не подлежит ответственности',
    'имеет право',
    'вправе',
    'может',
    'право',
    'форс-мажор',
    'обстоятельства непреодолимой силы',
    'реквизиты',
    'подписи сторон',
    'инн',
    'кпп',
    'огрн',
    'юридический адрес',
    'банк',
    'расчетный счет',
  ],
  liability: [
    'РѕС‚РІРµС‚СЃС‚РІРµРЅ',
    'СѓР±С‹С‚',
    'С€С‚СЂР°С„',
    'РЅРµСѓСЃС‚РѕР№Рє',
    'liability',
    'penalty',
    'penalties',
    'damages',
    'responsabil',
    'penale',
    'indemn',
    'manleva',
    'danni',
    'dommages',
  ],
});

const roleBenefitMarkers = repairDeepStrings({
  liability: [
    'не несет ответственности',
    'не несет материальной ответственности',
    'не отвечает за',
    'не возмещает',
    'не отвечает',
    'освобождается от ответственности',
    'не подлежит ответственности',
    'вправе потребовать возмещения',
    'вправе потребовать',
    'вправе требовать',
    'имеет право требовать возмещения',
    'имеет право на возмещение',
    'требовать возмещения убытков',
    'вправе взыскать убытки',
    'shall not be liable',
    'is not liable',
    'not liable',
    'no liability',
    'without liability',
    'is not responsible',
    'shall have no liability',
    'non e responsabile',
    'senza responsabilita',
    'esente da responsabilita',
    'n est pas responsable',
    'sans responsabilite',
  ],
  penalties: [
    'не уплачивает штраф',
    'не уплачивает неустой',
    'не применяется штраф',
    'не применяется неустой',
    'вправе взыскать неустойку',
    'вправе требовать неустойку',
    'вправе требовать штраф',
    'вправе требовать уплаты штрафа',
    'имеет право на штраф',
    'without penalty',
    'no penalty',
    'penalty shall not apply',
    'not subject to penalty',
    'sans penalite',
    'senza penali',
    'non e soggetto a penali',
  ],
  unilateral: [
    'вправе в одностороннем порядке',
    'может в одностороннем порядке',
    'unilateral',
    'sole discretion',
    'at its discretion',
    'at its sole discretion',
    'may terminate',
    'may change',
    'facolta unilaterale',
    'a sua discrezione',
    'a son unique discretion',
  ],
});

const genericBenefitMarkers = repairDeepStrings({
  liability: [
    'требовать возмещения',
    'требовать возмещения стоимости',
    'требовать возмещения убытков',
    'потребовать возмещения',
    'получить возмещение',
    'взыскать убытки',
  ],
  penalties: [
    'требовать уплаты штрафа',
    'требовать уплаты неустойки',
    'взыскать неустойку',
    'взыскать штраф',
    'получить неустойку',
  ],
});

const hybridSignals = repairDeepStrings({
  preciseTimeline: [
    'календарных дней',
    'рабочих дней',
    'банковских дней',
    'месяц',
    'месяца',
    'дней',
    'days',
    'business days',
    'calendar days',
    'giorni',
    'jours',
  ],
  acceptanceSupport: [
    'приемк',
    'сдач',
    'результат',
    'замечан',
    'критери',
    'подписани',
    'подтвержд',
    'акт прием',
    'акт сдач',
    'оказан услуг',
    'acceptance',
    'sign-off',
    'completion',
    'confirmed',
    'in writing',
    'deliverable',
    'collaudo',
    'acceptation',
  ],
  acceptanceNegative: [
    'прием на обучение',
    'прием на работу',
    'образовательн',
    'обучени',
    'учеб',
    'стипенд',
    'успеваем',
    'приложени',
    'неотъемлемой частью',
    'перечень документов',
    'практическ',
    'автомобил',
    'квартир',
    'помещен',
    'имуществ',
    'аренд',
    'найм',
    'sublease',
  ],
  acceptanceClarity: [
    'мотивированн',
    'мотивированный отказ',
    'письменный отказ',
    'перечень недостат',
    'срок устран',
    'замечан',
    'критери',
    'в течение',
    'рабочих дней',
    'календарных дней',
    'подписать акт',
    'подписывает акт',
    'подписания сторонами',
    'подписанный сторонами',
    'подписывается сторонами',
    'сторонами акта',
    'по наименованию',
    'по количеству',
    'ассортименту',
    'качеству',
    'товаросопроводительн',
    'сертификат',
    'гост',
    'ту',
    'обоснованную претензию',
    'коммерческим актом',
    'комисси',
    'создать комиссию',
    'комиссию для приемки',
    'акт выполненных работ',
    'проверка качества',
    'подписываемом представителями',
    'двусторонний акт',
  ],
  acceptanceEscalation: [
    'одностороннем порядке',
    'имеет силу двустороннего',
    'считаются сданными',
    'считаются выполненными',
    'подписанный исполнителем',
    'подписанным исполнителем',
    'при отсутствии мотивированного отказа',
    'если заказчик не представил',
  ],
  acceptanceTransfer: [
    'товар',
    'товара',
    'товаров',
    'автомобил',
    'квартир',
    'помещен',
    'имуществ',
    'комплектац',
    'приемка товара',
    'акт приема-передачи автомобиля',
    'акт приема-передачи документации',
    'документац',
    'документ',
    'товаросопроводительн',
    'по наименованию',
    'по количеству',
    'ассортименту',
    'качеству',
  ],
  penaltySupport: [
    'штраф',
    'неустой',
    'пени',
    'санкц',
    'liquidated damages',
    'penalty',
    'fine',
    'forfeit',
    'penale',
    'penalite',
  ],
  penaltyTrigger: [
    'уплачивает штраф',
    'выплачивает штраф',
    'уплачивает пени',
    'оплачивает пени',
    'уплачивает неустой',
    'выплачивает неустой',
    'применяются пени',
    'применяется неустой',
    'пени начисляются',
    'пеня в размере',
    'пени в размере',
    'неустойка в размере',
    'штраф в размере',
    'за каждый день',
    '% от',
    'liable to pay',
    'subject to penalty',
    'pay a penalty',
    'penalties apply',
    'penalty of',
    'liquidated damages of',
    'liquidated damages apply',
  ],
  liabilitySupport: [
    'ответственност',
    'убыт',
    'возмещ',
    'компенсац',
    'indemn',
    'liability',
    'damages',
    'responsabil',
  ],
  liabilityHard: ['убыт', 'возмещ', 'компенсац', 'ущерб', 'indemn', 'damages'],
  unilateralSupport: [
    'односторон',
    'sole discretion',
    'at its discretion',
    'may terminate',
    'may change',
    'a sua discrezione',
  ],
  unilateralChange: [
    'измен',
    'расторг',
    'прекрат',
    'увелич',
    'уменьш',
    'продл',
    'приостан',
    'перенос',
    'change',
    'terminate',
    'suspend',
    'extend',
  ],
  unilateralRemedial: [
    'при просрочке',
    'в случае просрочки',
    'при нарушении',
    'в случае нарушения',
    'при неисполнении',
    'в случае неисполнения',
    'при невыполнении',
    'в случае невыполнения',
    'при неоплате',
    'при отсутствии оплаты',
    'при задержке платежа',
    'в случае задержки платежа',
    'при отсутствии полной оплаты',
    'в случае отсутствия полной оплаты',
    'если заказчик не',
    'if payment is overdue',
    'in case of breach',
    'upon breach',
    'if the customer fails',
  ],
  unilateralNegative: [
    'не допускается',
    'не вправе',
    'не может в одностороннем порядке',
    'односторонний отказ не допускается',
    'одностороннее изменение не допускается',
    'одностороннее расторжение не допускается',
    'запрещается',
    'shall not unilaterally',
    'may not unilaterally',
    'not permitted unilaterally',
  ],
  autoRenewalSupport: [
    'automatic renewal',
    'renews automatically',
    'renewed automatically',
    'tacit renewal',
    'автоматическ',
    'пролонгац',
    'подлежит безусловной пролонгации',
    'подлежит пролонгации',
    'срок договора продлевается самостоятельно',
    'считается продленным',
    'считается возобновленным',
    'считается пролонгированным',
  ],
  roleAction: [
    'обязан',
    'обязуется',
    'должен',
    'вправе',
    'может',
    'оплачивает',
    'уплачивает',
    'выплачивает',
    'поручает',
    'обеспечивает',
    'организует',
    'исполняет',
    'заключает',
    'перечисляет',
    'компенсирует',
    'возмещает',
    'несет',
    'несут',
    'отвечает',
    'отвечают',
    'передает',
    'предоставляет',
    'принимает',
    'принимает на себя',
    'shall',
    'must',
    'undertakes',
    'may',
    'pays',
  ],
  liabilityAggravating: [
    'полную материальную ответственность',
    'полная материальная ответственность',
    'в полном объеме',
    'все убытки',
    'в полном размере',
    'упущенн',
    'любой ущерб',
    'утраченн',
    'возмещает убытки',
    'компенсирует убытки',
    'суммы штрафных и иных санкций',
    'штрафных и иных санкций',
    'compensate all losses',
    'all losses',
    'any damages',
    'full liability',
    'unlimited liability',
  ],
  liabilityNeutral: [
    'в соответствии с законодательством',
    'согласно законодательству',
    'в соответствии с действующим законодательством',
    'несут ответственность в соответствии с законодательством',
    'несут ответственность согласно',
    'освобождаются от ответственности',
    'не несет ответственности',
    'не несет материальной ответственности',
    'не отвечает за',
    'форс-мажор',
    'обстоятельства непреодолимой силы',
    'liable in accordance with law',
    'in accordance with applicable law',
    'not liable',
    'force majeure',
  ],
  futureAgreementEssential: [
    'цена',
    'стоимость',
    'количеств',
    'ассортимент',
    'срок',
    'сроки',
    'объем',
    'критерии приемки',
    'приемк',
    'тариф',
    'порядок оплаты',
    'оплат',
    'price',
    'quantity',
    'term',
    'deadline',
    'payment',
    'sla',
  ],
  futureAgreementOpenEnded: [
    'будет определ',
    'будут определ',
    'определяется сторонами',
    'определяется по соглашению',
    'устанавливается сторонами',
    'согласовывается сторонами',
    'будет согласован',
    'будут согласованы',
    'подлежит согласованию',
    'оформляется дополнительным соглашением',
    'согласуется дополнительным соглашением',
    'в дополнительном соглашении',
    'по отдельному соглашению',
    'отдельно согласован',
    'отдельно оговорен',
    'to be agreed',
    'to be determined',
    'will be agreed',
    'shall be agreed',
    'will be determined',
    'shall be determined',
    'in an additional agreement',
    'in a separate agreement',
    'subject to separate agreement',
    'by separate appendix',
    'in a separate appendix',
  ],
  futureAgreementAmendment: [
    'может измениться',
    'может быть изменен',
    'может быть изменена',
    'может быть изменено',
    'изменяется по соглашению сторон',
    'изменяется по согласованию сторон',
    'по обоюдному согласию',
    'по взаимному согласию',
    'по согласованию с',
    'по соглашению сторон',
    'корректируется по соглашению',
    'may be changed by agreement of the parties',
    'by mutual written agreement',
    'by written agreement',
  ],
  futureAgreementFramework: [
    'регламент',
    'приложени',
    'протокол согласования',
    'дополнительн соглашен',
    'оформляется дополнительным соглашением',
    'согласуется дополнительным соглашением',
    'форма заявки',
    'по заявк',
    'календарн план',
    'перечень работ',
    'technical appendix',
    'schedule',
    'appendix',
    'annex',
    'statement of work',
  ],
  futureAgreementRoutine: [
    'отпуск',
    'график отпуск',
    'согласован с работник',
    'согласованной с работник',
    'по заявлению работника',
    'перенести отпуск',
    'дата отпуска',
  ],
});

const riskRules: RiskRule[] = repairDeepStrings([
  {
    id: 'unilateral',
    severity: 'high',
    keywords: [
      'РѕРґРЅРѕСЃС‚РѕСЂРѕРЅ',
      'unilateral',
      'sole discretion',
      'at its discretion',
      'may change',
      'may terminate',
      'facolta unilaterale',
      'risoluzione unilaterale',
      'resiliation unilaterale',
      'sua sola discrezione',
      'ad sua discrezione',
    ],
    title: {
      ru: 'РћРґРЅРѕСЃС‚РѕСЂРѕРЅРЅРµРµ РёР·РјРµРЅРµРЅРёРµ РёР»Рё СЂР°СЃС‚РѕСЂР¶РµРЅРёРµ',
      en: 'Unilateral change or termination',
      it: 'Modifica o risoluzione unilaterale',
      fr: 'Modification ou resiliation unilaterale',
    },
    description: {
      ru: 'РќР°Р№РґРµРЅР° С„РѕСЂРјСѓР»РёСЂРѕРІРєР°, РїРѕР·РІРѕР»СЏСЋС‰Р°СЏ РѕРґРЅРѕР№ СЃС‚РѕСЂРѕРЅРµ РјРµРЅСЏС‚СЊ СѓСЃР»РѕРІРёСЏ РёР»Рё РїСЂРµРєСЂР°С‰Р°С‚СЊ РґРѕРіРѕРІРѕСЂ Р±РµР· СЃРёРјРјРµС‚СЂРёС‡РЅС‹С… РіР°СЂР°РЅС‚РёР№.',
      en: 'A clause allows one party to change terms or terminate the contract without symmetric safeguards.',
      it: 'Una clausola consente a una parte di modificare termini o risolvere il contratto senza garanzie simmetriche.',
      fr: 'Une clause permet a une partie de modifier les conditions ou de resilier sans garanties symetriques.',
    },
    recommendation: {
      ru: 'Р—Р°РєСЂРµРїРёС‚Рµ РґРІСѓСЃС‚РѕСЂРѕРЅРЅРµРµ СЃРѕРіР»Р°СЃРѕРІР°РЅРёРµ СЃСѓС‰РµСЃС‚РІРµРЅРЅС‹С… РёР·РјРµРЅРµРЅРёР№ Рё РѕРґРёРЅР°РєРѕРІС‹Р№ СЃСЂРѕРє СѓРІРµРґРѕРјР»РµРЅРёСЏ РґР»СЏ РѕР±РµРёС… СЃС‚РѕСЂРѕРЅ.',
      en: 'Require bilateral approval for material changes and the same notice period for both parties.',
      it: 'Richiedere approvazione bilaterale per modifiche rilevanti e lo stesso preavviso per entrambe le parti.',
      fr: 'Exiger un accord bilaterale pour les changements materiels et le meme preavis pour les deux parties.',
    },
  },
  {
    id: 'penalties',
    severity: 'high',
    keywords: [
      'С€С‚СЂР°С„',
      'РЅРµСѓСЃС‚РѕР№Рє',
      'penalty',
      'liquidated damages',
      'sanction',
      'penale',
      'penalite',
      'sanzion',
      'moratory',
    ],
    title: {
      ru: 'РЁС‚СЂР°С„С‹ Рё СЃР°РЅРєС†РёРё',
      en: 'Penalties and sanctions',
      it: 'Penali e sanzioni',
      fr: 'Penalites et sanctions',
    },
    description: {
      ru: 'РћР±РЅР°СЂСѓР¶РµРЅРѕ СѓСЃР»РѕРІРёРµ Рѕ С€С‚СЂР°С„Р°С…, РЅРµСѓСЃС‚РѕР№РєРµ РёР»Рё РёРЅС‹С… СЃР°РЅРєС†РёСЏС….',
      en: 'A penalty, liquidated damages, or similar sanction clause was detected.',
      it: 'E stata rilevata una clausola su penali, danni liquidati o sanzioni simili.',
      fr: 'Une clause de penalite, dommages forfaitaires ou sanction similaire a ete detectee.',
    },
    recommendation: {
      ru: 'РџСЂРѕРІРµСЂСЊС‚Рµ Р»РёРјРёС‚С‹, РѕСЃРЅРѕРІР°РЅРёСЏ РЅР°С‡РёСЃР»РµРЅРёСЏ Рё СЃРѕСЂР°Р·РјРµСЂРЅРѕСЃС‚СЊ СЃР°РЅРєС†РёР№.',
      en: 'Review caps, trigger conditions, and proportionality of penalties.',
      it: 'Verificare limiti, condizioni di applicazione e proporzionalita delle penali.',
      fr: 'Verifier plafonds, conditions de declenchement et proportionnalite des penalites.',
    },
  },
  {
    id: 'liability',
    severity: 'medium',
    keywords: [
      'РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚',
      'liability',
      'indemn',
      'РІРѕР·РјРµС‰РµРЅ',
      'manleva',
      'responsabil',
      'indemni',
      'damages',
      'danni',
      'dommages',
    ],
    title: {
      ru: 'РћС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚СЊ Рё РІРѕР·РјРµС‰РµРЅРёРµ СѓР±С‹С‚РєРѕРІ',
      en: 'Liability and indemnification',
      it: 'Responsabilita e manleva',
      fr: 'Responsabilite et indemnisation',
    },
    description: {
      ru: 'Р’ РґРѕРіРѕРІРѕСЂРµ РµСЃС‚СЊ СѓСЃР»РѕРІРёСЏ РѕР± РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚Рё, СѓР±С‹С‚РєР°С… РёР»Рё РІРѕР·РјРµС‰РµРЅРёРё.',
      en: 'The contract contains liability, damages, or indemnification language.',
      it: 'Il contratto contiene clausole su responsabilita, danni o manleva.',
      fr: 'Le contrat contient des clauses sur la responsabilite, les dommages ou l indemnisation.',
    },
    recommendation: {
      ru: 'РЈС‚РѕС‡РЅРёС‚Рµ Р»РёРјРёС‚С‹ РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚Рё, РёСЃРєР»СЋС‡РµРЅРёСЏ Рё СЃРѕР±С‹С‚РёСЏ, Р·Р°РїСѓСЃРєР°СЋС‰РёРµ РєРѕРјРїРµРЅСЃР°С†РёСЋ.',
      en: 'Clarify liability caps, exclusions, and triggering events for compensation.',
      it: 'Chiarire limiti di responsabilita, esclusioni ed eventi che attivano la compensazione.',
      fr: 'Preciser les plafonds de responsabilite, exclusions et evenements declencheurs.',
    },
  },
  {
    id: 'acceptance',
    severity: 'medium',
    keywords: [
      'РїСЂРёРµРјРє',
      'Р°РєС‚ РїСЂРёРµРј',
      'Р°РєС‚ СЃРґР°С‡',
      'Р°РєС‚ РѕРєР°Р·Р°РЅ',
      'РїРѕРґРїРёСЃР°РЅРё Р°РєС‚',
      'РїРѕРґС‚РІРµСЂР¶РґРµРЅРё РСЂРµР·СѓР»СЊС‚Р°С‚',
      'acceptance',
      'sign-off',
      'sign off',
      'collaudo',
      'acceptation',
      'recette',
    ],
    title: {
      ru: 'РќРµСЏСЃРЅР°СЏ РїСЂРёРµРјРєР° СЂРµР·СѓР»СЊС‚Р°С‚Р°',
      en: 'Unclear acceptance process',
      it: 'Procedura di accettazione poco chiara',
      fr: 'Procedure d acceptation peu claire',
    },
    description: {
      ru: 'РќР°С€Р»РёСЃСЊ С„РѕСЂРјСѓР»РёСЂРѕРІРєРё Рѕ РїСЂРёРµРјРєРµ, РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРё СЂРµР·СѓР»СЊС‚Р°С‚Р° РёР»Рё РїРѕРґРїРёСЃР°РЅРёРё Р°РєС‚РѕРІ.',
      en: 'Acceptance, sign-off, or completion confirmation language was detected.',
      it: 'Sono state rilevate formule su accettazione, collaudo o conferma del risultato.',
      fr: 'Des formulations sur l acceptation, la recette ou la confirmation du resultat ont ete detectees.',
    },
    recommendation: {
      ru: 'Р”РѕР±Р°РІСЊС‚Рµ РёР·РјРµСЂРёРјС‹Рµ РєСЂРёС‚РµСЂРёРё РїСЂРёРµРјРєРё Рё СЃСЂРѕРє РѕС‚РІРµС‚Р° РЅР° Р·Р°РјРµС‡Р°РЅРёСЏ.',
      en: 'Define measurable acceptance criteria and a deadline for comments.',
      it: 'Definire criteri misurabili di accettazione e un termine per le osservazioni.',
      fr: 'Definir des criteres d acceptation mesurables et un delai de reponse aux remarques.',
    },
  },
  {
    id: 'auto-renewal',
    severity: 'medium',
    keywords: [
      'automatic renewal',
      'auto-renewal',
      'renews automatically',
      'tacit renewal',
      'renouvellement automatique',
      'rinnovo automatico',
      'proroga automatica',
      'renewed automatically',
    ],
    title: {
      ru: 'РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ РїСЂРѕРґР»РµРЅРёРµ',
      en: 'Automatic renewal',
      it: 'Rinnovo automatico',
      fr: 'Renouvellement automatique',
    },
    description: {
      ru: 'РћР±РЅР°СЂСѓР¶РµРЅРѕ СѓСЃР»РѕРІРёРµ РѕР± Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРј РїСЂРѕРґР»РµРЅРёРё РёР»Рё РїСЂРѕР»РѕРЅРіР°С†РёРё.',
      en: 'An automatic renewal or rollover clause was detected.',
      it: 'E stata rilevata una clausola di rinnovo o proroga automatica.',
      fr: 'Une clause de renouvellement ou prorogation automatique a ete detectee.',
    },
    recommendation: {
      ru: 'Р—Р°С„РёРєСЃРёСЂСѓР№С‚Рµ СЃСЂРѕРє СѓРІРµРґРѕРјР»РµРЅРёСЏ РѕР± РѕС‚РєР°Р·Рµ РѕС‚ РїСЂРѕРґР»РµРЅРёСЏ Рё РїРѕСЃР»РµРґСЃС‚РІРёСЏ РјРѕР»С‡Р°РЅРёСЏ.',
      en: 'Specify the opt-out notice period and the consequences of silence.',
      it: 'Specificare il preavviso di disdetta e le conseguenze del silenzio.',
      fr: 'Preciser le preavis de non-renouvellement et les consequences du silence.',
    },
  },
]);

const disputeMarkers: DisputeMarker[] = repairDeepStrings([
  {
    id: 'future-agreement',
    markers: [
      'РїРѕ СЃРѕРіР»Р°С€РµРЅРёСЋ СЃС‚РѕСЂРѕРЅ',
      'дополнительным соглашением',
      'в дополнительном соглашении',
      'будет согласован',
      'будут согласованы',
      'подлежит согласованию',
      'определяется по соглашению',
      'to be agreed',
      'to be determined',
      'in an additional agreement',
      'in a separate agreement',
      'в срок, согласованный с',
      'в сроки, оговоренные сторонами',
      'обоюдным решением',
      'по выбору сторон',
      'by agreement of the parties',
      'mutual agreement',
      'di comune accordo',
      'd un commun accord',
      'previo accordo',
      'a common accord',
    ],
    reason: {
      ru: 'РЈСЃР»РѕРІРёРµ Р·Р°РІРёСЃРёС‚ РѕС‚ Р±СѓРґСѓС‰РµРіРѕ СЃРѕРіР»Р°С€РµРЅРёСЏ СЃС‚РѕСЂРѕРЅ Рё РЅРµ С„РёРєСЃРёСЂСѓРµС‚ С‡РµС‚РєРёР№ РїРѕСЂСЏРґРѕРє РёСЃРїРѕР»РЅРµРЅРёСЏ.',
      en: 'The clause depends on future agreement between the parties and leaves execution mechanics undefined.',
      it: 'La clausola dipende da un accordo futuro tra le parti e non fissa una procedura chiara.',
      fr: 'La clause depend d un accord futur des parties et ne fixe pas de mecanisme d execution clair.',
    },
    suggestion: {
      ru: 'Р—Р°РєСЂРµРїРёС‚Рµ С‚РѕС‡РЅС‹Р№ РїРѕСЂСЏРґРѕРє, СЃСЂРѕРєРё Рё РѕС‚РІРµС‚СЃС‚РІРµРЅРЅС‹С… Р»РёС† РїСЂСЏРјРѕ РІ С‚РµРєСЃС‚Рµ РґРѕРіРѕРІРѕСЂР°.',
      en: 'Specify the exact workflow, deadlines, and responsible persons directly in the contract.',
      it: 'Specificare nel contratto procedura, termini e soggetti responsabili.',
      fr: 'Preciser dans le contrat la procedure, les delais et les responsables.',
    },
  },
  {
    id: 'reasonable-time',
    markers: [
      'СЂР°Р·СѓРјРЅС‹Р№ СЃСЂРѕРє',
      'reasonable time',
      'reasonable efforts',
      'termine ragionevole',
      'delai raisonnable',
      'dans un delai raisonnable',
      'dans les meilleurs delais',
    ],
    reason: {
      ru: 'РЈРєР°Р·Р°РЅ СЃСѓР±СЉРµРєС‚РёРІРЅС‹Р№ СЃСЂРѕРє Р±РµР· С‚РѕС‡РЅРѕР№ РіСЂР°РЅРёС†С‹.',
      en: 'A subjective timeline is used without a precise limit.',
      it: 'Viene usato un termine soggettivo senza limite preciso.',
      fr: 'Un delai subjectif est utilise sans limite precise.',
    },
    suggestion: {
      ru: 'Р—Р°РјРµРЅРёС‚Рµ С„РѕСЂРјСѓР»РёСЂРѕРІРєСѓ РЅР° РєРѕРЅРєСЂРµС‚РЅРѕРµ С‡РёСЃР»Рѕ СЂР°Р±РѕС‡РёС… РёР»Рё РєР°Р»РµРЅРґР°СЂРЅС‹С… РґРЅРµР№.',
      en: 'Replace the wording with a concrete number of business or calendar days.',
      it: 'Sostituire la formula con un numero preciso di giorni lavorativi o di calendario.',
      fr: 'Remplacer la formule par un nombre precis de jours ouvrables ou calendaires.',
    },
  },
  {
    id: 'discretionary-right',
    markers: [
      'РїРѕ СЃРІРѕРµРјСѓ СѓСЃРјРѕС‚СЂРµРЅРёСЋ',
      'РїРѕ СЃРѕР±СЃС‚РІРµРЅРЅРѕРјСѓ СѓСЃРјРѕС‚СЂРµРЅРёСЋ',
      'РЅР° СЃРІРѕРµ СѓСЃРјРѕС‚СЂРµРЅРёРµ',
      'may at its discretion',
      'sole discretion',
      'at its sole discretion',
      'a sua discrezione',
      'a son unique discretion',
    ],
    reason: {
      ru: 'РћРґРЅР° РёР· СЃС‚РѕСЂРѕРЅ РїРѕР»СѓС‡РёР»Р° РґРёСЃРєСЂРµС†РёРѕРЅРЅРѕРµ РїСЂР°РІРѕ Р±РµР· РґРѕСЃС‚Р°С‚РѕС‡РЅС‹С… РѕРіСЂР°РЅРёС‡РµРЅРёР№.',
      en: 'One party received a discretionary right without sufficient boundaries.',
      it: 'Una delle parti ha ottenuto un diritto discrezionale senza limiti sufficienti.',
      fr: 'Une partie dispose d un droit discretionnaire sans limites suffisantes.',
    },
    suggestion: {
      ru: 'РћРіСЂР°РЅРёС‡СЊС‚Рµ С‚Р°РєРѕРµ РїСЂР°РІРѕ РєСЂРёС‚РµСЂРёСЏРјРё, СЃСЂРѕРєР°РјРё Рё РѕР±СЏР·Р°С‚РµР»СЊРЅС‹Рј СѓРІРµРґРѕРјР»РµРЅРёРµРј РґСЂСѓРіРѕР№ СЃС‚РѕСЂРѕРЅС‹.',
      en: 'Limit the right with objective criteria, deadlines, and mandatory notice to the counterparty.',
      it: 'Limitare tale diritto con criteri oggettivi, termini e notifica obbligatoria alla controparte.',
      fr: 'Encadrer ce droit par des criteres objectifs, des delais et une notification obligatoire.',
    },
  },
]);

const contractTypeDetectors: Record<string, string[]> = repairDeepStrings({
  services: [
    'услуг',
    'оказания услуг',
    'service agreement',
    'services agreement',
    'statement of work',
    'master services',
    'prestation de services',
    'contratto di servizi',
    'fornitura servizi',
  ],
  employment: [
    'трудов',
    'работодател',
    'работник',
    'ученическ',
    'коллективн',
    'employee',
    'employment',
    'lavoro subordinato',
    'contrat de travail',
    'contratto di lavoro',
  ],
  agency: [
    'агентск',
    'агент',
    'принципал',
    'субагент',
    'агентское вознаграждение',
    'agency agreement',
    'agent agreement',
    'principal',
  ],
  nda: [
    'конфиденен',
    'коммерческ тайн',
    'non-disclosure',
    'non disclosure',
    'nda',
    'riservatezza',
    'confidentialite',
    'confidentiality',
  ],
  loan: ['займ', 'заем', 'заимодав', 'заемщик', 'loan agreement', 'borrower', 'lender'],
  cession: [
    'цесс',
    'уступк',
    'цедент',
    'цессионар',
    'assignment of claim',
    'assignment agreement',
    'cession',
    'assignor',
    'assignee',
  ],
  supply: [
    'поставк',
    'товар',
    'supply',
    'delivery',
    'fornitura',
    'fourniture',
    'sales agreement',
    'purchase agreement',
  ],
  rent: [
    'аренд',
    'арендатор',
    'арендодатель',
    'найм',
    'нанимател',
    'наймодатель',
    'lease agreement',
    'leasing',
    'locazione',
    'bail',
  ],
  contractWork: [
    'подряд',
    'подрядчик',
    'строительств',
    'ремонт',
    'монтаж',
    'смет',
    'work result',
    'contract work',
    'appalto',
    'entreprise',
    'contratto d opera',
    'contrat d entreprise',
  ],
});

const normalizeLanguage = (language?: SupportedLanguage): SupportedLanguage => {
  return language && localizedStrings[language] ? language : defaultLanguage;
};

const tokenizeSearchText = (input: string): string[] => {
  return uniqueStrings(
    normalizeSearchText(input)
      .split(/[^\p{L}\p{N}]+/gu)
      .map((token) => token.trim())
      .filter(Boolean),
  );
};

const countMatches = (normalizedText: string, markers: string[]): number => {
  return markers.reduce((total, marker) => {
    const normalizedMarker = normalizeSearchText(marker);
    if (!normalizedMarker) {
      return total;
    }

    return total + (normalizedText.includes(normalizedMarker) ? 1 : 0);
  }, 0);
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findMarkerPositions = (normalizedText: string, markers: string[]): number[] => {
  const positions: number[] = [];

  for (const marker of markers) {
    const normalizedMarker = normalizeSearchText(marker);
    if (!normalizedMarker) {
      continue;
    }

    let searchIndex = 0;
    while (searchIndex < normalizedText.length) {
      const matchIndex = normalizedText.indexOf(normalizedMarker, searchIndex);
      if (matchIndex < 0) {
        break;
      }

      positions.push(matchIndex);
      searchIndex = matchIndex + normalizedMarker.length;
    }
  }

  return positions.sort((left, right) => left - right);
};

const hasNearbyMarkers = (
  normalizedText: string,
  roleTerms: string[],
  markers: string[],
  maxDistance = 96,
): boolean => {
  const rolePositions = findMarkerPositions(normalizedText, roleTerms);
  if (rolePositions.length === 0) {
    return false;
  }

  const markerPositions = findMarkerPositions(normalizedText, markers);
  if (markerPositions.length === 0) {
    return false;
  }

  return markerPositions.some((markerPosition) =>
    rolePositions.some((rolePosition) => Math.abs(rolePosition - markerPosition) <= maxDistance),
  );
};

const hasLeadingRoleMarker = (
  normalizedText: string,
  roleTerms: string[],
  markers: string[],
  maxDistance = 96,
): boolean => {
  const rolePositions = findMarkerPositions(normalizedText, roleTerms);
  if (rolePositions.length === 0) {
    return false;
  }

  const markerPositions = findMarkerPositions(normalizedText, markers);
  if (markerPositions.length === 0) {
    return false;
  }

  return markerPositions.some((markerPosition) =>
    rolePositions.some(
      (rolePosition) =>
        rolePosition <= markerPosition && markerPosition - rolePosition <= maxDistance,
    ),
  );
};

const splitClauseIntoFragments = (text: string): string[] => {
  const prepared = normalizeExtractedText(text)
    .replace(/\r/g, '\n')
    .replace(
      /(?<=[\p{Lu}\s]{6,})(?=\p{Lu}\p{Ll}{2,}\s+(?:обязан|обязуется|вправе|должен|shall|must|undertakes|may)\b)/gu,
      '\n',
    )
    .replace(
      /((?:обязан(?:а|ы)?|обязуется|должен(?:а|ы)?|вправе|shall|must|undertakes|may)):\s*(?=[\p{L}\d])/giu,
      '$1:\n',
    )
    .replace(/([:.;])(?=(?:\d+(?:\.\d+){1,5}[.)]?)(?:\s|\p{Lu}))/gu, '$1\n')
    .replace(
      /((?:(?:clause|section|article|пункт|раздел)\s+)?\d+(?:\.\d+){1,5}[.)]?)(?=\p{Lu})/giu,
      '$1\n',
    )
    .replace(/([.!?])\s+(?=\p{Lu})/gu, '$1\n')
    .replace(
      /([.!?])\s+((?:(?:clause|section|article|пункт|раздел)\s+)?\d+(?:\.\d+){0,5}[.)]?)(?=\s+\p{Lu})/gu,
      '$1\n$2',
    )
    .replace(
      /\s+((?:(?:clause|section|article|пункт|раздел)\s+)?\d+(?:\.\d+){0,5}[.)]?)(?=\s+\p{Lu})/gu,
      '\n$1',
    );

  return prepared
    .split(/\n+|[;\u2022]+/u)
    .map((fragment) => normalizeExtractedText(fragment))
    .filter(Boolean);
};

const getClauseFragments = (text: string): string[] => {
  const fragments = splitClauseIntoFragments(text);
  return fragments.length > 0 ? fragments : [normalizeExtractedText(text)].filter(Boolean);
};

const isContinuationListFragment = (fragment: string): boolean => {
  return /^(?:\(?[a-zа-яё]\)|\d+(?:\.\d+)*[.)]|[-–—*])\s*/iu.test(fragment);
};

const isActionLikeContinuation = (fragment: string, normalizedText: string): boolean => {
  return (
    isContinuationListFragment(fragment) ||
    countMatches(normalizedText, summaryMarkers.obligations) > 0
  );
};

const isForeignRoleLeadFragment = (
  fragment: string,
  normalizedText: string,
  roleTerms: string[],
): boolean => {
  if (countMatches(normalizedText, roleTerms) > 0 && hasRoleActionLead(normalizedText, roleTerms)) {
    return false;
  }

  return /^\s*(?:\d+(?:\.\d+)*[.)]?\s*)?(?:[A-Za-zА-ЯЁ][A-Za-zА-Яа-яЁё-]{2,}(?:\s+[A-Za-zА-Яа-яЁё-]{2,}){0,2})\s+(?:обязан(?:а|ы)?|обязуется|должен(?:а|ы)?|shall|must|undertakes)\b/iu.test(
    fragment,
  );
};

const hasRoleActionLead = (normalizedText: string, roleTerms: string[]): boolean => {
  const rolePositions = findMarkerPositions(normalizedText, roleTerms);
  if (rolePositions.length === 0) {
    return false;
  }

  const actionPositions = findMarkerPositions(normalizedText, hybridSignals.roleAction);
  if (actionPositions.length === 0) {
    return false;
  }

  return rolePositions.some((rolePosition) => {
    if (rolePosition > 72) {
      return false;
    }

    const boundaryPrefix = normalizedText.slice(Math.max(0, rolePosition - 20), rolePosition);
    const hasStrongBoundary =
      rolePosition === 0 ||
      /(?:^|[.;:!?,]\s*|[-–—*]\s*|\d+(?:\.\d+)*[.)]?\s*|(?:clause|section|article|пункт|раздел)\s+\d+(?:\.\d+)*[.)]?\s*)$/iu.test(
        boundaryPrefix,
      );
    if (!hasStrongBoundary) {
      return false;
    }

    return actionPositions.some(
      (actionPosition) => actionPosition >= rolePosition && actionPosition - rolePosition <= 96,
    );
  });
};

const isRoleLeadFragment = (
  fragment: string,
  normalizedText: string,
  roleTerms: string[],
): boolean => {
  if (countMatches(normalizedText, roleTerms) <= 0) {
    return false;
  }

  if (!hasRoleActionLead(normalizedText, roleTerms)) {
    return false;
  }

  if (countMatches(normalizedText, summaryMarkers.obligations) <= 0) {
    return false;
  }

  const compactLead = trimClauseLead(fragment).replace(/:\s*$/u, '').trim();
  if (!compactLead) {
    return false;
  }

  const compactLeadTokenCount = compactLead.split(/\s+/u).filter(Boolean).length;
  if (compactLead.length > 88 || compactLeadTokenCount > 10) {
    return false;
  }

  return /:\s*$/u.test(fragment) || countMatches(normalizedText, summaryMarkers.carryLead) > 0;
};

const scoreLine = (line: string, markers: string[], prioritizedTerms: string[]): number => {
  const normalized = normalizeSearchText(line);
  const markerScore = countMatches(normalized, markers) * 3;
  const prioritizedScore = countMatches(normalized, prioritizedTerms) * 2;
  return markerScore + prioritizedScore;
};

const hasExplicitNumericSignal = (text: string): boolean => /\b\d+(?:[.,]\d+)?\b/u.test(text);

const hasMonetarySignal = (text: string): boolean =>
  /(?:\b\d[\d\s.,]*\s*(?:руб|рубл|₽|%|percent|eur|usd|€|\$)\b)|(?:\b\d[\d\s.,]*\s*(?:тыс|млн)\b)/iu.test(
    text,
  );

const scoreRiskContext = (
  ruleId: string,
  normalizedText: string,
  excerpt: string,
  roleTerms: string[],
): number => {
  const roleHits = countMatches(normalizedText, roleTerms);
  const actionHits = countMatches(normalizedText, hybridSignals.roleAction);
  const roleActsAsSubject = roleHits > 0 && hasRoleActionLead(normalizedText, roleTerms);

  switch (ruleId) {
    case 'acceptance': {
      const supportHits = countMatches(normalizedText, hybridSignals.acceptanceSupport);
      const negativeHits = countMatches(normalizedText, hybridSignals.acceptanceNegative);
      const clarityHits = countMatches(normalizedText, hybridSignals.acceptanceClarity);
      const escalationHits = countMatches(normalizedText, hybridSignals.acceptanceEscalation);
      const transferHits = countMatches(normalizedText, hybridSignals.acceptanceTransfer);
      return (
        supportHits * 3 +
        escalationHits * 5 +
        actionHits +
        (hasExplicitNumericSignal(excerpt) ? 1 : 0) -
        negativeHits * 4 -
        clarityHits * 5 -
        transferHits * 3
      );
    }
    case 'penalties': {
      const supportHits = countMatches(normalizedText, hybridSignals.penaltySupport);
      const triggerHits = countMatches(normalizedText, hybridSignals.penaltyTrigger);
      const roleScore = roleActsAsSubject
        ? roleHits
        : roleHits > 0
          ? -Math.min(roleHits * 2, 4)
          : actionHits > 0
            ? -6
            : 0;
      return (
        supportHits * 4 +
        triggerHits * 3 +
        (hasMonetarySignal(excerpt) ? 3 : 0) +
        (hasExplicitNumericSignal(excerpt) ? 1 : 0) +
        roleScore
      );
    }
    case 'liability': {
      const supportHits = countMatches(normalizedText, hybridSignals.liabilitySupport);
      const aggravatingHits = countMatches(normalizedText, hybridSignals.liabilityAggravating);
      const hardHits = countMatches(normalizedText, hybridSignals.liabilityHard);
      const neutralHits = countMatches(normalizedText, hybridSignals.liabilityNeutral);
      const roleScore = roleActsAsSubject
        ? roleHits
        : roleHits > 0
          ? -Math.min(roleHits * 2, 4)
          : actionHits > 0
            ? -5
            : 0;
      return (
        supportHits * 2 +
        aggravatingHits * 5 +
        hardHits * 4 +
        actionHits +
        (hasMonetarySignal(excerpt) ? 2 : 0) +
        roleScore -
        neutralHits * 4
      );
    }
    case 'unilateral': {
      const supportHits = countMatches(normalizedText, hybridSignals.unilateralSupport);
      const changeHits = countMatches(normalizedText, hybridSignals.unilateralChange);
      const remedialHits = countMatches(normalizedText, hybridSignals.unilateralRemedial);
      const negativeHits = countMatches(normalizedText, hybridSignals.unilateralNegative);
      return (
        supportHits * 4 +
        changeHits * 4 +
        roleHits +
        actionHits -
        remedialHits * 6 -
        negativeHits * 8
      );
    }
    case 'auto-renewal': {
      const supportHits = countMatches(normalizedText, hybridSignals.autoRenewalSupport);
      return supportHits * 4 + (hasExplicitNumericSignal(excerpt) ? 1 : 0);
    }
    default:
      return roleHits + actionHits;
  }
};

const meetsRiskThreshold = (
  ruleId: string,
  totalScore: number,
  normalizedText: string,
): boolean => {
  switch (ruleId) {
    case 'acceptance':
      return (
        totalScore >= 7 &&
        countMatches(normalizedText, hybridSignals.acceptanceSupport) >= 1 &&
        countMatches(normalizedText, hybridSignals.acceptanceClarity) < 2 &&
        countMatches(normalizedText, hybridSignals.acceptanceTransfer) < 3
      );
    case 'penalties':
      return (
        totalScore >= 8 &&
        countMatches(normalizedText, hybridSignals.penaltySupport) >= 1 &&
        (countMatches(normalizedText, hybridSignals.penaltyTrigger) > 0 ||
          hasMonetarySignal(normalizedText))
      );
    case 'liability':
      return (
        totalScore >= 7 &&
        countMatches(normalizedText, hybridSignals.liabilitySupport) >= 1 &&
        countMatches(normalizedText, hybridSignals.liabilityHard) >= 1
      );
    case 'unilateral':
      return (
        totalScore >= 8 &&
        countMatches(normalizedText, hybridSignals.unilateralRemedial) === 0 &&
        countMatches(normalizedText, hybridSignals.unilateralChange) >= 1 &&
        countMatches(normalizedText, hybridSignals.unilateralNegative) === 0
      );
    case 'auto-renewal':
      return totalScore >= 7;
    default:
      return totalScore >= 6;
  }
};

const scoreDisputeContext = (markerId: string, normalizedText: string, excerpt: string): number => {
  switch (markerId) {
    case 'reasonable-time':
      return countMatches(normalizedText, hybridSignals.preciseTimeline) > 0 ? -6 : 3;
    case 'future-agreement': {
      const essentialHits = countMatches(normalizedText, hybridSignals.futureAgreementEssential);
      const openEndedHits = countMatches(normalizedText, hybridSignals.futureAgreementOpenEnded);
      const amendmentHits = countMatches(normalizedText, hybridSignals.futureAgreementAmendment);
      const frameworkHits = countMatches(normalizedText, hybridSignals.futureAgreementFramework);
      const routineHits = countMatches(normalizedText, hybridSignals.futureAgreementRoutine);
      return (
        essentialHits * 3 +
        openEndedHits * 5 -
        frameworkHits * 2 -
        amendmentHits * 5 +
        routineHits * -6 +
        (countMatches(normalizedText, hybridSignals.preciseTimeline) > 0 ? -2 : 0)
      );
    }
    case 'discretionary-right': {
      const remedialHits = countMatches(normalizedText, hybridSignals.unilateralRemedial);
      return (
        (countMatches(normalizedText, hybridSignals.unilateralSupport) > 0 ? 3 : 0) -
        remedialHits * 4
      );
    }
    default:
      return hasExplicitNumericSignal(excerpt) ? 1 : 0;
  }
};

const meetsDisputeThreshold = (
  markerId: string,
  totalScore: number,
  normalizedText: string,
): boolean => {
  switch (markerId) {
    case 'reasonable-time':
      return totalScore >= 3 && countMatches(normalizedText, hybridSignals.preciseTimeline) === 0;
    case 'future-agreement':
      return (
        totalScore >= 6 &&
        countMatches(normalizedText, hybridSignals.futureAgreementEssential) > 0 &&
        countMatches(normalizedText, hybridSignals.futureAgreementOpenEnded) > 0 &&
        countMatches(normalizedText, hybridSignals.futureAgreementAmendment) === 0 &&
        countMatches(normalizedText, hybridSignals.futureAgreementRoutine) === 0
      );
    case 'discretionary-right':
      return (
        totalScore >= 4 && countMatches(normalizedText, hybridSignals.unilateralRemedial) === 0
      );
    default:
      return totalScore >= 3;
  }
};

const countNearbyMarkerPairs = (
  normalizedText: string,
  sourceMarkers: string[],
  targetMarkers: string[],
  maxDistance = 96,
): number => {
  const sourcePositions = findMarkerPositions(normalizedText, sourceMarkers);
  if (sourcePositions.length === 0) {
    return 0;
  }

  const targetPositions = findMarkerPositions(normalizedText, targetMarkers);
  if (targetPositions.length === 0) {
    return 0;
  }

  return sourcePositions.reduce((total, sourcePosition) => {
    const hasNearbyTarget = targetPositions.some(
      (targetPosition) => Math.abs(sourcePosition - targetPosition) <= maxDistance,
    );
    return total + (hasNearbyTarget ? 1 : 0);
  }, 0);
};

const scoreExcerptFocus = (excerpt: string): number => {
  if (excerpt.length < 48) {
    return -1;
  }

  if (excerpt.length <= 180) {
    return 2;
  }

  if (excerpt.length <= 260) {
    return 1;
  }

  return 0;
};

const compareRiskCandidates = (left: RiskCandidate, right: RiskCandidate): number => {
  if (right.totalScore !== left.totalScore) {
    return right.totalScore - left.totalScore;
  }

  if (right.contextualScore !== left.contextualScore) {
    return right.contextualScore - left.contextualScore;
  }

  if (right.markerHits !== left.markerHits) {
    return right.markerHits - left.markerHits;
  }

  if (left.clauseIndex !== right.clauseIndex) {
    return left.clauseIndex - right.clauseIndex;
  }

  return left.fragmentIndex - right.fragmentIndex;
};

const compareDisputeCandidates = (left: DisputeCandidate, right: DisputeCandidate): number => {
  if (right.totalScore !== left.totalScore) {
    return right.totalScore - left.totalScore;
  }

  if (right.contextualScore !== left.contextualScore) {
    return right.contextualScore - left.contextualScore;
  }

  if (right.markerHits !== left.markerHits) {
    return right.markerHits - left.markerHits;
  }

  if (left.clauseIndex !== right.clauseIndex) {
    return left.clauseIndex - right.clauseIndex;
  }

  return left.fragmentIndex - right.fragmentIndex;
};

const buildRiskCandidates = (clauses: ClauseSegment[], roleTerms: string[]): RiskCandidate[] => {
  const candidates: RiskCandidate[] = [];

  for (const [clauseIndex, clause] of clauses.entries()) {
    const normalizedClauseText = normalizeSearchText(clause.text);

    for (const [fragmentIndex, fragment] of getClauseFragments(clause.text).entries()) {
      const normalizedText = normalizeSearchText(fragment);
      const excerpt = buildExcerpt(fragment, 220);
      if (!excerpt) {
        continue;
      }

      for (const rule of riskRules) {
        const markerHits = countMatches(normalizedText, rule.keywords);
        if (markerHits <= 0) {
          continue;
        }

        if (
          rule.id === 'acceptance' &&
          /^(?:приложениями к настоящему договору являются|акты?\s+приемки|акты?\s+сдачи[-\s]приемки)/iu.test(
            trimClauseLead(fragment),
          )
        ) {
          continue;
        }

        if (
          rule.id === 'acceptance' &&
          (isHeadingLike(fragment) ||
            countMatches(normalizedText, hybridSignals.acceptanceNegative) >= 2)
        ) {
          continue;
        }

        if (
          rule.id === 'acceptance' &&
          countMatches(normalizedClauseText, hybridSignals.acceptanceClarity) >= 2 &&
          countMatches(normalizedText, hybridSignals.acceptanceClarity) === 0
        ) {
          continue;
        }

        if (isBeneficialRiskMatch(rule.id, normalizedText, roleTerms)) {
          continue;
        }

        candidates.push({
          rule,
          clauseRef: clause.clauseRef,
          clauseIndex,
          fragmentIndex,
          excerpt,
          normalizedText,
          normalizedClauseText,
          markerHits,
          lexicalScore: markerHits * 4,
          contextualScore: 0,
          totalScore: markerHits * 4,
        });
      }
    }
  }

  return candidates;
};

const rerankRiskCandidates = (
  candidates: RiskCandidate[],
  roleTerms: string[],
): RiskCandidate[] => {
  return candidates.map((candidate) => {
    const fragmentContextScore = scoreRiskContext(
      candidate.rule.id,
      candidate.normalizedText,
      candidate.excerpt,
      roleTerms,
    );
    const clauseContextScore = Math.trunc(
      scoreRiskContext(
        candidate.rule.id,
        candidate.normalizedClauseText,
        candidate.excerpt,
        roleTerms,
      ) / 2,
    );
    const roleProximityScore =
      roleTerms.length > 0
        ? countNearbyMarkerPairs(candidate.normalizedText, roleTerms, candidate.rule.keywords, 88) *
          2
        : 0;
    const actionProximityScore = countNearbyMarkerPairs(
      candidate.normalizedText,
      candidate.rule.keywords,
      hybridSignals.roleAction,
      96,
    );
    const contextualScore =
      fragmentContextScore +
      clauseContextScore +
      roleProximityScore +
      actionProximityScore +
      scoreExcerptFocus(candidate.excerpt);

    return {
      ...candidate,
      contextualScore,
      totalScore: candidate.lexicalScore + contextualScore,
    };
  });
};

const selectRiskMatches = (
  candidates: RiskCandidate[],
): Map<string, { rule: RiskRule; matches: RiskCandidate[] }> => {
  const groupedResults = new Map<string, { rule: RiskRule; matches: RiskCandidate[] }>();

  for (const candidate of candidates.sort(compareRiskCandidates)) {
    if (!meetsRiskThreshold(candidate.rule.id, candidate.totalScore, candidate.normalizedText)) {
      continue;
    }

    const existing = groupedResults.get(candidate.rule.id);
    if (existing) {
      if (
        !existing.matches.some(
          (item) => item.clauseRef === candidate.clauseRef && item.excerpt === candidate.excerpt,
        )
      ) {
        existing.matches.push(candidate);
      }
    } else {
      groupedResults.set(candidate.rule.id, {
        rule: candidate.rule,
        matches: [candidate],
      });
    }
  }

  return groupedResults;
};

const buildDisputeCandidates = (clauses: ClauseSegment[]): DisputeCandidate[] => {
  const candidates: DisputeCandidate[] = [];

  for (const [clauseIndex, clause] of clauses.entries()) {
    const normalizedClauseText = normalizeSearchText(clause.text);

    for (const [fragmentIndex, fragment] of getClauseFragments(clause.text).entries()) {
      const normalizedText = normalizeSearchText(fragment);
      const excerpt = buildExcerpt(fragment, 220);
      if (!excerpt) {
        continue;
      }

      for (const marker of disputeMarkers) {
        const markerHits = countMatches(normalizedText, marker.markers);
        if (markerHits <= 0) {
          continue;
        }

        candidates.push({
          marker,
          clauseRef: clause.clauseRef,
          clauseIndex,
          fragmentIndex,
          excerpt,
          normalizedText,
          normalizedClauseText,
          markerHits,
          lexicalScore: markerHits * 4,
          contextualScore: 0,
          totalScore: markerHits * 4,
        });
      }
    }
  }

  return candidates;
};

const rerankDisputeCandidates = (candidates: DisputeCandidate[]): DisputeCandidate[] => {
  return candidates.map((candidate) => {
    const fragmentContextScore = scoreDisputeContext(
      candidate.marker.id,
      candidate.normalizedText,
      candidate.excerpt,
    );
    const clauseContextScore = Math.trunc(
      scoreDisputeContext(candidate.marker.id, candidate.normalizedClauseText, candidate.excerpt) /
        2,
    );
    const actionProximityScore = countNearbyMarkerPairs(
      candidate.normalizedText,
      candidate.marker.markers,
      hybridSignals.roleAction,
      96,
    );
    const contextualScore =
      fragmentContextScore +
      clauseContextScore +
      actionProximityScore +
      scoreExcerptFocus(candidate.excerpt);

    return {
      ...candidate,
      contextualScore,
      totalScore: candidate.lexicalScore + contextualScore,
    };
  });
};

const selectDisputeCandidates = (candidates: DisputeCandidate[]): DisputeCandidate[] => {
  const bestByClauseExcerpt = new Map<string, DisputeCandidate>();

  for (const candidate of candidates.sort(compareDisputeCandidates)) {
    if (
      !meetsDisputeThreshold(candidate.marker.id, candidate.totalScore, candidate.normalizedText)
    ) {
      continue;
    }

    const key = `${candidate.clauseRef}:${candidate.excerpt}`;
    const existing = bestByClauseExcerpt.get(key);
    if (!existing || compareDisputeCandidates(candidate, existing) < 0) {
      bestByClauseExcerpt.set(key, candidate);
    }
  }

  return Array.from(bestByClauseExcerpt.values()).sort(compareDisputeCandidates);
};

const buildRussianRoleForms = (token: string): string[] => {
  if (!/^[а-яё-]+$/iu.test(token)) {
    return [token];
  }

  if (token.endsWith('ин')) {
    const root = token.slice(0, -2);
    return [token, `${root}ина`, `${root}ину`, `${root}ином`, `${root}ине`];
  }

  if (token.endsWith('тель')) {
    const root = token.slice(0, -4);
    return [token, `${root}теля`, `${root}телю`, `${root}телем`, `${root}теле`];
  }

  if (token.endsWith('чик')) {
    const root = token.slice(0, -3);
    return [token, `${root}чика`, `${root}чику`, `${root}чиком`, `${root}чике`];
  }

  if (token.endsWith('ник')) {
    const root = token.slice(0, -3);
    return [token, `${root}ника`, `${root}нику`, `${root}ником`, `${root}нике`];
  }

  if (token.endsWith('ец')) {
    const root = token.slice(0, -2);
    return [token, `${root}ца`, `${root}цу`, `${root}цом`, `${root}це`];
  }

  if (token.endsWith('ка')) {
    const root = token.slice(0, -2);
    return [token, `${root}ки`, `${root}ке`, `${root}ку`, `${root}кой`];
  }

  return [token];
};

const buildSelectedRoleTerms = (selectedRole: string): string[] => {
  const normalizedRole = normalizeSearchText(selectedRole);
  const tokens = tokenizeSearchText(selectedRole);
  const terms = new Set<string>();

  if (normalizedRole) {
    terms.add(normalizedRole);
  }

  for (const token of tokens) {
    terms.add(token);
    for (const variant of buildRussianRoleForms(token)) {
      terms.add(normalizeSearchText(variant));
    }
  }

  return uniqueStrings(Array.from(terms).map((term) => normalizeSearchText(term))).filter(Boolean);
};

const extractRoleTerms = (selectedRole: string): string[] => {
  return buildSelectedRoleTerms(selectedRole);
};

const extractStrictRoleTerms = (selectedRole: string): string[] => {
  return buildSelectedRoleTerms(selectedRole);
};

export const segmentClauses = (text: string): ClauseSegment[] => {
  const normalizedText = normalizeExtractedText(text);
  const rawClauses = normalizedText
    .split(/\n{2,}|(?=\n\s*(?:\d+(?:\.\d+)*[.)]|[\u2022*-]))/u)
    .map((clause) => clause.trim())
    .filter(Boolean);

  const clauses =
    rawClauses.length > 0
      ? rawClauses
      : normalizedText
          .split('\n')
          .map((clause) => clause.trim())
          .filter(Boolean);
  return clauses.map((clause, index) => ({
    clauseId: `${clauseIdPrefix}${index + 1}`,
    clauseRef: buildClauseReference(clause, index),
    text: clause,
  }));
};

export const collectCandidateLines = (text: string, clauses: ClauseSegment[]): string[] => {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const source of [text, ...clauses.map((item) => item.text)]) {
    const parts = splitClauseIntoFragments(source);
    for (const part of parts) {
      const line = buildExcerpt(part, maxClauseExcerptLength);
      if (!line) {
        continue;
      }

      const key = normalizeSearchText(line);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      lines.push(line);
    }
  }

  return lines;
};

export const collectLines = (
  candidates: string[],
  markers: string[],
  prioritizedTerms: string[],
  maxItems: number,
): string[] => {
  const scored = candidates
    .map((line, index) => ({
      line,
      index,
      score: scoreLine(line, markers, prioritizedTerms),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (left.line.length !== right.line.length) {
        return left.line.length - right.line.length;
      }

      return left.index - right.index;
    });

  return scored.map((item) => item.line).slice(0, maxItems);
};

const collectRoleLedBlockItems = (
  clauses: ClauseSegment[],
  roleTerms: string[],
  maxItems: number,
): string[] => {
  const filteredRoleTerms = uniqueStrings(roleTerms)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  if (filteredRoleTerms.length === 0) {
    return [];
  }

  const rolePattern = filteredRoleTerms.map((term) => escapeRegExp(term)).join('|');
  const blockStartPattern = new RegExp(
    String.raw`(?:(\d+(?:\.\d+)*[.)]?)\s*)?(?:${rolePattern})\s+(?:обязан(?:а|ы)?|обязуется|должен(?:а|ы)?|shall|must|undertakes)\s*:\s*`,
    'giu',
  );
  const blockStopPattern = new RegExp(
    String.raw`(?:(?:\d+(?:\.\d+)*[.)]?\s*)?[A-Za-zА-ЯЁ][A-Za-zА-Яа-яЁё-]{2,}(?:\s+[A-Za-zА-Яа-яЁё-]{2,}){0,2}\s+(?:обязан(?:а|ы)?|обязуется|должен(?:а|ы)?|вправе|может|shall|must|undertakes|may)\b)|(?:\n\s*\d+\.\s+\p{Lu})`,
    'iu',
  );

  const items: string[] = [];

  const source = normalizeExtractedText(clauses.map((clause) => clause.text).join('\n')).replace(
    /(?<=[\p{Lu}\s]{6,})(?=\p{Lu}\p{Ll}{2,}\s+(?:обязан|обязуется|должен|shall|must|undertakes)\b)/gu,
    '\n',
  );
  let match: RegExpExecArray | null;
  while ((match = blockStartPattern.exec(source)) !== null) {
    const rawBlock = source.slice(
      match.index + match[0].length,
      match.index + match[0].length + 12000,
    );
    const stopMatch = rawBlock.match(blockStopPattern);
    const headerClauseRef = match[1]?.replace(/[.)]$/u, '').trim();
    const siblingStopPattern = (() => {
      if (!headerClauseRef) {
        return null;
      }

      const parts = headerClauseRef.split('.').filter(Boolean);
      if (parts.length === 0) {
        return null;
      }

      if (parts.length === 1) {
        return new RegExp(
          String.raw`\n\s*(?!${escapeRegExp(parts[0])}(?:[.)]|\b))\d+[.)]?\s+\p{Lu}`,
          'u',
        );
      }

      const parentPath = parts
        .slice(0, -1)
        .map((part) => escapeRegExp(part))
        .join('\\.');
      const currentLeaf = escapeRegExp(parts[parts.length - 1]);
      return new RegExp(
        String.raw`\n\s*${parentPath}\.(?!${currentLeaf}(?:[.)]|\b))\d+[.)]?\s+\p{Lu}`,
        'u',
      );
    })();
    const siblingStopMatch = siblingStopPattern ? rawBlock.match(siblingStopPattern) : null;
    const stopIndex = Math.min(
      stopMatch?.index ?? Number.POSITIVE_INFINITY,
      siblingStopMatch?.index ?? Number.POSITIVE_INFINITY,
    );
    const block = normalizeExtractedText(
      Number.isFinite(stopIndex) ? rawBlock.slice(0, stopIndex) : rawBlock,
    );
    if (!block) {
      continue;
    }

    const blockItems: string[] = [];
    for (const fragment of appendMappedItems(block.split(/\n+|[;\u2022]+/u), (line) =>
      splitClauseIntoFragments(line),
    )) {
      const normalizedFragment = normalizeSearchText(fragment);
      if (isForeignRoleLeadFragment(fragment, normalizedFragment, roleTerms)) {
        break;
      }

      const line = sanitizeSummaryItem(fragment);
      if (!line) {
        continue;
      }

      const normalized = normalizeSearchText(line);
      const obligationHits = countMatches(normalized, summaryMarkers.obligations);
      const paymentHits = countMatches(normalized, summaryMarkers.payment);
      const continuationCandidate = isActionLikeContinuation(fragment, normalized);
      if (
        countMatches(normalized, summaryMarkers.exclude) === 0 &&
        (obligationHits > 0 || paymentHits > 0 || continuationCandidate)
      ) {
        blockItems.push(line);
      }
    }

    items.push(...blockItems);
    if (items.length >= maxItems) {
      return uniqueStrings(items).slice(0, maxItems);
    }
  }

  return uniqueStrings(items).slice(0, maxItems);
};

const collectRoleObligations = (
  clauses: ClauseSegment[],
  roleTerms: string[],
  maxItems: number,
): { roleFound: boolean; items: string[] } => {
  const roleFound = clauses.some(
    (clause) => countMatches(normalizeSearchText(clause.text), roleTerms) > 0,
  );
  const scored = appendMappedItems(clauses, (clause, clauseIndex) => {
    const fragments = getClauseFragments(clause.text);
    const candidates: Array<{
      clauseIndex: number;
      excerpt: string;
      fragmentIndex: number;
      roleHits: number;
      signalHits: number;
      score: number;
    }> = [];
    let carryRole = false;

    for (const [fragmentIndex, fragment] of fragments.entries()) {
      const normalized = normalizeSearchText(fragment);
      const roleHits = countMatches(normalized, roleTerms);
      const obligationHits = countMatches(normalized, summaryMarkers.obligations);
      const paymentHits = countMatches(normalized, summaryMarkers.payment);
      const deadlineHits = countMatches(normalized, summaryMarkers.deadlines);
      const exclusionHits = countMatches(normalized, summaryMarkers.exclude);
      const roleActsAsSubject = hasRoleActionLead(normalized, roleTerms);
      const roleLead = isRoleLeadFragment(fragment, normalized, roleTerms);
      const foreignRoleLead = isForeignRoleLeadFragment(fragment, normalized, roleTerms);
      const continuationHits =
        carryRole &&
        !foreignRoleLead &&
        roleHits === 0 &&
        exclusionHits === 0 &&
        isActionLikeContinuation(fragment, normalized)
          ? 1
          : 0;
      const effectiveRoleHits = roleHits > 0 && roleActsAsSubject ? roleHits : continuationHits;
      const signalHits = obligationHits + paymentHits + deadlineHits + continuationHits;
      const excerpt = buildExcerpt(fragment, 520);

      if (effectiveRoleHits > 0 && signalHits > 0 && exclusionHits === 0 && excerpt) {
        candidates.push({
          clauseIndex,
          excerpt,
          fragmentIndex,
          roleHits: effectiveRoleHits,
          signalHits,
          score:
            effectiveRoleHits * 6 +
            obligationHits * 4 +
            (paymentHits + deadlineHits) * 2 +
            continuationHits * 2,
        });
      }

      if (roleLead) {
        carryRole = true;
        continue;
      }

      if (foreignRoleLead) {
        carryRole = false;
        continue;
      }

      if ((roleHits > 0 && !roleActsAsSubject) || !isActionLikeContinuation(fragment, normalized)) {
        carryRole = false;
      }
    }

    return candidates;
  });

  const items = scored
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (left.clauseIndex !== right.clauseIndex) {
        return left.clauseIndex - right.clauseIndex;
      }

      if (left.fragmentIndex !== right.fragmentIndex) {
        return left.fragmentIndex - right.fragmentIndex;
      }

      return 0;
    })
    .map((item) => sanitizeSummaryItem(item.excerpt))
    .filter(Boolean)
    .slice(0, maxItems);

  const normalizedItems = uniqueStrings(items);
  const roleLedBlockItems = collectRoleLedBlockItems(clauses, roleTerms, maxItems);
  const explicitRoleItems = normalizedItems.filter((item) =>
    hasRoleActionLead(normalizeSearchText(item), roleTerms),
  );
  const mergedItems =
    roleLedBlockItems.length > 0
      ? uniqueStrings([...roleLedBlockItems, ...explicitRoleItems]).slice(0, maxItems)
      : normalizedItems.slice(0, maxItems);

  if (mergedItems.length > 0) {
    return {
      roleFound,
      items: mergedItems,
    };
  }

  return {
    roleFound,
    items: roleLedBlockItems,
  };
};

export const buildRolePrioritizedTerms = (selectedRole: string): string[] => {
  return extractRoleTerms(selectedRole);
};

export const buildStrictRoleTerms = (selectedRole: string): string[] => {
  return extractStrictRoleTerms(selectedRole);
};

const buildClauseReference = (text: string, index: number): string => {
  const normalized = normalizeExtractedText(text);
  const numberedMatch = normalized.match(/^\s*(\d+(?:\.\d+){0,5})[.)]?(?:\s|$)/u);
  if (numberedMatch?.[1]) {
    return numberedMatch[1];
  }

  const labeledMatch = normalized.match(
    /^\s*(?:clause|section|article|пункт|раздел)\s+(\d+(?:\.\d+){0,5})/iu,
  );
  if (labeledMatch?.[1]) {
    return labeledMatch[1];
  }

  return String(index + 1);
};

const isHeadingLike = (text: string): boolean => {
  const compact = normalizeExtractedText(text);
  if (!compact) {
    return true;
  }

  if (compact.endsWith(':')) {
    return true;
  }

  const letters = compact.match(/[\p{L}]/gu) ?? [];
  const upperCaseLetters = compact.match(/[\p{Lu}]/gu) ?? [];
  return letters.length > 0 && upperCaseLetters.length / letters.length > 0.72;
};

const trimClauseLead = (text: string): string => {
  return normalizeExtractedText(text)
    .replace(/^\s*[\u2022*-]+\s*/u, '')
    .replace(/^\s*\(?[a-zа-яё]\)\s*/iu, '')
    .replace(/^\s*(?:clause|section|article|пункт|раздел)\s+\d+(?:\.\d+){0,5}[.)]?\s*/iu, '')
    .replace(/^\s*\d+(?:\.\d+){0,5}[.)]?\s*/u, '')
    .trim();
};

const findEmbeddedClauseBoundary = (text: string): number => {
  const match =
    /[.!?]((?:(?:clause|section|article|пункт|раздел)\s+)?\d+(?:\.\d+){0,5}[.)]?)(?=\s*\p{Lu})/u.exec(
      text,
    ) ??
    /[.!?]\s+((?:(?:clause|section|article|пункт|раздел)\s+)?\d+(?:\.\d+){0,5}[.)]?)(?=\s+\p{Lu})/u.exec(
      text,
    ) ??
    /\s+((?:(?:clause|section|article|пункт|раздел)\s+)?\d+(?:\.\d+){0,5}[.)]?)(?=\s+\p{Lu})/u.exec(
      text,
    );
  return match ? match.index + 1 : -1;
};

const stripTrailingLooseClauseMarker = (text: string): string => {
  const trimmed = text.trimEnd();

  if (/(?:clause|section|article|пункт|раздел)\s+\d+(?:\.\d+){0,5}[.)]?\s*$/iu.test(trimmed)) {
    return trimmed;
  }

  return trimmed
    .replace(/[.!?]\d+(?:[.,]\d+){0,5}[.)]?\s*$/u, '')
    .replace(/\s+\d+(?:[.,]\d+){0,5}[.)]?\s*$/u, '')
    .trimEnd();
};

const sanitizeSummaryItem = (value: string): string => {
  const normalized = normalizeExtractedText(value)
    .replace(/\b(\d+(?:\.\d+){1,5}),(\d+(?:\.\d+){0,5}[.)]?)/gu, '$1.$2')
    .replace(/:\s*\d+(?:[.,]\d+){0,5}[.)]?\s*$/u, ':')
    .trim();

  const excerpt = buildExcerpt(normalized, 520);
  if (!excerpt) {
    return '';
  }

  const cleaned = excerpt
    .replace(/:\s*\d+(?:[.,]\d+){0,5}[.)]?\s*$/u, '')
    .replace(/^\p{L}[\p{L}\s-]{1,48}:\s*$/u, '')
    .trim();

  return cleaned;
};

const buildExcerpt = (text: string, maxLength = maxClauseExcerptLength): string => {
  let trimmed = trimClauseLead(text);
  const embeddedBoundary = findEmbeddedClauseBoundary(trimmed);
  if (embeddedBoundary >= 0) {
    trimmed = trimmed.slice(0, embeddedBoundary).trim();
  }

  trimmed = stripTrailingLooseClauseMarker(trimmed);
  if (!trimmed || isHeadingLike(trimmed)) {
    return '';
  }

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  const rawCandidate = trimmed.slice(0, maxLength);
  const candidateBoundary = findEmbeddedClauseBoundary(rawCandidate);
  const candidate = stripTrailingLooseClauseMarker(
    candidateBoundary >= 0 ? rawCandidate.slice(0, candidateBoundary).trim() : rawCandidate,
  ).trim();
  if (!candidate) {
    return '';
  }

  const sentenceEnd = Math.max(
    candidate.lastIndexOf('. '),
    candidate.lastIndexOf('! '),
    candidate.lastIndexOf('? '),
  );
  if (sentenceEnd >= 60) {
    return stripTrailingLooseClauseMarker(candidate.slice(0, sentenceEnd + 1)).trim();
  }

  if (candidateBoundary >= 0 || /[.!?]$/u.test(candidate)) {
    return candidate;
  }

  return `${candidate.trimEnd()}...`;
};

const isBeneficialRiskMatch = (
  ruleId: string,
  normalizedText: string,
  roleTerms: string[],
): boolean => {
  switch (ruleId) {
    case 'liability':
      if (countMatches(normalizedText, genericBenefitMarkers.liability) > 0) {
        return true;
      }
      if (roleTerms.length === 0 || countMatches(normalizedText, roleTerms) === 0) {
        return false;
      }
      return hasNearbyMarkers(normalizedText, roleTerms, roleBenefitMarkers.liability);
    case 'penalties':
      if (countMatches(normalizedText, genericBenefitMarkers.penalties) > 0) {
        return true;
      }
      if (roleTerms.length === 0 || countMatches(normalizedText, roleTerms) === 0) {
        return false;
      }
      return hasNearbyMarkers(normalizedText, roleTerms, roleBenefitMarkers.penalties);
    case 'unilateral':
      if (roleTerms.length === 0 || countMatches(normalizedText, roleTerms) === 0) {
        return false;
      }
      return hasLeadingRoleMarker(normalizedText, roleTerms, roleBenefitMarkers.unilateral, 72);
    default:
      return false;
  }
};

const formatRoleNotFoundMessage = (selectedRole: string, language: SupportedLanguage): string => {
  switch (normalizeLanguage(language)) {
    case 'ru':
      return `Роль "${selectedRole}" не найдена в тексте договора. Уточните формулировку роли или выберите сторону, которая прямо указана в документе.`;
    case 'it':
      return `Il ruolo "${selectedRole}" non e stato trovato nel testo del contratto. Verificare il nome del ruolo o scegliere una parte indicata esplicitamente nel documento.`;
    case 'fr':
      return `Le role "${selectedRole}" n a pas ete trouve dans le texte du contrat. Verifiez l intitule du role ou choisissez une partie explicitement indiquee dans le document.`;
    case 'en':
    default:
      return `The role "${selectedRole}" was not found in the contract text. Verify the role wording or choose a party explicitly named in the document.`;
  }
};

const formatRoleNotFoundRecommendation = (language: SupportedLanguage): string => {
  switch (normalizeLanguage(language)) {
    case 'ru':
      return 'Проверьте название роли в выпадающем списке и выберите сторону, которая действительно указана в договоре.';
    case 'it':
      return 'Verificare il nome del ruolo scelto e selezionare una parte realmente indicata nel contratto.';
    case 'fr':
      return 'Verifiez le nom du role choisi et selectionnez une partie effectivement mentionnee dans le contrat.';
    case 'en':
    default:
      return 'Verify the chosen role name and select a party that is explicitly mentioned in the contract.';
  }
};

const elevateSeverity = (
  severity: RiskItem['severity'],
  occurrences: number,
): RiskItem['severity'] => {
  if (occurrences < 2) {
    return severity;
  }

  if (severity === 'low') {
    return 'medium';
  }

  if (severity === 'medium') {
    return 'high';
  }

  return severity;
};

export const detectContractType = (text: string, language: SupportedLanguage): string => {
  const normalizedHead = normalizeSearchText(normalizeExtractedText(text).slice(0, 4000));
  const localization = localizedStrings[normalizeLanguage(language)];
  const priorityOrder = [
    'agency',
    'loan',
    'cession',
    'employment',
    'nda',
    'contractWork',
    'supply',
    'rent',
    'services',
  ];
  let bestKey = '';
  let bestScore = 0;

  for (const [key, markers] of Object.entries(contractTypeDetectors)) {
    const score = countMatches(normalizedHead, markers);
    if (score > bestScore) {
      bestKey = key;
      bestScore = score;
      continue;
    }

    if (score > 0 && score === bestScore) {
      const currentPriority = priorityOrder.indexOf(key);
      const bestPriority = priorityOrder.indexOf(bestKey);
      if (bestPriority < 0 || (currentPriority >= 0 && currentPriority < bestPriority)) {
        bestKey = key;
      }
    }
  }

  return bestKey
    ? (localization.contractTypes[bestKey] ?? localization.unknownContractType)
    : localization.unknownContractType;
};

export const buildRiskItems = (
  clauses: ClauseSegment[],
  role: string,
  language: SupportedLanguage,
  warnings: string[],
): RiskItem[] => {
  const results: RiskItem[] = [];
  const normalizedLanguage = normalizeLanguage(language);
  const roleTerms = buildStrictRoleTerms(role);
  const groupedResults = selectRiskMatches(
    rerankRiskCandidates(buildRiskCandidates(clauses, roleTerms), roleTerms),
  );

  for (const { rule, matches } of groupedResults.values()) {
    const directionFilteredMatches = matches.filter((item) => {
      if (countMatches(item.normalizedText, roleTerms) === 0) {
        return true;
      }

      return hasRoleActionLead(item.normalizedText, roleTerms);
    });
    const effectiveMatches =
      directionFilteredMatches.length > 0 ? directionFilteredMatches : matches;
    const rankedMatches = [...effectiveMatches].sort(compareRiskCandidates);
    const clauseRefs = uniqueStrings(rankedMatches.map((item) => item.clauseRef));
    const occurrences = rankedMatches.length;

    results.push({
      id: `risk-${results.length + 1}`,
      groupId: rule.id,
      severity: elevateSeverity(rule.severity, occurrences),
      clauseRef: clauseRefs.join(', '),
      clauseRefs,
      occurrences,
      evidence: rankedMatches
        .map((item) => item.excerpt)
        .filter(Boolean)
        .slice(0, 6),
      title: rule.title[normalizedLanguage],
      description: rule.description[normalizedLanguage],
      recommendation: rule.recommendation[normalizedLanguage],
    });
  }

  if (warnings.length > 0) {
    const strings = localizedStrings[normalizedLanguage];
    results.unshift({
      id: 'risk-warning-1',
      groupId: 'extraction-quality',
      severity: 'medium',
      clauseRef: 'system',
      clauseRefs: ['system'],
      occurrences: warnings.length,
      title: strings.extractionRiskTitle,
      description: warnings.join(' '),
      recommendation: strings.extractionRiskRecommendation,
    });
  }

  if (results.length === 0) {
    const strings = localizedStrings[normalizedLanguage];
    results.push({
      id: 'risk-1',
      groupId: 'low-signal',
      severity: 'low',
      clauseRef: role ? role : 'overview',
      clauseRefs: [role ? role : 'overview'],
      occurrences: 1,
      title: strings.lowSignalRiskTitle,
      description: strings.lowSignalRiskDescription,
      recommendation: strings.lowSignalRiskRecommendation,
    });
  }

  return results
    .sort((left, right) => {
      const rank = { high: 3, medium: 2, low: 1 };
      if (rank[right.severity] !== rank[left.severity]) {
        return rank[right.severity] - rank[left.severity];
      }

      return (right.occurrences ?? 1) - (left.occurrences ?? 1);
    })
    .map((item, index) => ({ ...item, id: `risk-${index + 1}` }));
};

export const buildDisputedClauses = (
  clauses: ClauseSegment[],
  language: SupportedLanguage,
): DisputedClause[] => {
  const results: DisputedClause[] = [];
  const normalizedLanguage = normalizeLanguage(language);
  const candidates = selectDisputeCandidates(
    rerankDisputeCandidates(buildDisputeCandidates(clauses)),
  );

  for (const candidate of candidates) {
    results.push({
      id: `disputed-${results.length + 1}`,
      clauseRef: candidate.clauseRef,
      clauseText: candidate.excerpt,
      whyDisputed: candidate.marker.reason[normalizedLanguage],
      suggestedRewrite: candidate.marker.suggestion[normalizedLanguage],
    });
  }

  if (results.length === 0) {
    return [];
  }

  return results;
};

export const formatTemplate = (
  template: string,
  values: Record<string, string | number>,
): string => {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
};

export const buildAnalysisArtifacts = ({
  text,
  fileName,
  selectedRole,
  language,
  warnings,
}: BuildAnalysisArtifactsInput): AnalysisArtifacts => {
  const normalizedLanguage = normalizeLanguage(language);
  const strings = localizedStrings[normalizedLanguage];
  const normalizedText = normalizeExtractedText(text);
  const clauses = segmentClauses(normalizedText);
  const strictRoleTerms = buildStrictRoleTerms(selectedRole);
  const roleObligations = collectRoleObligations(clauses, strictRoleTerms, maxSummaryItems);

  const roleFound = roleObligations.roleFound;
  const summaryItems = roleFound
    ? roleObligations.items.length > 0
      ? roleObligations.items
      : [strings.obligationsFallback]
    : [formatRoleNotFoundMessage(selectedRole, normalizedLanguage)];

  const risks = buildRiskItems(clauses, selectedRole, normalizedLanguage, warnings);
  if (!roleFound) {
    risks.unshift({
      id: 'risk-role-missing',
      groupId: 'role-missing',
      severity: 'medium',
      clauseRef: 'overview',
      clauseRefs: ['overview'],
      occurrences: 1,
      title:
        normalizedLanguage === 'ru'
          ? 'Выбранная роль не найдена'
          : normalizedLanguage === 'it'
            ? 'Ruolo selezionato non trovato'
            : normalizedLanguage === 'fr'
              ? 'Role selectionne introuvable'
              : 'Selected role not found',
      description: formatRoleNotFoundMessage(selectedRole, normalizedLanguage),
      recommendation: formatRoleNotFoundRecommendation(normalizedLanguage),
    });
  }

  return {
    summary: {
      title: `${strings.reportTitle}: ${fileName}`,
      contractType: detectContractType(normalizedText, normalizedLanguage),
      shortDescription: roleFound
        ? formatTemplate(strings.shortDescription, {
            clausesCount: clauses.length,
            role: selectedRole,
          })
        : formatRoleNotFoundMessage(selectedRole, normalizedLanguage),
      obligationsForSelectedRole:
        summaryItems.length > 0 ? summaryItems : [strings.obligationsFallback],
      roleFound,
    },
    risks,
    disputedClauses: buildDisputedClauses(clauses, normalizedLanguage),
  };
};
