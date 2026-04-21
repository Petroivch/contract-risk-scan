import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeLocale } from '../common/i18n/locale.utils';
import { SupportedLocale } from '../common/i18n/supported-locale.enum';
import {
  AnalysisJobState,
  JobOrchestrationService
} from '../common/job-orchestration/job-orchestration.service';
import { JobStatus } from '../common/job-orchestration/job-status.enum';
import { CONTRACT_POLICY } from '../common/policies/contracts.policy';
import { MESSAGE_POLICY } from '../common/policies/messages.policy';
import { generateEntityId } from '../common/utils/id.util';
import { AppConfig } from '../config/app-config.type';
import { AnalysisEngineClient } from './analysis-engine.client';
import { AnalyzeContractDto } from './dto/analyze-contract.dto';
import { AnalyzeContractResponseDto } from './dto/analyze-contract-response.dto';
import { ContractHistoryItemDto } from './dto/contracts-history-response.dto';
import { ContractReportDto } from './dto/contract-report.dto';
import { ContractStatusResponseDto } from './dto/contract-status-response.dto';
import { UploadContractDto } from './dto/upload-contract.dto';
import { UploadContractResponseDto } from './dto/upload-contract-response.dto';

interface StoredContract {
  id: string;
  role: string;
  locale: SupportedLocale;
  counterpartyRole?: string;
  contractLabel?: string;
  originalFileName: string;
  fileMimeType: string;
  fileSizeBytes: number;
  uploadedAt: string;
  job: AnalysisJobState;
  report?: ContractReportDto;
}

@Injectable()
export class ContractsService {
  private readonly contracts = new Map<string, StoredContract>();

  constructor(
    private readonly jobOrchestration: JobOrchestrationService,
    private readonly analysisEngineClient: AnalysisEngineClient,
    private readonly configService: ConfigService<AppConfig, true>
  ) {}

  upload(dto: UploadContractDto, file?: Express.Multer.File): UploadContractResponseDto {
    this.validateUploadedFile(file);

    const locale = normalizeLocale(dto.locale ?? dto.language);
    const contractId = generateEntityId(CONTRACT_POLICY.CONTRACT_ID_PREFIX);
    const now = new Date().toISOString();

    const stored: StoredContract = {
      id: contractId,
      role: dto.role,
      locale,
      counterpartyRole: dto.counterpartyRole,
      contractLabel: dto.contractLabel,
      originalFileName: file.originalname,
      fileMimeType: file.mimetype,
      fileSizeBytes: file.size,
      uploadedAt: now,
      job: {
        contractId,
        status: JobStatus.Uploaded,
        updatedAt: now
      }
    };

    this.contracts.set(contractId, stored);

    return {
      contractId,
      status: stored.job.status,
      locale: stored.locale,
      uploadedAt: stored.uploadedAt,
      originalFileName: stored.originalFileName
    };
  }

  analyze(contractId: string, dto: AnalyzeContractDto): AnalyzeContractResponseDto {
    const contract = this.requireContract(contractId);
    const locale = normalizeLocale(dto.locale ?? dto.language ?? contract.locale);
    contract.locale = locale;

    if (
      contract.job.status === JobStatus.Queued ||
      contract.job.status === JobStatus.Preprocessing ||
      contract.job.status === JobStatus.Analyzing
    ) {
      return {
        contractId,
        status: contract.job.status,
        locale,
        message: MESSAGE_POLICY.ANALYSIS_IN_PROGRESS
      };
    }

    if (contract.job.status === JobStatus.ReportReady && !dto.forceReanalyze) {
      return {
        contractId,
        status: contract.job.status,
        locale,
        message: MESSAGE_POLICY.ANALYSIS_ALREADY_READY
      };
    }

    try {
      contract.job = this.jobOrchestration.transition(contract.job, JobStatus.Queued);
      contract.job = this.jobOrchestration.transition(contract.job, JobStatus.Preprocessing);
      contract.job = this.jobOrchestration.transition(contract.job, JobStatus.Analyzing);

      contract.report = this.analysisEngineClient.generateReport({
        contractId: contract.id,
        role: contract.role,
        counterpartyRole: contract.counterpartyRole,
        locale,
        focusNotes: dto.focusNotes
      });

      contract.job = this.jobOrchestration.transition(contract.job, JobStatus.ReportReady);

      return {
        contractId,
        status: contract.job.status,
        locale,
        message: MESSAGE_POLICY.ANALYSIS_COMPLETED_STUB
      };
    } catch (error) {
      if (this.jobOrchestration.canTransition(contract.job.status, JobStatus.Failed)) {
        contract.job = {
          ...this.jobOrchestration.transition(contract.job, JobStatus.Failed),
          errorCode: CONTRACT_POLICY.ANALYSIS_ERROR_CODE,
          errorMessage: error instanceof Error ? error.message : MESSAGE_POLICY.UNKNOWN_ERROR
        };
      }

      return {
        contractId,
        status: contract.job.status,
        locale,
        message: MESSAGE_POLICY.ANALYSIS_FAILED_STUB
      };
    }
  }

  status(contractId: string): ContractStatusResponseDto {
    const contract = this.requireContract(contractId);

    return {
      contractId,
      status: contract.job.status,
      locale: contract.locale,
      updatedAt: contract.job.updatedAt,
      allowedTransitions: this.jobOrchestration.getAllowedTransitions(contract.job.status),
      errorCode: contract.job.errorCode,
      errorMessage: contract.job.errorMessage
    };
  }

  report(contractId: string): ContractReportDto | null {
    const contract = this.requireContract(contractId);

    if (contract.job.status !== JobStatus.ReportReady || !contract.report) {
      return null;
    }

    return contract.report;
  }

  history(): ContractHistoryItemDto[] {
    return Array.from(this.contracts.values())
      .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))
      .map((item) => ({
        contractId: item.id,
        role: item.role,
        locale: item.locale,
        status: item.job.status,
        originalFileName: item.originalFileName,
        uploadedAt: item.uploadedAt,
        updatedAt: item.job.updatedAt
      }));
  }

  private requireContract(contractId: string): StoredContract {
    const contract = this.contracts.get(contractId);
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
}