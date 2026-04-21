import { ApiProperty } from '@nestjs/swagger';
import { RiskSeverity } from '../../common/domain/risk-severity.enum';
import { SupportedLocale } from '../../common/i18n/supported-locale.enum';

export class ContractSummaryDto {
  @ApiProperty({ example: 'Master Service Agreement - contractor view' })
  title!: string;

  @ApiProperty({ example: 'PDF contract' })
  contractType!: string;

  @ApiProperty({
    example:
      'The contract covers service delivery scope, payment procedure, acceptance rules, liability and termination grounds.'
  })
  shortDescription!: string;

  @ApiProperty({
    type: String,
    isArray: true,
    example: [
      'Deliver the agreed scope within the deadlines described in the contract.',
      'Track acceptance criteria and formal approvals before invoicing.'
    ]
  })
  obligationsForSelectedRole!: string[];
}

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

  @ApiProperty({ example: '7.2' })
  clauseRef!: string;

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
  @ApiProperty({ example: 'dc_8_4' })
  id!: string;

  @ApiProperty({ example: '8.4' })
  clauseRef!: string;

  @ApiProperty({ example: 'Party is fully liable for all indirect damages.' })
  fragment!: string;

  @ApiProperty({ example: 'Non-market liability allocation likely disputed in negotiations.' })
  issue!: string;

  @ApiProperty({ example: 'Limit indirect damages and define excluded categories.' })
  recommendation!: string;

  @ApiProperty({ example: 'Non-market liability allocation is likely to trigger negotiation conflict.' })
  whyDisputed!: string;

  @ApiProperty({ example: 'Limit indirect damages and add a mutually agreed liability cap.' })
  suggestedRewrite!: string;
}

export class ContractReportDto {
  @ApiProperty({ example: 'ctr_k2v4m8x1' })
  contractId!: string;

  @ApiProperty({ example: 'ctr_k2v4m8x1' })
  analysisId!: string;

  @ApiProperty({ enum: SupportedLocale, example: SupportedLocale.RU })
  locale!: SupportedLocale;

  @ApiProperty({ example: 'contractor' })
  roleFocus!: string;

  @ApiProperty({
    example: 'contractor'
  })
  selectedRole!: string;

  @ApiProperty({ type: ContractSummaryDto })
  summary!: ContractSummaryDto;

  @ApiProperty({
    example:
      "Contract analysis generated for role 'contractor'. Priority obligations and risk interpretation are focused on this side."
  })
  summaryText!: string;

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
