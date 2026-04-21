import { ApiProperty } from '@nestjs/swagger';
import { RiskSeverity } from '../../common/domain/risk-severity.enum';
import { SupportedLocale } from '../../common/i18n/supported-locale.enum';

export class ContractObligationDto {
  @ApiProperty({ example: 'contractor' })
  subject!: string;

  @ApiProperty({ example: 'Deliver services according to statement of work' })
  action!: string;

  @ApiProperty({ example: 'Within section 4 timeline' })
  dueCondition!: string;
}

export class ContractRiskDto {
  @ApiProperty({ example: 'RISK-001' })
  id!: string;

  @ApiProperty({ example: 'Penalty clause without cap' })
  title!: string;

  @ApiProperty({ enum: RiskSeverity, example: RiskSeverity.High })
  severity!: RiskSeverity;

  @ApiProperty({ example: 'Liability section defines open-ended penalties.' })
  description!: string;

  @ApiProperty({ example: "Can materially increase financial exposure for role 'contractor'." })
  roleImpact!: string;

  @ApiProperty({ example: 'Introduce liability cap as percentage of contract value.' })
  recommendation!: string;
}

export class DisputedClauseDto {
  @ApiProperty({ example: '8.4' })
  clauseRef!: string;

  @ApiProperty({ example: 'Party is fully liable for all indirect damages.' })
  fragment!: string;

  @ApiProperty({ example: 'Non-market liability allocation likely disputed in negotiations.' })
  issue!: string;

  @ApiProperty({ example: 'Limit indirect damages and define excluded categories.' })
  recommendation!: string;
}

export class ContractReportDto {
  @ApiProperty({ example: 'ctr_k2v4m8x1' })
  contractId!: string;

  @ApiProperty({ enum: SupportedLocale, example: SupportedLocale.RU })
  locale!: SupportedLocale;

  @ApiProperty({ example: 'contractor' })
  roleFocus!: string;

  @ApiProperty({
    example:
      "Contract analysis generated for role 'contractor'. Priority obligations and risk interpretation are focused on this side."
  })
  summary!: string;

  @ApiProperty({ type: ContractObligationDto, isArray: true })
  obligations!: ContractObligationDto[];

  @ApiProperty({ type: ContractRiskDto, isArray: true })
  risks!: ContractRiskDto[];

  @ApiProperty({ type: DisputedClauseDto, isArray: true })
  disputedClauses!: DisputedClauseDto[];

  @ApiProperty({ example: '2026-04-20T10:20:00.000Z' })
  generatedAt!: string;

  @ApiProperty({ nullable: true, example: 'Pay special attention to liability terms.' })
  generationNotes!: string | null;
}