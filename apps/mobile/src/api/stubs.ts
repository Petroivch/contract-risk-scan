import type { SupportedLanguage } from '../i18n/types';
import { defaultLanguage } from '../i18n/types';

import { prepareRequestContext } from './client';
import type {
  AnalysisLifecycleStatus,
  AnalysisReport,
  AnalysisStatus,
  ContractRiskScannerApi,
  HistoryItem,
  RequestMeta,
  SignInRequest,
  UploadContractRequest,
  UserSession,
} from './types';

interface StoredAnalysis {
  analysisId: string;
  fileName: string;
  selectedRole: string;
  statusIndex: number;
  createdAt: string;
  updatedAt: string;
  language: SupportedLanguage;
}

interface StubClientConfig {
  getLanguage?: () => SupportedLanguage;
}

interface LocalizedRiskDraft {
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  recommendation: string;
}

interface LocalizedDisputedDraft {
  whyDisputed: string;
  suggestedRewrite: string;
}

interface LocalizedTemplate {
  reportTitle: (fileName: string) => string;
  contractType: string;
  shortDescription: (role: string) => string;
  obligations: (role: string) => string[];
  risks: (role: string) => LocalizedRiskDraft[];
  disputedClauses: (role: string) => LocalizedDisputedDraft[];
}

const lifecycle: AnalysisLifecycleStatus[] = ['queued', 'processing', 'processing', 'completed'];
const storage = new Map<string, StoredAnalysis>();

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const nowIso = (): string => new Date().toISOString();

const progressByStatus = (status: AnalysisLifecycleStatus): number => {
  if (status === 'queued') return 12;
  if (status === 'processing') return 68;
  if (status === 'completed') return 100;
  return 0;
};

const localizedTemplates: Record<SupportedLanguage, LocalizedTemplate> = {
  ru: {
    reportTitle: (fileName) => `Анализ договора: ${fileName}`,
    contractType: 'Договор оказания услуг',
    shortDescription: (role) =>
      `Документ описывает объем услуг, сроки приемки, оплату и ответственность сторон. В отчете акцент смещен на обязательства и риски для роли «${role}».`,
    obligations: (role) => [
      `Проверить сроки оплаты и порядок приемки, если роль «${role}» зависит от подписания актов.`,
      `Сверить штрафы, удержания и право одностороннего изменения условий, влияющих на роль «${role}».`,
      `Оценить условия расторжения и срок уведомления, которые могут создать дополнительную нагрузку на роль «${role}».`,
    ],
    risks: (role) => [
      {
        severity: 'high',
        title: 'Неограниченная ответственность',
        description: `В договоре нет верхнего лимита убытков, поэтому для роли «${role}» риск по претензиям остается открытым.`,
        recommendation: 'Добавить совокупный лимит ответственности, привязанный к цене договора.',
      },
      {
        severity: 'medium',
        title: 'Размытый порядок приемки',
        description: `Критерии приемки сформулированы общо, из-за чего роль «${role}» может столкнуться с затяжным согласованием.`,
        recommendation: 'Закрепить измеримые критерии приемки и срок ответа на замечания.',
      },
      {
        severity: 'low',
        title: 'Слабая детализация коммуникаций',
        description: `Нет четкого канала уведомлений, поэтому важные сообщения для роли «${role}» могут быть оспорены.`,
        recommendation: 'Прописать официальный канал уведомлений и момент, когда сообщение считается полученным.',
      },
    ],
    disputedClauses: (role) => [
      {
        whyDisputed: `Право на одностороннее расторжение сформулировано в пользу другой стороны и создает перекос против роли «${role}».`,
        suggestedRewrite: 'Сделать право на расторжение симметричным и установить одинаковый срок уведомления для обеих сторон.',
      },
      {
        whyDisputed: `Порядок согласования дополнительных работ не фиксирует, кто подтверждает объем и цену, что критично для роли «${role}».`,
        suggestedRewrite: 'Добавить обязательное письменное согласование объема, цены и срока дополнительных работ до начала исполнения.',
      },
    ],
  },
  en: {
    reportTitle: (fileName) => `Contract review: ${fileName}`,
    contractType: 'Service Agreement',
    shortDescription: (role) =>
      `The document defines service scope, acceptance timing, payment, and liability boundaries. The report prioritizes obligations and risks for the “${role}” role.`,
    obligations: (role) => [
      `Verify payment timing and acceptance mechanics if the “${role}” side depends on signed acceptance documents.`,
      `Check penalties, deductions, and unilateral change rights that directly affect the “${role}” side.`,
      `Review termination mechanics and notice windows that could add operational pressure to the “${role}” side.`,
    ],
    risks: (role) => [
      {
        severity: 'high',
        title: 'Unlimited liability exposure',
        description: `The contract does not cap losses, leaving the “${role}” side exposed to open-ended claims.`,
        recommendation: 'Add an aggregate liability cap linked to contract value.',
      },
      {
        severity: 'medium',
        title: 'Ambiguous acceptance procedure',
        description: `Acceptance criteria stay vague, so the “${role}” side may face prolonged approval cycles.`,
        recommendation: 'Define measurable acceptance criteria and a response deadline for comments.',
      },
      {
        severity: 'low',
        title: 'Weak notice channel definition',
        description: `The notice channel is not formalized, which may undermine key messages for the “${role}” side.`,
        recommendation: 'Specify the official notice channel and when a notice is deemed received.',
      },
    ],
    disputedClauses: (role) => [
      {
        whyDisputed: `Termination for convenience is drafted asymmetrically and disadvantages the “${role}” side.`,
        suggestedRewrite: 'Make termination rights symmetrical and apply the same notice period to both parties.',
      },
      {
        whyDisputed: `The change-order flow does not define who confirms scope and price, which is risky for the “${role}” side.`,
        suggestedRewrite: 'Require written approval of scope, price, and delivery date before extra work starts.',
      },
    ],
  },
  it: {
    reportTitle: (fileName) => `Revisione contratto: ${fileName}`,
    contractType: 'Contratto di servizi',
    shortDescription: (role) =>
      `Il documento definisce ambito dei servizi, accettazione, pagamento e responsabilità. Il report dà priorità agli obblighi e ai rischi per il ruolo “${role}”.`,
    obligations: (role) => [
      `Verificare tempi di pagamento e meccanica di accettazione se il ruolo “${role}” dipende dalla firma dei verbali.`,
      `Controllare penali, trattenute e diritti di modifica unilaterale che impattano il ruolo “${role}”.`,
      `Rivedere recesso e termini di preavviso che possono aumentare la pressione operativa sul ruolo “${role}”.`,
    ],
    risks: (role) => [
      {
        severity: 'high',
        title: 'Responsabilità senza limite',
        description: `Il contratto non prevede un tetto ai danni e lascia il ruolo “${role}” esposto a pretese aperte.`,
        recommendation: 'Inserire un limite complessivo di responsabilità collegato al valore del contratto.',
      },
      {
        severity: 'medium',
        title: 'Procedura di accettazione ambigua',
        description: `I criteri di accettazione sono vaghi e il ruolo “${role}” può subire approvazioni molto lente.`,
        recommendation: 'Definire criteri misurabili di accettazione e un termine per le osservazioni.',
      },
      {
        severity: 'low',
        title: 'Canale notifiche poco chiaro',
        description: `Il canale di notifica non è formalizzato e i messaggi importanti per il ruolo “${role}” possono essere contestati.`,
        recommendation: 'Stabilire il canale ufficiale di notifica e il momento di ricezione.',
      },
    ],
    disputedClauses: (role) => [
      {
        whyDisputed: `Il recesso per convenienza è asimmetrico e penalizza il ruolo “${role}”.`,
        suggestedRewrite: 'Rendere simmetrici i diritti di recesso e applicare lo stesso preavviso a entrambe le parti.',
      },
      {
        whyDisputed: `Il flusso per lavori extra non definisce chi approva ambito e prezzo, con rischio per il ruolo “${role}”.`,
        suggestedRewrite: 'Richiedere approvazione scritta di ambito, prezzo e termine prima dell’avvio di attività extra.',
      },
    ],
  },
  fr: {
    reportTitle: (fileName) => `Revue du contrat : ${fileName}`,
    contractType: 'Contrat de services',
    shortDescription: (role) =>
      `Le document décrit le périmètre des services, l’acceptation, le paiement et la responsabilité. Le rapport priorise les obligations et risques pour le rôle « ${role} ».`,
    obligations: (role) => [
      `Vérifier les délais de paiement et la mécanique d’acceptation si le rôle « ${role} » dépend de documents signés.`,
      `Contrôler pénalités, retenues et droits de modification unilatérale qui touchent directement le rôle « ${role} ».`,
      `Examiner résiliation et préavis pouvant créer une pression opérationnelle sur le rôle « ${role} ».`,
    ],
    risks: (role) => [
      {
        severity: 'high',
        title: 'Responsabilité sans plafond',
        description: `Le contrat ne limite pas les pertes et expose le rôle « ${role} » à des réclamations ouvertes.`,
        recommendation: 'Ajouter un plafond global de responsabilité lié à la valeur du contrat.',
      },
      {
        severity: 'medium',
        title: 'Procédure d’acceptation ambiguë',
        description: `Les critères d’acceptation restent vagues et le rôle « ${role} » peut subir un cycle d’approbation long.`,
        recommendation: 'Définir des critères mesurables d’acceptation et un délai de réponse aux remarques.',
      },
      {
        severity: 'low',
        title: 'Canal de notification faible',
        description: `Le canal de notification n’est pas formalisé, ce qui fragilise les messages importants pour le rôle « ${role} ».`,
        recommendation: 'Préciser le canal officiel de notification et le moment où un avis est réputé reçu.',
      },
    ],
    disputedClauses: (role) => [
      {
        whyDisputed: `La résiliation pour convenance est rédigée de façon asymétrique et défavorise le rôle « ${role} ».`,
        suggestedRewrite: 'Rendre les droits de résiliation symétriques avec le même préavis pour les deux parties.',
      },
      {
        whyDisputed: `Le flux de travaux supplémentaires ne précise pas qui valide le périmètre et le prix, ce qui crée un risque pour le rôle « ${role} ».`,
        suggestedRewrite: 'Imposer une validation écrite du périmètre, du prix et du délai avant le début des travaux supplémentaires.',
      },
    ],
  },
};

const buildReport = (entity: StoredAnalysis, roleOverride?: string): AnalysisReport => {
  const role = roleOverride ?? entity.selectedRole;
  const template = localizedTemplates[entity.language] ?? localizedTemplates[defaultLanguage];

  return {
    analysisId: entity.analysisId,
    selectedRole: role,
    generatedAt: nowIso(),
    summary: {
      title: template.reportTitle(entity.fileName),
      contractType: template.contractType,
      shortDescription: template.shortDescription(role),
      obligationsForSelectedRole: template.obligations(role),
    },
    risks: template.risks(role).map((risk, index) => ({
      id: `${entity.analysisId}-risk-${index + 1}`,
      clauseRef: index === 0 ? 'Раздел 7.2' : index === 1 ? 'Раздел 4.1' : 'Раздел 2.4',
      ...risk,
    })),
    disputedClauses: template.disputedClauses(role).map((clause, index) => ({
      id: `${entity.analysisId}-dc-${index + 1}`,
      clauseRef: index === 0 ? 'Раздел 9.4' : 'Раздел 3.3',
      ...clause,
    })),
  };
};

const toStatus = (entity: StoredAnalysis): AnalysisStatus => {
  const status = lifecycle[Math.min(entity.statusIndex, lifecycle.length - 1)];
  return {
    analysisId: entity.analysisId,
    selectedRole: entity.selectedRole,
    status,
    progress: progressByStatus(status),
    updatedAt: entity.updatedAt,
  };
};

const toHistory = (entity: StoredAnalysis): HistoryItem => {
  const status = lifecycle[Math.min(entity.statusIndex, lifecycle.length - 1)];
  return {
    analysisId: entity.analysisId,
    fileName: entity.fileName,
    selectedRole: entity.selectedRole,
    status,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
};

export const createStubApiClient = (config: StubClientConfig = {}): ContractRiskScannerApi => ({
  async signIn(payload: SignInRequest, meta?: RequestMeta): Promise<UserSession> {
    await delay(250);
    const requestContext = prepareRequestContext(meta, config.getLanguage);
    const requestLanguage = payload.language ?? requestContext.language ?? defaultLanguage;

    return {
      accessToken: `stub-access-token-${requestLanguage}`,
      refreshToken: `stub-refresh-token-${requestLanguage}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      user: {
        id: 'stub-user-1',
        email: payload.email,
        displayName: 'Mobile Tester',
      },
    };
  },

  async uploadContract(
    payload: UploadContractRequest,
    meta?: RequestMeta,
  ): Promise<{ analysisId: string; status: AnalysisStatus }> {
    await delay(300);
    const requestContext = prepareRequestContext(meta, config.getLanguage);
    const language = payload.language ?? requestContext.language ?? defaultLanguage;

    const analysisId = `analysis_${Date.now()}`;
    const now = nowIso();

    const entity: StoredAnalysis = {
      analysisId,
      fileName: payload.fileName,
      selectedRole: payload.selectedRole,
      statusIndex: 0,
      createdAt: now,
      updatedAt: now,
      language,
    };

    storage.set(analysisId, entity);
    return { analysisId, status: toStatus(entity) };
  },

  async getAnalysisStatus(analysisId: string, meta?: RequestMeta): Promise<AnalysisStatus> {
    await delay(400);
    prepareRequestContext(meta, config.getLanguage);

    const entity = storage.get(analysisId);
    if (!entity) {
      return {
        analysisId,
        selectedRole: 'Unknown',
        status: 'failed',
        progress: 0,
        updatedAt: nowIso(),
      };
    }

    if (entity.statusIndex < lifecycle.length - 1) {
      entity.statusIndex += 1;
      entity.updatedAt = nowIso();
      storage.set(entity.analysisId, entity);
    }

    return toStatus(entity);
  },

  async getReport(input: { analysisId: string; selectedRole?: string }, meta?: RequestMeta): Promise<AnalysisReport> {
    await delay(450);
    const requestContext = prepareRequestContext(meta, config.getLanguage);

    const entity = storage.get(input.analysisId) ?? {
      analysisId: input.analysisId,
      fileName: 'contract-draft.pdf',
      selectedRole: input.selectedRole ?? 'Contractor',
      statusIndex: lifecycle.length - 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      language: requestContext.language,
    };

    return buildReport(entity, input.selectedRole);
  },

  async listHistory(meta?: RequestMeta): Promise<HistoryItem[]> {
    await delay(200);
    prepareRequestContext(meta, config.getLanguage);
    return [...storage.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((entry) => toHistory(entry));
  },
});
