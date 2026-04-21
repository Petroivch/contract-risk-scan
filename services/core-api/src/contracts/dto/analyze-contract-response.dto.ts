import { ApiProperty } from '@nestjs/swagger';
import { JobStatus } from '../../common/job-orchestration/job-status.enum';
import { SupportedLocale } from '../../common/i18n/supported-locale.enum';

export class AnalyzeContractResponseDto {
  @ApiProperty({ example: 'ctr_k2v4m8x1' })
  contractId!: string;

  @ApiProperty({ enum: JobStatus, example: JobStatus.Queued })
  status!: JobStatus;

  @ApiProperty({ enum: SupportedLocale, example: SupportedLocale.RU })
  locale!: SupportedLocale;

  @ApiProperty({ example: 'Analysis completed in sync-stub mode. Async workers will be integrated next.' })
  message!: string;
}