import { ApiProperty } from '@nestjs/swagger';
import { SupportedLocale } from '../../common/i18n/supported-locale.enum';
import { JobStatus } from '../../common/job-orchestration/job-status.enum';

export class ContractHistoryItemDto {
  @ApiProperty({ example: 'ctr_k2v4m8x1' })
  contractId!: string;

  @ApiProperty({ example: 'contractor' })
  role!: string;

  @ApiProperty({ enum: SupportedLocale, example: SupportedLocale.RU })
  locale!: SupportedLocale;

  @ApiProperty({ enum: JobStatus, example: JobStatus.ReportReady })
  status!: JobStatus;

  @ApiProperty({ example: 'service_agreement.pdf' })
  originalFileName!: string;

  @ApiProperty({ example: '2026-04-20T10:15:00.000Z' })
  uploadedAt!: string;

  @ApiProperty({ example: '2026-04-20T10:20:00.000Z' })
  updatedAt!: string;
}

export class ContractsHistoryResponseDto {
  @ApiProperty({ type: ContractHistoryItemDto, isArray: true })
  items!: ContractHistoryItemDto[];
}