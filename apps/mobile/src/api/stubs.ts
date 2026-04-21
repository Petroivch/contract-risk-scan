import type { SupportedLanguage } from '../i18n/types';
import { defaultLanguage } from '../i18n/types';

import { prepareRequestContext } from './client';
import type {
  AnalysisLifecycleStatus,
  AnalysisReport,
  AnalysisStatus,
  AnalyzeContractRequest,
  AnalyzeContractResponse,
  ContractRiskScannerApi,
  HistoryItem,
  PipelineStatus,
  RequestMeta,
  SignInRequest,
  UploadContractRequest,
  UploadContractResponse,
  UserSession,
} from './types';

interface StoredAnalysis {
  contractId: string;
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
  roleImpact: string;
  recommendation: string;
}

interface LocalizedDisputedDraft {
  fragment: string;
  issue: string;
  recommendation: string;
  whyDisputed: string;
  suggestedRewrite: string;
}

interface LocalizedTemplate {
  reportTitle: (fileName: string) => string;
  contractType: string;
  shortDescription: (role: string) => string;
  summaryText: (role: string) => string;
  obligationsForRole: (role: string) => string[];
  obligations: (role: string) => Array<{ subject: string; action: string; dueCondition: string }>;
  risks: (role: string) => LocalizedRiskDraft[];
  disputedClauses: (role: string) => LocalizedDisputedDraft[];
}

const lifecycle: AnalysisLifecycleStatus[] = ['queued', 'processing', 'processing', 'completed'];
const pipelineLifecycle: PipelineStatus[] = ['uploaded', 'preprocessing', 'analyzing', 'report_ready'];
const storage = new Map<string, StoredAnalysis>();

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const nowIso = (): string => new Date().toISOString();
const buildContractId = (): string => `ctr_${Date.now()}`;
const buildAnalysisId = (): string => `anl_${Date.now()}`;

const progressByStatusIndex = (statusIndex: number): number => {
  if (statusIndex <= 0) return 15;
  if (statusIndex === 1) return 42;
  if (statusIndex === 2) return 74;
  return 100;
};

const localizedTemplates: Record<SupportedLanguage, LocalizedTemplate> = {
  ru: {
    reportTitle: (fileName) => `Анализ договора: ${fileName}`,
    contractType: 'Договор оказания услуг',
    shortDescription: (role) =>
      `Документ описывает объем услуг, оплату, приемку, ответственность и прекращение. Отчет смещает акцент на риски и обязанности для роли «${role}».`,
    summaryText: (role) =>
      `Отчет собран для роли «${role}». В первую очередь выделены ответственность, порядок приемки, сроки оплаты и условия прекращения.`,
    obligationsForRole: (role) => [
      `Проверить срок оплаты и момент, когда у роли «${role}» возникает право на выставление документов.`,
      `Убедиться, что порядок приемки не позволяет другой стороне бесконечно затягивать подтверждение результата.`,
      `Отдельно проверить основания для удержаний, штрафов и одностороннего расторжения, влияющих на роль «${role}».`,
    ],
    obligations: (role) => [
      { subject: role, action: 'Исполнить согласованный объем работ', dueCondition: 'В сроки, указанные в основном разделе о графике' },
      { subject: role, action: 'Передать результаты по правилам приемки', dueCondition: 'После выполнения работ и до выставления финального счета' },
    ],
    risks: (role) => [
      {
        severity: 'high',
        title: 'Неограниченная ответственность',
        description: `В договоре нет лимита убытков, поэтому роль «${role}» остается открытой для крупных требований.`,
        roleImpact: `Для роли «${role}» это создает прямой финансовый риск выше стоимости договора.`,
        recommendation: 'Добавить совокупный лимит ответственности и перечень исключенных убытков.',
      },
      {
        severity: 'medium',
        title: 'Размытая приемка результата',
        description: `Критерии приемки сформулированы общо, из-за чего другая сторона может затянуть подтверждение.`,
        roleImpact: `Для роли «${role}» это задерживает оплату и формальное закрытие этапа.`,
        recommendation: 'Зафиксировать измеримые критерии приемки и срок ответа на замечания.',
      },
      {
        severity: 'low',
        title: 'Неоформленный канал уведомлений',
        description: `Договор не закрепляет официальный канал уведомлений и момент получения сообщения.`,
        roleImpact: `Для роли «${role}» это создает спорность при отправке претензий и уведомлений.`,
        recommendation: 'Установить официальный канал уведомлений и порядок подтверждения доставки.',
      },
    ],
    disputedClauses: (role) => [
      {
        fragment: 'Одна из сторон вправе в любое время отказаться от договора без ограничений.',
        issue: 'Условие о прекращении несимметрично и не защищает баланс сторон.',
        recommendation: 'Сделать право на расторжение взаимным и добавить единый срок уведомления.',
        whyDisputed: `Формулировка дает другой стороне слишком сильное преимущество против роли «${role}».`,
        suggestedRewrite: 'Каждая сторона вправе отказаться от договора с письменным уведомлением не менее чем за 30 календарных дней.',
      },
      {
        fragment: 'Дополнительные работы выполняются по устной договоренности сторон.',
        issue: 'Нет прозрачного механизма подтверждения объема и цены дополнительных работ.',
        recommendation: 'Требовать письменное согласование объема, цены и срока до начала работ.',
        whyDisputed: `Для роли «${role}» это создает спор о том, что именно было согласовано.`,
        suggestedRewrite: 'Дополнительные работы выполняются только после письменного согласования объема, цены и сроков обеими сторонами.',
      },
    ],
  },
  en: {
    reportTitle: (fileName) => `Contract review: ${fileName}`,
    contractType: 'Service Agreement',
    shortDescription: (role) =>
      `The document defines scope, payment, acceptance, liability, and termination. The report prioritizes obligations and risks for the “${role}” side.`,
    summaryText: (role) =>
      `The report is generated for the “${role}” side and emphasizes liability, acceptance timing, payment, and termination mechanics.`,
    obligationsForRole: (role) => [
      `Check when the “${role}” side becomes entitled to invoice and receive payment.`,
      'Confirm that acceptance wording does not allow endless approval delays.',
      `Review penalties, deductions, and unilateral termination triggers affecting the “${role}” side.`,
    ],
    obligations: (role) => [
      { subject: role, action: 'Deliver the agreed scope of work', dueCondition: 'Within the timeline set in the schedule section' },
      { subject: role, action: 'Submit deliverables under the acceptance procedure', dueCondition: 'After completion and before final invoicing' },
    ],
    risks: (role) => [
      {
        severity: 'high',
        title: 'Unlimited liability exposure',
        description: 'The agreement does not cap losses, leaving the party exposed to open-ended claims.',
        roleImpact: `For the “${role}” side, this creates financial exposure that can exceed contract value.`,
        recommendation: 'Introduce an aggregate liability cap and define excluded damages.',
      },
      {
        severity: 'medium',
        title: 'Ambiguous acceptance mechanics',
        description: 'Acceptance criteria stay broad and allow long approval cycles.',
        roleImpact: `For the “${role}” side, this delays payment and formal completion.`,
        recommendation: 'Set measurable acceptance criteria and a deadline for comments.',
      },
      {
        severity: 'low',
        title: 'Undefined notice channel',
        description: 'The agreement does not define an official notice channel or receipt moment.',
        roleImpact: `For the “${role}” side, this creates disputes around claims and notices.`,
        recommendation: 'Specify the notice channel and the moment when notice is deemed received.',
      },
    ],
    disputedClauses: (role) => [
      {
        fragment: 'One party may terminate the agreement at any time without limitation.',
        issue: 'Termination rights are asymmetrical and unbalanced.',
        recommendation: 'Make termination rights mutual and add the same notice period.',
        whyDisputed: `The current wording gives the other side a strong leverage against the “${role}” side.`,
        suggestedRewrite: 'Either party may terminate the agreement with at least 30 calendar days written notice.',
      },
      {
        fragment: 'Additional work may be agreed verbally by the parties.',
        issue: 'There is no transparent mechanism for confirming scope and price.',
        recommendation: 'Require written approval of scope, price, and delivery dates before extra work starts.',
        whyDisputed: `For the “${role}” side, this creates disputes about what was actually agreed.`,
        suggestedRewrite: 'Additional work is performed only after written approval of scope, price, and timing by both parties.',
      },
    ],
  },
  it: {
    reportTitle: (fileName) => `Revisione contratto: ${fileName}`,
    contractType: 'Contratto di servizi',
    shortDescription: (role) =>
      `Il documento definisce ambito, pagamento, accettazione, responsabilità e recesso. Il report dà priorità a obblighi e rischi per il ruolo “${role}”.`,
    summaryText: (role) =>
      `Il report è generato per il ruolo “${role}” e mette in evidenza responsabilità, accettazione, pagamento e recesso.`,
    obligationsForRole: (role) => [
      `Controllare quando il ruolo “${role}” matura il diritto a fatturare e ricevere il pagamento.`,
      'Confermare che l’accettazione non consenta ritardi indefiniti di approvazione.',
      `Rivedere penali, trattenute e trigger di recesso unilaterale che colpiscono il ruolo “${role}”.`,
    ],
    obligations: (role) => [
      { subject: role, action: 'Eseguire l’ambito concordato', dueCondition: 'Entro le scadenze del calendario contrattuale' },
      { subject: role, action: 'Consegnare il risultato secondo la procedura di accettazione', dueCondition: 'Dopo l’esecuzione e prima della fattura finale' },
    ],
    risks: (role) => [
      {
        severity: 'high',
        title: 'Responsabilità senza limite',
        description: 'L’accordo non prevede un tetto alle perdite e lascia la parte esposta a pretese aperte.',
        roleImpact: `Per il ruolo “${role}” questo crea un’esposizione economica superiore al valore del contratto.`,
        recommendation: 'Introdurre un tetto complessivo di responsabilità e definire i danni esclusi.',
      },
      {
        severity: 'medium',
        title: 'Accettazione ambigua',
        description: 'I criteri di accettazione sono ampi e consentono cicli lunghi di approvazione.',
        roleImpact: `Per il ruolo “${role}” questo ritarda pagamento e chiusura formale.`,
        recommendation: 'Definire criteri misurabili di accettazione e un termine per i commenti.',
      },
      {
        severity: 'low',
        title: 'Canale notifiche non definito',
        description: 'Il contratto non definisce un canale ufficiale di notifica né il momento di ricezione.',
        roleImpact: `Per il ruolo “${role}” questo crea contestazioni su diffide e notifiche.`,
        recommendation: 'Specificare il canale di notifica e il momento in cui la comunicazione si considera ricevuta.',
      },
    ],
    disputedClauses: (role) => [
      {
        fragment: 'Una parte può recedere in qualsiasi momento senza limitazioni.',
        issue: 'I diritti di recesso sono asimmetrici e sbilanciati.',
        recommendation: 'Rendere reciproco il diritto di recesso e fissare lo stesso preavviso.',
        whyDisputed: `La formulazione attuale dà all’altra parte una leva troppo forte contro il ruolo “${role}”.`,
        suggestedRewrite: 'Ciascuna parte può recedere con preavviso scritto di almeno 30 giorni di calendario.',
      },
      {
        fragment: 'Le attività aggiuntive possono essere concordate verbalmente.',
        issue: 'Manca un meccanismo trasparente per confermare ambito e prezzo.',
        recommendation: 'Richiedere approvazione scritta di ambito, prezzo e tempi prima dell’avvio.',
        whyDisputed: `Per il ruolo “${role}” questo crea controversie su ciò che è stato concordato.`,
        suggestedRewrite: 'Le attività aggiuntive sono eseguite solo dopo approvazione scritta di ambito, prezzo e tempi da parte di entrambe le parti.',
      },
    ],
  },
  fr: {
    reportTitle: (fileName) => `Revue du contrat : ${fileName}`,
    contractType: 'Contrat de services',
    shortDescription: (role) =>
      `Le document définit le périmètre, le paiement, l’acceptation, la responsabilité et la résiliation. Le rapport priorise obligations et risques pour le rôle « ${role} ».`,
    summaryText: (role) =>
      `Le rapport est généré pour le rôle « ${role} » et met l’accent sur responsabilité, acceptation, paiement et résiliation.`,
    obligationsForRole: (role) => [
      `Vérifier le moment où le rôle « ${role} » acquiert le droit de facturer et d’être payé.`,
      'Confirmer que l’acceptation ne permet pas des retards illimités de validation.',
      `Examiner pénalités, retenues et déclencheurs de résiliation unilatérale affectant le rôle « ${role} ».`,
    ],
    obligations: (role) => [
      { subject: role, action: 'Exécuter le périmètre convenu', dueCondition: 'Dans les délais prévus par le calendrier contractuel' },
      { subject: role, action: 'Remettre le résultat selon la procédure d’acceptation', dueCondition: 'Après exécution et avant la facture finale' },
    ],
    risks: (role) => [
      {
        severity: 'high',
        title: 'Responsabilité sans plafond',
        description: 'Le contrat ne limite pas les pertes et laisse la partie exposée à des réclamations ouvertes.',
        roleImpact: `Pour le rôle « ${role} », cela crée une exposition financière supérieure à la valeur du contrat.`,
        recommendation: 'Introduire un plafond global de responsabilité et définir les dommages exclus.',
      },
      {
        severity: 'medium',
        title: 'Acceptation ambiguë',
        description: 'Les critères d’acceptation restent larges et permettent des cycles longs de validation.',
        roleImpact: `Pour le rôle « ${role} », cela retarde paiement et clôture formelle.`,
        recommendation: 'Définir des critères mesurables d’acceptation et un délai pour les remarques.',
      },
      {
        severity: 'low',
        title: 'Canal de notification non défini',
        description: 'Le contrat ne précise ni canal officiel de notification ni moment de réception.',
        roleImpact: `Pour le rôle « ${role} », cela crée des litiges sur mises en demeure et notifications.`,
        recommendation: 'Préciser le canal de notification et le moment où la notification est réputée reçue.',
      },
    ],
    disputedClauses: (role) => [
      {
        fragment: 'Une partie peut résilier à tout moment sans limitation.',
        issue: 'Les droits de résiliation sont asymétriques et déséquilibrés.',
        recommendation: 'Rendre la résiliation réciproque avec le même préavis.',
        whyDisputed: `La formulation actuelle donne à l’autre partie un levier trop fort contre le rôle « ${role} ».`,
        suggestedRewrite: 'Chaque partie peut résilier avec un préavis écrit d’au moins 30 jours calendaires.',
      },
      {
        fragment: 'Les travaux supplémentaires peuvent être convenus oralement.',
        issue: 'Aucun mécanisme transparent ne confirme périmètre et prix.',
        recommendation: 'Exiger une validation écrite du périmètre, du prix et du calendrier avant démarrage.',
        whyDisputed: `Pour le rôle « ${role} », cela crée un litige sur ce qui a réellement été approuvé.`,
        suggestedRewrite: 'Les travaux supplémentaires sont exécutés uniquement après validation écrite du périmètre, du prix et du calendrier par les deux parties.',
      },
    ],
  },
};

const toLifecycleStatus = (statusIndex: number): AnalysisLifecycleStatus => lifecycle[Math.min(statusIndex, lifecycle.length - 1)];
const toPipelineStatus = (statusIndex: number): PipelineStatus => pipelineLifecycle[Math.min(statusIndex, pipelineLifecycle.length - 1)];

const buildUploadResponse = (entity: StoredAnalysis): UploadContractResponse => ({
  contractId: entity.contractId,
  analysisId: entity.analysisId,
  status: 'queued',
  pipelineStatus: 'uploaded',
  locale: entity.language,
  selectedRole: entity.selectedRole,
  progress: 15,
  originalFileName: entity.fileName,
  uploadedAt: entity.createdAt,
});

const buildAnalyzeResponse = (entity: StoredAnalysis): AnalyzeContractResponse => ({
  contractId: entity.contractId,
  analysisId: entity.analysisId,
  status: toLifecycleStatus(entity.statusIndex),
  pipelineStatus: toPipelineStatus(entity.statusIndex),
  locale: entity.language,
  selectedRole: entity.selectedRole,
  progress: progressByStatusIndex(entity.statusIndex),
  message: 'Analysis accepted for execution.',
});

const buildStatus = (entity: StoredAnalysis): AnalysisStatus => ({
  contractId: entity.contractId,
  analysisId: entity.analysisId,
  status: toLifecycleStatus(entity.statusIndex),
  pipelineStatus: toPipelineStatus(entity.statusIndex),
  locale: entity.language,
  progress: progressByStatusIndex(entity.statusIndex),
  selectedRole: entity.selectedRole,
  allowedTransitions: ['preprocessing', 'analyzing', 'report_ready', 'failed'],
  updatedAt: entity.updatedAt,
});

const buildHistoryItem = (entity: StoredAnalysis): HistoryItem => ({
  contractId: entity.contractId,
  analysisId: entity.analysisId,
  role: entity.selectedRole,
  selectedRole: entity.selectedRole,
  locale: entity.language,
  status: toLifecycleStatus(entity.statusIndex),
  pipelineStatus: toPipelineStatus(entity.statusIndex),
  originalFileName: entity.fileName,
  fileName: entity.fileName,
  uploadedAt: entity.createdAt,
  createdAt: entity.createdAt,
  updatedAt: entity.updatedAt,
});

const buildReport = (entity: StoredAnalysis, selectedRole?: string): AnalysisReport => {
  const role = selectedRole ?? entity.selectedRole;
  const template = localizedTemplates[entity.language] ?? localizedTemplates[defaultLanguage];

  return {
    contractId: entity.contractId,
    analysisId: entity.analysisId,
    locale: entity.language,
    roleFocus: role,
    selectedRole: role,
    summary: {
      title: template.reportTitle(entity.fileName),
      contractType: template.contractType,
      shortDescription: template.shortDescription(role),
      obligationsForSelectedRole: template.obligationsForRole(role),
    },
    summaryText: template.summaryText(role),
    obligations: template.obligations(role),
    risks: template.risks(role).map((risk, index) => ({
      id: `${entity.analysisId}-risk-${index + 1}`,
      clauseRef: index === 0 ? '7.2' : index === 1 ? '4.1' : '2.4',
      ...risk,
    })),
    disputedClauses: template.disputedClauses(role).map((item, index) => ({
      id: `${entity.analysisId}-dc-${index + 1}`,
      clauseRef: index === 0 ? '9.4' : '3.3',
      ...item,
    })),
    generatedAt: nowIso(),
    generationNotes: null,
  };
};

export const createStubApiClient = (config: StubClientConfig = {}): ContractRiskScannerApi => ({
  async signIn(payload: SignInRequest, meta?: RequestMeta): Promise<UserSession> {
    await delay(200);
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

  async uploadContract(payload: UploadContractRequest, meta?: RequestMeta): Promise<UploadContractResponse> {
    await delay(250);
    const requestContext = prepareRequestContext(meta, config.getLanguage);
    const language = payload.language ?? requestContext.language ?? defaultLanguage;
    const now = nowIso();
    const entity: StoredAnalysis = {
      contractId: buildContractId(),
      analysisId: buildAnalysisId(),
      fileName: payload.fileName,
      selectedRole: payload.selectedRole,
      statusIndex: 0,
      createdAt: now,
      updatedAt: now,
      language,
    };

    storage.set(entity.contractId, entity);
    return buildUploadResponse(entity);
  },

  async analyzeContract(payload: AnalyzeContractRequest): Promise<AnalyzeContractResponse> {
    await delay(220);
    const entity = storage.get(payload.contractId);

    if (!entity) {
      const fallbackEntity: StoredAnalysis = {
        contractId: payload.contractId,
        analysisId: payload.analysisId ?? buildAnalysisId(),
        fileName: 'offline-contract.pdf',
        selectedRole: payload.selectedRole,
        statusIndex: 1,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        language: defaultLanguage,
      };
      storage.set(fallbackEntity.contractId, fallbackEntity);
      return buildAnalyzeResponse(fallbackEntity);
    }

    entity.statusIndex = Math.max(entity.statusIndex, 1);
    entity.updatedAt = nowIso();
    storage.set(entity.contractId, entity);
    return buildAnalyzeResponse(entity);
  },

  async getAnalysisStatus(input): Promise<AnalysisStatus> {
    await delay(260);
    const entity = storage.get(input.contractId);

    if (!entity) {
      return {
        contractId: input.contractId,
        analysisId: input.analysisId ?? buildAnalysisId(),
        status: 'failed',
        pipelineStatus: 'failed',
        locale: defaultLanguage,
        progress: 0,
        selectedRole: 'Unknown',
        allowedTransitions: ['failed'],
        updatedAt: nowIso(),
        errorCode: 'LOCAL_STUB_NOT_FOUND',
        errorMessage: 'No local analysis session was found for this contract.',
      };
    }

    if (entity.statusIndex < lifecycle.length - 1) {
      entity.statusIndex += 1;
      entity.updatedAt = nowIso();
      storage.set(entity.contractId, entity);
    }

    return buildStatus(entity);
  },

  async getReport(input, meta?: RequestMeta): Promise<AnalysisReport> {
    await delay(240);
    const requestContext = prepareRequestContext(meta, config.getLanguage);
    const entity = storage.get(input.contractId) ?? {
      contractId: input.contractId,
      analysisId: input.analysisId ?? buildAnalysisId(),
      fileName: 'offline-contract.pdf',
      selectedRole: input.selectedRole ?? 'contractor',
      statusIndex: lifecycle.length - 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      language: requestContext.language,
    };

    return buildReport(entity, input.selectedRole);
  },

  async listHistory(): Promise<HistoryItem[]> {
    await delay(160);
    return [...storage.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((item) => buildHistoryItem(item));
  },
});
