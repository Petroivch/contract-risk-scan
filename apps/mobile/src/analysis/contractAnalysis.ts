import type { AnalysisReport, DisputedClause, RiskItem } from '../api/types';
import type { SupportedLanguage } from '../i18n/types';
import { defaultLanguage } from '../i18n/types';

import { normalizeExtractedText, normalizeSearchText, repairMojibakeText, uniqueStrings } from './textNormalization';

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

const clauseIdPrefix = 'clause-';
const maxSummaryItems = 4;
const maxClauseExcerptLength = 240;
const shortMojibakeTokenFixes: Record<string, string> = {
  'Р°': 'а',
  'Рђ': 'А',
  'РІ': 'в',
  'Р’': 'В',
  'Рё': 'и',
  'Р': 'И',
  'СЃ': 'с',
  'РЎ': 'С',
  'Рє': 'к',
  'Рљ': 'К',
  'Рѕ': 'о',
  'Рћ': 'О',
  'Сѓ': 'у',
  'РЈ': 'У',
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

const localizedStrings: Record<SupportedLanguage, AnalysisLocalization> = repairDeepStrings({
  ru: {
    contractTypes: {
      services: 'Р”РѕРіРѕРІРѕСЂ РѕРєР°Р·Р°РЅРёСЏ СѓСЃР»СѓРі',
      employment: 'РўСЂСѓРґРѕРІРѕР№ РґРѕРіРѕРІРѕСЂ',
      nda: 'РЎРѕРіР»Р°С€РµРЅРёРµ Рѕ РєРѕРЅС„РёРґРµРЅС†РёР°Р»СЊРЅРѕСЃС‚Рё',
      supply: 'Р”РѕРіРѕРІРѕСЂ РїРѕСЃС‚Р°РІРєРё',
      contractWork: 'Р”РѕРіРѕРІРѕСЂ РїРѕРґСЂСЏРґР°',
    },
    unknownContractType: 'Р”РѕРіРѕРІРѕСЂ РѕР±С‰РµРіРѕ С‚РёРїР°',
    reportTitle: 'РђРЅР°Р»РёР· РґРѕРіРѕРІРѕСЂР°',
    shortDescription:
      'Р”РѕРєСѓРјРµРЅС‚ СЃРѕРґРµСЂР¶РёС‚ {clausesCount} РїСѓРЅРєС‚РѕРІ. Р”Р»СЏ СЂРѕР»Рё "{role}" РІ С„РѕРєСѓСЃРµ РѕР±СЏР·Р°С‚РµР»СЊСЃС‚РІР°, СЃСЂРѕРєРё, РїР»Р°С‚РµР¶Рё Рё СѓСЃР»РѕРІРёСЏ СЃ РїРѕРІС‹С€РµРЅРЅС‹Рј СЂРёСЃРєРѕРј.',
    obligationsFallback:
      'РЇРІРЅС‹Рµ РѕР±СЏР·Р°С‚РµР»СЊСЃС‚РІР° РґР»СЏ РІС‹Р±СЂР°РЅРЅРѕР№ СЂРѕР»Рё РЅРµ РЅР°Р№РґРµРЅС‹, РЅСѓР¶РµРЅ СЂСѓС‡РЅРѕР№ РїСЂРѕСЃРјРѕС‚СЂ СЂР°Р·РґРµР»РѕРІ СЃРѕ СЃСЂРѕРєР°РјРё, РѕРїР»Р°С‚РѕР№ Рё РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚СЊСЋ.',
    disputedFallback:
      'РЇРІРЅС‹Рµ СЃРїРѕСЂРЅС‹Рµ С„РѕСЂРјСѓР»РёСЂРѕРІРєРё РЅРµ РЅР°Р№РґРµРЅС‹, РЅРѕ РґРѕРіРѕРІРѕСЂ РІСЃРµ СЂР°РІРЅРѕ С‚СЂРµР±СѓРµС‚ СЂСѓС‡РЅРѕР№ СЋСЂРёРґРёС‡РµСЃРєРѕР№ РїСЂРѕРІРµСЂРєРё.',
    disputedFallbackSuggestion: 'РџСЂРѕРІРµСЂСЊС‚Рµ СЂР°Р·РґРµР»С‹ РѕР± РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚Рё, РїСЂРёРµРјРєРµ, РёР·РјРµРЅРµРЅРёРё СѓСЃР»РѕРІРёР№ Рё СЂР°СЃС‚РѕСЂР¶РµРЅРёРё.',
    lowSignalRiskTitle: 'РќРёР·РєРёР№ СЃРёРіРЅР°Р» СЂРёСЃРєР°',
    lowSignalRiskDescription: 'РЇРІРЅС‹Рµ РјР°СЂРєРµСЂС‹ РІС‹СЃРѕРєРѕРіРѕ СЂРёСЃРєР° РЅРµ РЅР°Р№РґРµРЅС‹, РЅРѕ РґРѕРєСѓРјРµРЅС‚ С‚СЂРµР±СѓРµС‚ СЂСѓС‡РЅРѕР№ РїСЂРѕРІРµСЂРєРё РѕР±С‰РёС… СѓСЃР»РѕРІРёР№.',
    lowSignalRiskRecommendation:
      'РџСЂРѕРІРµСЂСЊС‚Рµ Р»РёРјРёС‚С‹ РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚Рё, РїРѕСЂСЏРґРѕРє РїСЂРёРµРјРєРё, РѕРїР»Р°С‚Сѓ Рё РїСЂР°РІРѕ РѕРґРЅРѕСЃС‚РѕСЂРѕРЅРЅРёС… РґРµР№СЃС‚РІРёР№.',
    extractionRiskTitle: 'РћРіСЂР°РЅРёС‡РµРЅРЅРѕРµ РєР°С‡РµСЃС‚РІРѕ РёР·РІР»РµС‡РµРЅРёСЏ С‚РµРєСЃС‚Р°',
    extractionRiskRecommendation: 'Р”Р»СЏ Р±РѕР»РµРµ С‚РѕС‡РЅРѕРіРѕ РѕС„Р»Р°Р№РЅ-Р°РЅР°Р»РёР·Р° РёСЃРїРѕР»СЊР·СѓР№С‚Рµ С‚РµРєСЃС‚РѕРІС‹Р№ PDF, DOCX РёР»Рё TXT-С„Р°Р№Р».',
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
      contractWork: "Contratto d'opera",
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
});

const summaryMarkers = repairDeepStrings({
  obligations: [
    'РѕР±СЏР·Р°РЅ',
    'РґРѕР»Р¶РµРЅ',
    'РѕР±СЏР·СѓРµС‚СЃСЏ',
    'shall',
    'must',
    'undertakes',
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

const roleAliasGroups: Array<{ markers: string[]; aliases: string[] }> = repairDeepStrings([
  {
    markers: ['customer', 'client', 'buyer', 'purchaser', 'заказчик', 'committente', 'cliente', 'acheteur'],
    aliases: [
      'customer',
      'client',
      'buyer',
      'purchaser',
      'заказчик',
      'committente',
      'cliente',
      'acheteur',
    ],
  },
  {
    markers: [
      'provider',
      'vendor',
      'supplier',
      'contractor',
      'исполнитель',
      'подрядчик',
      'fornitore',
      'prestataire',
      'executant',
      'esecutore',
      'contraente',
    ],
    aliases: [
      'provider',
      'vendor',
      'supplier',
      'contractor',
      'исполнитель',
      'подрядчик',
      'fornitore',
      'prestataire',
      'executant',
      'esecutore',
      'contraente',
    ],
  },
  {
    markers: [
      'employee',
      'employer',
      'worker',
      'работник',
      'работодатель',
      'dipendente',
      'datore',
      'datore di lavoro',
      'employeur',
    ],
    aliases: [
      'employee',
      'employer',
      'worker',
      'работник',
      'работодатель',
      'dipendente',
      'datore',
      'datore di lavoro',
      'employeur',
    ],
  },
  {
    markers: ['licensor', 'licensee', 'licenziante', 'licenziatario', 'Р»РёС†РµРЅР·РёР°СЂ', 'Р»РёС†РµРЅР·РёР°С‚'],
    aliases: ['licensor', 'licensee', 'licenziante', 'licenziatario', 'Р»РёС†РµРЅР·РёР°СЂ', 'Р»РёС†РµРЅР·РёР°С‚'],
  },
  {
    markers: [
      'citizen',
      'individual',
      'consumer',
      'student',
      'citoyen',
      'cittadino',
      'гражданин',
      'гражданина',
      'гражданином',
      'гражданину',
      'гражданине',
      'гражданка',
      'обучающийся',
      'обучающегося',
      'слушатель',
    ],
    aliases: [
      'citizen',
      'individual',
      'consumer',
      'student',
      'citoyen',
      'cittadino',
      'гражданин',
      'гражданина',
      'гражданином',
      'гражданину',
      'гражданине',
      'гражданка',
      'обучающийся',
      'обучающегося',
      'слушатель',
    ],
  },
]);

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
      'РѕС‚РІРµС‚СЃС‚РІРµРЅ',
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
    keywords: ['РїСЂРёРµРјРє', 'Р°РєС‚', 'acceptance', 'sign-off', 'collaudo', 'acceptation', 'recette'],
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
      'РІРїСЂР°РІРµ',
      'may at its discretion',
      'sole discretion',
      'at its sole discretion',
      'ha facolta',
      'a sua discrezione',
      'a son unique discretion',
      'est autorise',
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
    'СѓСЃР»СѓРі',
    'service agreement',
    'services agreement',
    'statement of work',
    'master services',
    'prestation de services',
    'contratto di servizi',
    'fornitura servizi',
  ],
  employment: [
    'С‚СЂСѓРґРѕРІ',
    'СЂР°Р±РѕС‚РѕРґР°С‚РµР»',
    'employee',
    'employment',
    'lavoro subordinato',
    'contrat de travail',
    'contratto di lavoro',
  ],
  nda: [
    'РєРѕРЅС„РёРґРµРЅ',
    'non-disclosure',
    'non disclosure',
    'nda',
    'riservatezza',
    'confidentialite',
    'confidentiality',
  ],
  supply: [
    'РїРѕСЃС‚Р°РІРє',
    'supply',
    'delivery',
    'fornitura',
    'fourniture',
    'sales agreement',
    'purchase agreement',
  ],
  contractWork: [
    'РїРѕРґСЂСЏРґ',
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

const containsAny = (normalizedText: string, markers: string[]): boolean => {
  return markers.some((marker) => normalizedText.includes(normalizeSearchText(marker)));
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

const scoreLine = (line: string, markers: string[], prioritizedTerms: string[]): number => {
  const normalized = normalizeSearchText(line);
  const markerScore = countMatches(normalized, markers) * 3;
  const prioritizedScore = countMatches(normalized, prioritizedTerms) * 2;
  return markerScore + prioritizedScore;
};

const extractRoleTerms = (selectedRole: string): string[] => {
  const normalizedRole = normalizeSearchText(selectedRole);
  const tokens = tokenizeSearchText(selectedRole);
  const terms = new Set<string>(tokens);

  for (const group of roleAliasGroups) {
    if (!group.markers.some((marker) => normalizedRole.includes(normalizeSearchText(marker)))) {
      continue;
    }

    for (const alias of group.aliases) {
      const normalizedAlias = normalizeSearchText(alias);
      if (normalizedAlias) {
        terms.add(normalizedAlias);
      }
    }
  }

  if (normalizedRole.includes('contractor') || normalizedRole.includes('provider') || normalizedRole.includes('supplier')) {
    ['party', 'counterparty', 'vendor', 'client', 'customer', 'Исполнитель', 'Заказчик'].forEach((term) =>
      terms.add(normalizeSearchText(term)),
    );
  }

  if (normalizedRole.includes('employee') || normalizedRole.includes('employer')) {
    ['employee', 'employer', 'worker', 'Работник', 'Работодатель'].forEach((term) => terms.add(normalizeSearchText(term)));
  }

  return uniqueStrings(Array.from(terms).map((term) => normalizeSearchText(term))).filter(Boolean);
};

const extractStrictRoleTerms = (selectedRole: string): string[] => {
  const normalizedRole = normalizeSearchText(selectedRole);
  const tokens = tokenizeSearchText(selectedRole);
  const terms = new Set<string>(tokens);

  for (const group of roleAliasGroups) {
    if (!group.markers.some((marker) => normalizedRole.includes(normalizeSearchText(marker)))) {
      continue;
    }

    for (const alias of group.aliases) {
      const normalizedAlias = normalizeSearchText(alias);
      if (normalizedAlias) {
        terms.add(normalizedAlias);
      }
    }
  }

  return uniqueStrings(Array.from(terms).map((term) => normalizeSearchText(term))).filter(Boolean);
};

export const segmentClauses = (text: string): ClauseSegment[] => {
  const normalizedText = normalizeExtractedText(text);
  const rawClauses = normalizedText
    .split(/\n{2,}|(?=\n\s*(?:\d+(?:\.\d+)*[.)]|[\u2022*-]))/u)
    .map((clause) => clause.trim())
    .filter(Boolean);

  const clauses = rawClauses.length > 0 ? rawClauses : normalizedText.split('\n').map((clause) => clause.trim()).filter(Boolean);
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
    const parts = source.replace(/\r/g, '\n').split(/[\n;\u2022]+/u);
    for (const part of parts) {
      const line = normalizeExtractedText(part);
      if (!line) {
        continue;
      }

      const key = normalizeSearchText(line);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      lines.push(line.slice(0, maxClauseExcerptLength));
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

const collectRoleObligations = (
  clauses: ClauseSegment[],
  roleTerms: string[],
  maxItems: number,
): { roleFound: boolean; items: string[] } => {
  const scored = clauses
    .map((clause, index) => {
      const normalized = normalizeSearchText(clause.text);
      const roleHits = countMatches(normalized, roleTerms);
      const obligationHits = countMatches(normalized, summaryMarkers.obligations);
      const excerpt = buildExcerpt(clause.text, 280);

      return {
        index,
        roleHits,
        obligationHits,
        score: roleHits * 4 + obligationHits * 3,
        excerpt,
      };
    })
    .filter((item) => item.roleHits > 0);

  const roleFound = scored.length > 0;
  const items = scored
    .filter((item) => item.score > 0 && item.excerpt)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.index - right.index;
    })
    .map((item) => item.excerpt)
    .slice(0, maxItems);

  return {
    roleFound,
    items: uniqueStrings(items),
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

  const labeledMatch = normalized.match(/^\s*(?:clause|section|article|пункт|раздел)\s+(\d+(?:\.\d+){0,5})/iu);
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
    .replace(/^\s*(?:clause|section|article|пункт|раздел)\s+\d+(?:\.\d+){0,5}[.)]?\s*/iu, '')
    .replace(/^\s*\d+(?:\.\d+){0,5}[.)]?\s*/u, '')
    .trim();
};

const buildExcerpt = (text: string, maxLength = maxClauseExcerptLength): string => {
  const trimmed = trimClauseLead(text);
  if (!trimmed || isHeadingLike(trimmed)) {
    return '';
  }

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  const candidate = trimmed.slice(0, maxLength);
  const sentenceEnd = Math.max(candidate.lastIndexOf('. '), candidate.lastIndexOf('! '), candidate.lastIndexOf('? '));
  if (sentenceEnd >= 60) {
    return candidate.slice(0, sentenceEnd + 1).trim();
  }

  return `${candidate.trimEnd()}...`;
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

const elevateSeverity = (severity: RiskItem['severity'], occurrences: number): RiskItem['severity'] => {
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
  const normalized = normalizeSearchText(text);
  const localization = localizedStrings[normalizeLanguage(language)];

  for (const [key, markers] of Object.entries(contractTypeDetectors)) {
    if (containsAny(normalized, markers)) {
      return localization.contractTypes[key] ?? localization.unknownContractType;
    }
  }

  return localization.unknownContractType;
};

export const buildRiskItems = (
  clauses: ClauseSegment[],
  role: string,
  language: SupportedLanguage,
  warnings: string[],
): RiskItem[] => {
  const results: RiskItem[] = [];
  const normalizedLanguage = normalizeLanguage(language);
  const groupedResults = new Map<
    string,
    {
      rule: RiskRule;
      matches: Array<{ clauseRef: string; excerpt: string }>;
    }
  >();

  for (const clause of clauses) {
    const normalized = normalizeSearchText(clause.text);
    for (const rule of riskRules) {
      if (!containsAny(normalized, rule.keywords)) {
        continue;
      }

      const existing = groupedResults.get(rule.id);
      const nextMatch = {
        clauseRef: clause.clauseRef,
        excerpt: buildExcerpt(clause.text, 200),
      };

      if (existing) {
        if (!existing.matches.some((item) => item.clauseRef === nextMatch.clauseRef)) {
          existing.matches.push(nextMatch);
        }
      } else {
        groupedResults.set(rule.id, {
          rule,
          matches: [nextMatch],
        });
      }
    }
  }

  for (const { rule, matches } of groupedResults.values()) {
    const clauseRefs = matches.map((item) => item.clauseRef);
    const occurrences = clauseRefs.length;

    results.push({
      id: `risk-${results.length + 1}`,
      groupId: rule.id,
      severity: elevateSeverity(rule.severity, occurrences),
      clauseRef: clauseRefs.join(', '),
      clauseRefs,
      occurrences,
      evidence: matches.map((item) => item.excerpt).filter(Boolean),
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

export const buildDisputedClauses = (clauses: ClauseSegment[], language: SupportedLanguage): DisputedClause[] => {
  const results: DisputedClause[] = [];
  const normalizedLanguage = normalizeLanguage(language);
  const strings = localizedStrings[normalizedLanguage];

  for (const clause of clauses) {
    const normalized = normalizeSearchText(clause.text);
    for (const marker of disputeMarkers) {
      if (!containsAny(normalized, marker.markers)) {
        continue;
      }

      results.push({
        id: `disputed-${results.length + 1}`,
        clauseRef: clause.clauseRef,
        clauseText: buildExcerpt(clause.text, 200),
        whyDisputed: marker.reason[normalizedLanguage],
        suggestedRewrite: marker.suggestion[normalizedLanguage],
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

export const formatTemplate = (template: string, values: Record<string, string | number>): string => {
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
  const candidates = collectCandidateLines(normalizedText, clauses);
  const strictRoleTerms = buildStrictRoleTerms(selectedRole);
  const prioritizedTerms = buildRolePrioritizedTerms(selectedRole);
  const roleObligations = collectRoleObligations(clauses, strictRoleTerms, maxSummaryItems);
  const paymentTerms = collectLines(candidates, summaryMarkers.payment, prioritizedTerms, 2);
  const deadlines = collectLines(candidates, summaryMarkers.deadlines, prioritizedTerms, 2);
  const liabilityItems = collectLines(candidates, summaryMarkers.liability, prioritizedTerms, 2);

  const fallbackSummaryItems = uniqueStrings([
    ...paymentTerms,
    ...deadlines,
    ...liabilityItems,
  ])
    .map((item) => buildExcerpt(item, 240))
    .filter(Boolean)
    .slice(0, maxSummaryItems);

  const roleFound = roleObligations.roleFound;
  const summaryItems = roleFound
    ? roleObligations.items.length > 0
      ? roleObligations.items
      : fallbackSummaryItems
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
      obligationsForSelectedRole: summaryItems.length > 0 ? summaryItems : [strings.obligationsFallback],
      roleFound,
    },
    risks,
    disputedClauses: buildDisputedClauses(clauses, normalizedLanguage),
  };
};

