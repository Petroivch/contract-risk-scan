import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnalysisLifecycleStatus } from '../../common/domain/analysis-lifecycle-status.enum';
import { SupportedLocale } from '../../common/i18n/supported-locale.enum';
import { JobStatus } from '../../common/job-orchestration/job-status.enum';

export class ContractStatusResponseDto {
  @ApiProperty({ example: 'ctr_k2v4m8x1' })
  contractId!: string;

  @ApiProperty({ example: 'ctr_k2v4m8x1' })
  analysisId!: string;

  @ApiProperty({ enum: AnalysisLifecycleStatus, example: AnalysisLifecycleStatus.Processing })
  status!: AnalysisLifecycleStatus;

  @ApiProperty({ enum: JobStatus, example: JobStatus.Preprocessing })
  pipelineStatus!: JobStatus;

  @ApiProperty({ enum: SupportedLocale, example: SupportedLocale.RU })
  locale!: SupportedLocale;

  @ApiProperty({ example: 'contractor' })
  selectedRole!: string;

  @ApiProperty({ example: 68 })
  progress!: number;

  @ApiProperty({ enum: JobStatus, isArray: true, example: [JobStatus.Analyzing, JobStatus.Failed] })
  allowedTransitions!: JobStatus[];

  @ApiProperty({ example: '2026-04-20T10:19:00.000Z' })
  updatedAt!: string;

  @ApiPropertyOptional({ example: 'ANALYSIS_STUB_ERROR' })
  errorCode?: string;

  @ApiPropertyOptional({ example: 'Failed to parse DOCX stream' })
  errorMessage?: string;
}
