import { ApiProperty } from '@nestjs/swagger';
import { AnalysisLifecycleStatus } from '../../common/domain/analysis-lifecycle-status.enum';
import { SupportedLocale } from '../../common/i18n/supported-locale.enum';
import { JobStatus } from '../../common/job-orchestration/job-status.enum';

export class ContractHistoryItemDto {
  @ApiProperty({ example: 'ctr_k2v4m8x1' })
  contractId!: string;

  @ApiProperty({ example: 'ctr_k2v4m8x1' })
  analysisId!: string;

  @ApiProperty({ example: 'contractor' })
  role!: string;

  @ApiProperty({ example: 'contractor' })
  selectedRole!: string;

  @ApiProperty({ enum: SupportedLocale, example: SupportedLocale.RU })
  locale!: SupportedLocale;

  @ApiProperty({ enum: AnalysisLifecycleStatus, example: AnalysisLifecycleStatus.Completed })
  status!: AnalysisLifecycleStatus;

  @ApiProperty({ enum: JobStatus, example: JobStatus.ReportReady })
  pipelineStatus!: JobStatus;

  @ApiProperty({ example: 'service_agreement.pdf' })
  originalFileName!: string;

  @ApiProperty({ example: 'service_agreement.pdf' })
  fileName!: string;

  @ApiProperty({ example: '2026-04-20T10:15:00.000Z' })
  uploadedAt!: string;

  @ApiProperty({ example: '2026-04-20T10:15:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-04-20T10:20:00.000Z' })
  updatedAt!: string;
}

export class ContractsHistoryResponseDto {
  @ApiProperty({ type: ContractHistoryItemDto, isArray: true })
  items!: ContractHistoryItemDto[];
}
