import { ApiProperty } from '@nestjs/swagger';
import { JobStatus } from '../../common/job-orchestration/job-status.enum';
import { SupportedLocale } from '../../common/i18n/supported-locale.enum';

export class UploadContractResponseDto {
  @ApiProperty({ example: 'ctr_k2v4m8x1' })
  contractId!: string;

  @ApiProperty({ enum: JobStatus, example: JobStatus.Uploaded })
  status!: JobStatus;

  @ApiProperty({ enum: SupportedLocale, example: SupportedLocale.RU })
  locale!: SupportedLocale;

  @ApiProperty({ example: 'agreement_2026.pdf' })
  originalFileName!: string;

  @ApiProperty({ example: '2026-04-20T10:15:00.000Z' })
  uploadedAt!: string;
}