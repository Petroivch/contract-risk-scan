import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupportedLocale } from '../../common/i18n/supported-locale.enum';
import { JobStatus } from '../../common/job-orchestration/job-status.enum';

export class ContractStatusResponseDto {
  @ApiProperty({ example: 'ctr_k2v4m8x1' })
  contractId!: string;

  @ApiProperty({ enum: JobStatus, example: JobStatus.Preprocessing })
  status!: JobStatus;

  @ApiProperty({ enum: SupportedLocale, example: SupportedLocale.RU })
  locale!: SupportedLocale;

  @ApiProperty({ enum: JobStatus, isArray: true, example: [JobStatus.Analyzing, JobStatus.Failed] })
  allowedTransitions!: JobStatus[];

  @ApiProperty({ example: '2026-04-20T10:19:00.000Z' })
  updatedAt!: string;

  @ApiPropertyOptional({ example: 'ANALYSIS_STUB_ERROR' })
  errorCode?: string;

  @ApiPropertyOptional({ example: 'Failed to parse DOCX stream' })
  errorMessage?: string;
}