import { ApiProperty } from '@nestjs/swagger';
import { RiskSeverity } from '../common/domain/risk-severity.enum';
import { SupportedLocale } from '../common/i18n/supported-locale.enum';

export class StructuredSummaryRecordDto {
  @ApiProperty({ example: 'role-summary-overview' })
  id!: string;

  @ApiProperty({ example: "Сводка для роли 'Исполнитель'." })
  headline!: string;

  @ApiProperty({
    example:
      "Для роли 'Исполнитель' собрана сводка по 12 пунктам договора, выявлено 4 риска, из них 2 с высоким приоритетом."
  })
  description!: string;

  @ApiProperty({
    example:
      'Проверьте пункты с высоким риском, подтвердите критичные обязательства и согласуйте спорные условия до подписания.'
  })
  recommendation!: string;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['Фрагмент договора: Исполнитель обязан оказать услуги в течение 10 рабочих дней.']
  })
  evidence!: string[];
}

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

export class TextOffsetDto {
  @ApiProperty({ example: 128 })
  start!: number;

  @ApiProperty({ example: 196 })
  end!: number;
}

export class ContractRiskEvidenceDto {
  @ApiProperty({ example: 'normalized_document_text' })
  source!: string;

  @ApiProperty({ example: 'RSK-PEN-001', required: false, nullable: true })
  sourceRef?: string | null;

  @ApiProperty({ example: 'clause-3', required: false, nullable: true })
  clauseId?: string | null;

  @ApiProperty({ example: 'Contractor pays a 10% penalty for each day of delay.' })
  sourceExcerpt!: string;

  @ApiProperty({ type: TextOffsetDto })
  offset!: TextOffsetDto;

  @ApiProperty({ type: String, isArray: true, example: ['penalty'] })
  matchedPatterns!: string[];
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

  @ApiProperty({ type: String, isArray: true, example: ['Contractor pays a 10% penalty for each day of delay.'] })
  evidence!: string[];

  @ApiProperty({ type: ContractRiskEvidenceDto, isArray: true })
  riskEvidence!: ContractRiskEvidenceDto[];
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

  @ApiProperty({ example: 'contractor' })
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

  @ApiProperty({ example: false, required: false })
  roleNotFound?: boolean;

  @ApiProperty({
    required: false,
    nullable: true,
    example:
      "Выбранная роль 'Finance reviewer' не найдена в тексте договора. Найдены роли: Seller, Buyer."
  })
  message?: string | null;

  @ApiProperty({ type: StructuredSummaryRecordDto, isArray: true })
  contractBriefRecords!: StructuredSummaryRecordDto[];

  @ApiProperty({ type: StructuredSummaryRecordDto, isArray: true })
  roleFocusedSummaryRecords!: StructuredSummaryRecordDto[];

  @ApiProperty({ example: '2026-04-20T10:20:00.000Z' })
  generatedAt!: string;

  @ApiProperty({ nullable: true, example: 'Pay special attention to liability terms.' })
  generationNotes!: string | null;
}

