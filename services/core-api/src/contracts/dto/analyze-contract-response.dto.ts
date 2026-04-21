import { ApiProperty } from '@nestjs/swagger';
import { AnalysisLifecycleStatus } from '../../common/domain/analysis-lifecycle-status.enum';
import { JobStatus } from '../../common/job-orchestration/job-status.enum';
import { SupportedLocale } from '../../common/i18n/supported-locale.enum';

export class AnalyzeContractResponseDto {
  @ApiProperty({ example: 'ctr_k2v4m8x1' })
  contractId!: string;

  @ApiProperty({ example: 'ctr_k2v4m8x1' })
  analysisId!: string;

  @ApiProperty({ enum: AnalysisLifecycleStatus, example: AnalysisLifecycleStatus.Queued })
  status!: AnalysisLifecycleStatus;

  @ApiProperty({ enum: JobStatus, example: JobStatus.Queued })
  pipelineStatus!: JobStatus;

  @ApiProperty({ enum: SupportedLocale, example: SupportedLocale.RU })
  locale!: SupportedLocale;

  @ApiProperty({ example: 'contractor' })
  selectedRole!: string;

  @ApiProperty({ example: 15 })
  progress!: number;

  @ApiProperty({ example: 'Analysis accepted and delegated to analysis-engine.' })
  message!: string;
}
