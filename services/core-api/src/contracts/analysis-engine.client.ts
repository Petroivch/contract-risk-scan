import { Injectable } from '@nestjs/common';
import { RiskSeverity } from '../common/domain/risk-severity.enum';
import { SupportedLocale } from '../common/i18n/supported-locale.enum';
import { CONTRACT_POLICY } from '../common/policies/contracts.policy';
import {
  ContractObligationDto,
  ContractReportDto,
  ContractRiskDto,
  DisputedClauseDto
} from './dto/contract-report.dto';

export interface AnalyzeEnginePayload {
  contractId: string;
  role: string;
  counterpartyRole?: string;
  locale: SupportedLocale;
  focusNotes?: string;
}

@Injectable()
export class AnalysisEngineClient {
  generateReport(payload: AnalyzeEnginePayload): ContractReportDto {
    const obligations: ContractObligationDto[] = [
      {
        subject: payload.role,
        action: 'Deliver services according to statement of work and timeline',
        dueCondition: 'Within deadlines defined in section 4.2'
      },
      {
        subject: payload.counterpartyRole ?? CONTRACT_POLICY.DEFAULT_COUNTERPARTY_LABEL,
        action: 'Provide payment within contractual term',
        dueCondition: 'Within 10 banking days after invoice acceptance'
      }
    ];

    const risks: ContractRiskDto[] = [
      {
        id: 'RISK-001',
        title: 'Penalty clause without cap',
        severity: RiskSeverity.High,
        description: 'Liability section defines open-ended penalties.',
        roleImpact: `Can materially increase financial exposure for role '${payload.role}'.`,
        recommendation: 'Introduce liability cap as percentage of contract value.'
      },
      {
        id: 'RISK-002',
        title: 'Ambiguous acceptance criteria',
        severity: RiskSeverity.Medium,
        description: 'No objective acceptance checklist found.',
        roleImpact: 'Can trigger disputes around completion and payment milestones.',
        recommendation: 'Add measurable acceptance criteria and timeline.'
      }
    ];

    const disputedClauses: DisputedClauseDto[] = [
      {
        clauseRef: '8.4',
        fragment: 'Party is fully liable for all indirect damages.',
        issue: 'Non-market liability allocation likely disputed in negotiations.',
        recommendation: 'Limit indirect damages and define excluded categories.'
      },
      {
        clauseRef: '11.2',
        fragment: 'Unilateral termination without cure period.',
        issue: 'No cure period increases termination risk.',
        recommendation: 'Add 15-30 day cure period before termination rights apply.'
      }
    ];

    return {
      contractId: payload.contractId,
      locale: payload.locale,
      roleFocus: payload.role,
      summary:
        `Contract analysis generated for role '${payload.role}' with locale '${payload.locale}'. ` +
        `Priority obligations and risk interpretation are focused on this side. ` +
        `Counterparty role: ${payload.counterpartyRole ?? 'not specified'}.`,
      obligations,
      risks,
      disputedClauses,
      generatedAt: new Date().toISOString(),
      generationNotes: payload.focusNotes ?? null
    };
  }
}