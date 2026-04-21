import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalysisLifecycleStatus } from '../common/domain/analysis-lifecycle-status.enum';
import { RiskSeverity } from '../common/domain/risk-severity.enum';
import { normalizeLocale } from '../common/i18n/locale.utils';
import { SupportedLocale } from '../common/i18n/supported-locale.enum';
import {
  AnalysisJobState,
  JobOrchestrationService
} from '../common/job-orchestration/job-orchestration.service';
import { JobStatus } from '../common/job-orchestration/job-status.enum';
import { getContractReportText } from '../common/policies/contract-report-text.policy';
import { CONTRACT_POLICY } from '../common/policies/contracts.policy';
import { MESSAGE_POLICY } from '../common/policies/messages.policy';
import { generateEntityId } from '../common/utils/id.util';
import { AppConfig } from '../config/app-config.type';
import {
  AnalysisEngineClient,
  AnalysisEngineOutput,
  AnalysisEngineUnavailableError
} from './analysis-engine.client';
import { ContractsRepository } from './contracts.repository';
import { AnalyzeContractDto } from './dto/analyze-contract.dto';
import { AnalyzeContractResponseDto } from './dto/analyze-contract-response.dto';
import { ContractHistoryItemDto } from './dto/contracts-history-response.dto';
import {
  ContractObligationDto,
  ContractReportDto,
  ContractRiskDto,
  ContractSummaryDto,
  DisputedClauseDto
} from './dto/contract-report.dto';
import { ContractStatusResponseDto } from './dto/contract-status-response.dto';
import { UploadContractDto } from './dto/upload-contract.dto';
import { UploadContractResponseDto } from './dto/upload-contract-response.dto';
import { StoredContract } from './stored-contract.type';

interface StartAnalysisOptions {
  locale: SupportedLocale;
  focusNotes?: string;
}

@Injectable()
export class ContractsService {
  private readonly activeMonitors = new Set<string>();

  constructor(
    private readonly jobOrchestration: JobOrchestrationService,
    private readonly analysisEngineClient: AnalysisEngineClient,
    private readonly contractsRepository: ContractsRepository,
    private readonly configService: ConfigService<AppConfig, true>
  ) {}

  async upload(
    dto: UploadContractDto,
    file?: Express.Multer.File
  ): Promise<UploadContractResponseDto> {
    this.validateUploadedFile(file);

    const locale = normalizeLocale(dto.locale ?? dto.language);
    const contractId = generateEntityId(CONTRACT_POLICY.CONTRACT_ID_PREFIX);
    const now = new Date().toISOString();

    const contract = await this.contractsRepository.create({
      contract: {
        id: contractId,
        role: dto.role,
        locale,
        counterpartyRole: this.normalizeOptionalText(dto.counterpartyRole),
        contractLabel: this.normalizeOptionalText(dto.contractLabel),
        originalFileName: file.originalname,
        storedFileName: '',
        storedFilePath: '',
        fileMimeType: file.mimetype,
        fileSizeBytes: file.size,
        uploadedAt: now,
        updatedAt: now,
        job: {
          contractId,
          status: JobStatus.Uploaded,
          updatedAt: now
        }
      },
      file
    });

    const started = await this.startAnalysisForContract(contract.id, { locale });
    return this.buildUploadResponse(started);
  }

  async analyze(
    contractId: string,
    dto: AnalyzeContractDto = {}
  ): Promise<AnalyzeContractResponseDto> {
    const contract = await this.requireContract(contractId);
    const locale = normalizeLocale(dto.locale ?? dto.language ?? contract.locale);

    if (this.isPending(contract)) {
      return this.buildAnalyzeResponse(contract, MESSAGE_POLICY.ANALYSIS_IN_PROGRESS);
    }

    if (contract.job.status === JobStatus.ReportReady && !dto.forceReanalyze) {
      return this.buildAnalyzeResponse(contract, MESSAGE_POLICY.ANALYSIS_ALREADY_READY);
    }

    const started = await this.startAnalysisForContract(contractId, {
      locale,
      focusNotes: this.normalizeOptionalText(dto.focusNotes)
    });

    const message =
      started.job.status === JobStatus.Failed
        ? started.job.errorMessage ?? MESSAGE_POLICY.ANALYSIS_FAILED
        : MESSAGE_POLICY.ANALYSIS_ACCEPTED;

    return this.buildAnalyzeResponse(started, message);
  }

  async status(contractId: string): Promise<ContractStatusResponseDto> {
    const contract = await this.safeSyncContract(contractId);
    return this.buildStatusResponse(contract);
  }

  async report(contractId: string): Promise<ContractReportDto | null> {
    const contract = await this.safeSyncContract(contractId);

    if (contract.job.status !== JobStatus.ReportReady || !contract.report) {
      return null;
    }

    return contract.report;
  }

  async history(): Promise<ContractHistoryItemDto[]> {
    const items = await this.contractsRepository.list();
    const syncedItems = await Promise.all(items.map((item) => this.safeSyncContract(item.id)));

    return syncedItems
      .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))
      .map((item) => this.buildHistoryItem(item));
  }

  private async startAnalysisForContract(
    contractId: string,
    options: StartAnalysisOptions
  ): Promise<StoredContract> {
    let contract = await this.requireContract(contractId);
    contract.locale = options.locale;
    contract.focusNotes = this.normalizeOptionalText(options.focusNotes);
    contract.report = undefined;
    contract.analysisJobId = undefined;
    contract = await this.prepareJobForAnalysis(contract);

    try {
      const payload = await this.buildAnalysisPayload(contract);
      const run = await this.analysisEngineClient.runAnalysis(payload);

      contract.analysisJobId = run.jobId;
      if (run.status === 'processing') {
        contract.job = this.advanceJob(contract.job, JobStatus.Analyzing);
      }

      contract.updatedAt = contract.job.updatedAt;
      contract = await this.contractsRepository.save(contract);
      this.monitorContract(contract.id);

      return contract;
    } catch (error) {
      return this.markFailed(contract, this.describeAnalysisFailure(error));
    }
  }

  private async prepareJobForAnalysis(contract: StoredContract): Promise<StoredContract> {
    let nextJob = contract.job;

    if (nextJob.status === JobStatus.Uploaded) {
      nextJob = this.advanceJob(nextJob, JobStatus.Queued);
    } else if (
      nextJob.status === JobStatus.ReportReady ||
      nextJob.status === JobStatus.Failed
    ) {
      nextJob = this.advanceJob(nextJob, JobStatus.Queued);
    }

    if (nextJob.status === JobStatus.Queued) {
      nextJob = this.advanceJob(nextJob, JobStatus.Preprocessing);
    }

    const prepared: StoredContract = {
      ...contract,
      job: nextJob,
      updatedAt: nextJob.updatedAt
    };

    return this.contractsRepository.save(prepared);
  }

  private async buildAnalysisPayload(contract: StoredContract): Promise<{
    contractId: string;
    documentName: string;
    role: string;
    counterpartyRole?: string;
    locale: SupportedLocale;
    focusNotes?: string;
    documentText?: string;
    documentBase64?: string;
    mimeType?: string;
  }> {
    const fileBuffer = await this.contractsRepository.readStoredFile(contract.id);

    if (contract.fileMimeType === 'text/plain') {
      return {
        contractId: contract.id,
        documentName: contract.originalFileName,
        role: contract.role,
        counterpartyRole: contract.counterpartyRole,
        locale: contract.locale,
        focusNotes: contract.focusNotes,
        documentText: fileBuffer.toString('utf8'),
        mimeType: contract.fileMimeType
      };
    }

    return {
      contractId: contract.id,
      documentName: contract.originalFileName,
      role: contract.role,
      counterpartyRole: contract.counterpartyRole,
      locale: contract.locale,
      focusNotes: contract.focusNotes,
      documentBase64: fileBuffer.toString('base64'),
      mimeType: contract.fileMimeType
    };
  }

  private monitorContract(contractId: string): void {
    if (this.activeMonitors.has(contractId)) {
      return;
    }

    this.activeMonitors.add(contractId);
    void this.runMonitor(contractId);
  }

  private async runMonitor(contractId: string): Promise<void> {
    const pollIntervalMs = this.configService.get('analysisEngine.pollIntervalMs', {
      infer: true
    });
    const maxPollingDurationMs = this.configService.get(
      'analysisEngine.maxPollingDurationMs',
      { infer: true }
    );
    const startedAt = Date.now();

    try {
      while (Date.now() - startedAt < maxPollingDurationMs) {
        const contract = await this.requireContract(contractId);
        if (!this.isPending(contract) || !contract.analysisJobId) {
          return;
        }

        try {
          const synced = await this.syncContractState(contract);
          if (!this.isPending(synced)) {
            return;
          }
        } catch {
          // Keep polling until timeout; transient transport issues should not corrupt job state.
        }

        await this.delay(pollIntervalMs);
      }

      const latest = await this.requireContract(contractId);
      if (this.isPending(latest)) {
        await this.markFailed(latest, MESSAGE_POLICY.ANALYSIS_TIMEOUT);
      }
    } finally {
      this.activeMonitors.delete(contractId);
    }
  }

  private async safeSyncContract(contractId: string): Promise<StoredContract> {
    const contract = await this.requireContract(contractId);
    if (!this.isPending(contract) || !contract.analysisJobId) {
      return contract;
    }

    try {
      return await this.syncContractState(contract);
    } catch {
      return contract;
    }
  }

  private async syncContractState(contract: StoredContract): Promise<StoredContract> {
    if (!contract.analysisJobId) {
      return contract;
    }

    const remoteStatus = await this.analysisEngineClient.getAnalysisStatus(
      contract.analysisJobId,
      contract.locale
    );

    if (remoteStatus.status === 'queued') {
      return contract;
    }

    if (remoteStatus.status === 'processing') {
      if (contract.job.status !== JobStatus.Analyzing) {
        const analyzing = {
          ...contract,
          job: this.advanceJob(contract.job, JobStatus.Analyzing)
        };
        analyzing.updatedAt = analyzing.job.updatedAt;
        return this.contractsRepository.save(analyzing);
      }

      return contract;
    }

    if (remoteStatus.status === 'failed') {
      return this.markFailed(
        contract,
        remoteStatus.errorMessage ?? MESSAGE_POLICY.ANALYSIS_FAILED
      );
    }

    const remoteResult = await this.analysisEngineClient.getAnalysisResult(
      contract.analysisJobId,
      contract.locale
    );

    if (remoteResult.status === 'failed') {
      return this.markFailed(
        contract,
        remoteResult.errorMessage ?? MESSAGE_POLICY.ANALYSIS_FAILED
      );
    }

    if (!remoteResult.result) {
      return this.markFailed(contract, MESSAGE_POLICY.ANALYSIS_RESULT_MISSING);
    }

    return this.completeContract(contract, remoteResult.result);
  }

  private async completeContract(
    contract: StoredContract,
    remoteResult: AnalysisEngineOutput
  ): Promise<StoredContract> {
    let job = contract.job;
    if (job.status !== JobStatus.Analyzing) {
      job = this.advanceJob(job, JobStatus.Analyzing);
    }

    job = this.advanceJob(job, JobStatus.ReportReady);

    const completed: StoredContract = {
      ...contract,
      locale: normalizeLocale(remoteResult.locale),
      job,
      report: this.buildReport(contract, remoteResult),
      updatedAt: job.updatedAt
    };

    return this.contractsRepository.save(completed);
  }

  private async markFailed(
    contract: StoredContract,
    errorMessage: string
  ): Promise<StoredContract> {
    let job = contract.job;
    if (job.status !== JobStatus.Failed) {
      if (!this.jobOrchestration.canTransition(job.status, JobStatus.Failed)) {
        throw new BadRequestException(
          `Invalid status transition: ${job.status} -> ${JobStatus.Failed}`
        );
      }

      job = this.jobOrchestration.transition(job, JobStatus.Failed);
    }

    const failed: StoredContract = {
      ...contract,
      job: {
        ...job,
        errorCode: CONTRACT_POLICY.ANALYSIS_ERROR_CODE,
        errorMessage
      },
      updatedAt: job.updatedAt
    };

    return this.contractsRepository.save(failed);
  }

  private buildReport(
    contract: StoredContract,
    remoteResult: AnalysisEngineOutput
  ): ContractReportDto {
    const locale = normalizeLocale(remoteResult.locale);
    const textPolicy = getContractReportText(locale);

    const obligations: ContractObligationDto[] = [
      ...remoteResult.role_focused_summary.must_do.map((item) =>
        this.buildObligation(contract.role, item, textPolicy.mustDoDueCondition)
      ),
      ...remoteResult.role_focused_summary.payment_terms.map((item) =>
        this.buildObligation(contract.role, item, textPolicy.paymentDueCondition)
      ),
      ...remoteResult.role_focused_summary.deadlines.map((item) =>
        this.buildObligation(contract.role, item, textPolicy.deadlineDueCondition)
      ),
      ...remoteResult.role_focused_summary.should_review.map((item) =>
        this.buildObligation(contract.role, item, textPolicy.reviewDueCondition)
      )
    ];

    const summary: ContractSummaryDto = {
      title: contract.contractLabel || contract.originalFileName || textPolicy.defaultTitle,
      contractType: this.resolveContractTypeLabel(contract.fileMimeType, locale),
      shortDescription: remoteResult.contract_brief,
      obligationsForSelectedRole: this.uniqueStrings([
        ...remoteResult.role_focused_summary.must_do,
        ...remoteResult.role_focused_summary.payment_terms,
        ...remoteResult.role_focused_summary.deadlines,
        ...remoteResult.role_focused_summary.penalties
      ])
    };

    const risks: ContractRiskDto[] = remoteResult.risks.map((risk) => ({
      id: risk.risk_id,
      clauseRef: risk.clause_id || textPolicy.unknownClauseRef,
      title: risk.title,
      severity: this.mapSeverity(risk.severity),
      description: risk.description,
      roleImpact: risk.role_relevance,
      recommendation: risk.mitigation
    }));

    const disputedClauses: DisputedClauseDto[] = remoteResult.disputed_clauses.map((clause) => ({
      id: `${contract.id}_${clause.clause_id}`,
      clauseRef: clause.clause_id || textPolicy.unknownClauseRef,
      fragment: clause.clause_excerpt,
      issue: clause.dispute_reason,
      recommendation: clause.possible_consequence,
      whyDisputed: clause.dispute_reason,
      suggestedRewrite: textPolicy.disputedRewriteFallback
    }));

    return {
      contractId: contract.id,
      analysisId: contract.id,
      locale,
      roleFocus: contract.role,
      selectedRole: contract.role,
      summary,
      summaryText: remoteResult.contract_brief,
      obligations,
      risks,
      disputedClauses,
      generatedAt: new Date().toISOString(),
      generationNotes: contract.focusNotes ?? null
    };
  }

  private buildObligation(
    subject: string,
    action: string,
    dueCondition: string
  ): ContractObligationDto {
    return {
      subject,
      action,
      dueCondition
    };
  }

  private resolveContractTypeLabel(
    mimeType: string,
    locale: SupportedLocale
  ): string {
    const textPolicy = getContractReportText(locale);

    if (mimeType === 'application/pdf') {
      return textPolicy.pdfContractType;
    }

    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return textPolicy.docxContractType;
    }

    if (mimeType === 'text/plain') {
      return textPolicy.textContractType;
    }

    return textPolicy.defaultContractType;
  }

  private buildUploadResponse(contract: StoredContract): UploadContractResponseDto {
    return {
      contractId: contract.id,
      analysisId: contract.id,
      status: this.toLifecycleStatus(contract.job.status),
      pipelineStatus: contract.job.status,
      locale: contract.locale,
      selectedRole: contract.role,
      progress: this.toProgress(contract.job.status),
      uploadedAt: contract.uploadedAt,
      originalFileName: contract.originalFileName
    };
  }

  private buildAnalyzeResponse(
    contract: StoredContract,
    message: string
  ): AnalyzeContractResponseDto {
    return {
      contractId: contract.id,
      analysisId: contract.id,
      status: this.toLifecycleStatus(contract.job.status),
      pipelineStatus: contract.job.status,
      locale: contract.locale,
      selectedRole: contract.role,
      progress: this.toProgress(contract.job.status),
      message
    };
  }

  private buildStatusResponse(contract: StoredContract): ContractStatusResponseDto {
    return {
      contractId: contract.id,
      analysisId: contract.id,
      status: this.toLifecycleStatus(contract.job.status),
      pipelineStatus: contract.job.status,
      locale: contract.locale,
      selectedRole: contract.role,
      progress: this.toProgress(contract.job.status),
      updatedAt: contract.job.updatedAt,
      allowedTransitions: this.jobOrchestration.getAllowedTransitions(contract.job.status),
      errorCode: contract.job.errorCode,
      errorMessage: contract.job.errorMessage
    };
  }

  private buildHistoryItem(contract: StoredContract): ContractHistoryItemDto {
    return {
      contractId: contract.id,
      analysisId: contract.id,
      role: contract.role,
      selectedRole: contract.role,
      locale: contract.locale,
      status: this.toLifecycleStatus(contract.job.status),
      pipelineStatus: contract.job.status,
      originalFileName: contract.originalFileName,
      fileName: contract.originalFileName,
      uploadedAt: contract.uploadedAt,
      createdAt: contract.uploadedAt,
      updatedAt: contract.updatedAt
    };
  }

  private toLifecycleStatus(jobStatus: JobStatus): AnalysisLifecycleStatus {
    if (jobStatus === JobStatus.ReportReady) {
      return AnalysisLifecycleStatus.Completed;
    }

    if (jobStatus === JobStatus.Failed) {
      return AnalysisLifecycleStatus.Failed;
    }

    if (jobStatus === JobStatus.Preprocessing || jobStatus === JobStatus.Analyzing) {
      return AnalysisLifecycleStatus.Processing;
    }

    return AnalysisLifecycleStatus.Queued;
  }

  private toProgress(jobStatus: JobStatus): number {
    if (jobStatus === JobStatus.Uploaded) {
      return 5;
    }

    if (jobStatus === JobStatus.Queued) {
      return 15;
    }

    if (jobStatus === JobStatus.Preprocessing) {
      return 35;
    }

    if (jobStatus === JobStatus.Analyzing) {
      return 75;
    }

    if (jobStatus === JobStatus.ReportReady) {
      return 100;
    }

    return 0;
  }

  private mapSeverity(severity: 'low' | 'medium' | 'high' | 'critical'): RiskSeverity {
    if (severity === 'low') {
      return RiskSeverity.Low;
    }

    if (severity === 'medium') {
      return RiskSeverity.Medium;
    }

    if (severity === 'critical') {
      return RiskSeverity.Critical;
    }

    return RiskSeverity.High;
  }

  private uniqueStrings(values: string[]): string[] {
    return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
  }

  private isPending(contract: StoredContract): boolean {
    return (
      contract.job.status === JobStatus.Queued ||
      contract.job.status === JobStatus.Preprocessing ||
      contract.job.status === JobStatus.Analyzing
    );
  }

  private advanceJob(job: AnalysisJobState, targetStatus: JobStatus): AnalysisJobState {
    if (job.status === targetStatus) {
      return job;
    }

    if (!this.jobOrchestration.canTransition(job.status, targetStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${job.status} -> ${targetStatus}`
      );
    }

    return this.jobOrchestration.transition(job, targetStatus);
  }

  private normalizeOptionalText(value?: string): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private describeAnalysisFailure(error: unknown): string {
    if (error instanceof AnalysisEngineUnavailableError) {
      return `${MESSAGE_POLICY.ANALYSIS_ENGINE_NOT_AVAILABLE} ${error.message}`.trim();
    }

    if (error instanceof Error) {
      return error.message;
    }

    return MESSAGE_POLICY.UNKNOWN_ERROR;
  }

  private async requireContract(contractId: string): Promise<StoredContract> {
    const contract = await this.contractsRepository.findById(contractId);
    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }

    return contract;
  }

  private validateUploadedFile(file?: Express.Multer.File): asserts file is Express.Multer.File {
    if (!file) {
      throw new BadRequestException(MESSAGE_POLICY.FILE_REQUIRED);
    }

    const maxUploadSizeMb = this.configService.get('uploads.maxUploadSizeMb', { infer: true });
    const maxUploadSizeBytes = maxUploadSizeMb * CONTRACT_POLICY.BYTES_IN_MB;
    if (file.size > maxUploadSizeBytes) {
      throw new BadRequestException({
        message: MESSAGE_POLICY.FILE_SIZE_LIMIT_EXCEEDED,
        maxUploadSizeMb
      });
    }

    const allowedMimeTypes = this.configService.get('uploads.allowedMimeTypes', { infer: true });
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException({
        message: MESSAGE_POLICY.FILE_MIME_TYPE_NOT_ALLOWED,
        allowedMimeTypes
      });
    }
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
