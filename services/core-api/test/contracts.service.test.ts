import * as assert from 'node:assert/strict';
import { SupportedLocale } from '../src/common/i18n/supported-locale.enum';
import { JobOrchestrationService } from '../src/common/job-orchestration/job-orchestration.service';
import { JobStatus } from '../src/common/job-orchestration/job-status.enum';
import { UPLOAD_POLICY } from '../src/common/policies/upload.policy';
import {
  AnalysisEngineClient,
  AnalysisEngineOutput
} from '../src/contracts/analysis-engine.client';
import { ContractsRepository } from '../src/contracts/contracts.repository';
import { ContractsService } from '../src/contracts/contracts.service';
import { StoredContract } from '../src/contracts/stored-contract.type';

const service = new ContractsService({} as never, {} as never, {} as never, {} as never);
const contract: StoredContract = {
  id: 'ctr_test',
  role: 'contractor',
  locale: SupportedLocale.RU,
  counterpartyRole: 'customer',
  contractLabel: 'Service agreement',
  originalFileName: 'service-agreement.txt',
  storedFileName: 'service-agreement.txt',
  storedFilePath: '/tmp/service-agreement.txt',
  fileMimeType: 'text/plain',
  fileSizeBytes: 1024,
  uploadedAt: '2026-04-29T10:00:00.000Z',
  updatedAt: '2026-04-29T10:05:00.000Z',
  job: {
    contractId: 'ctr_test',
    status: JobStatus.ReportReady,
    updatedAt: '2026-04-29T10:05:00.000Z'
  }
};
const remoteResult: AnalysisEngineOutput = {
  language: 'ru',
  locale: 'ru',
  execution_plan: {
    mode: 'local_first',
    offline_capable: true,
    network_required: false,
    policy_source: 'test',
    reason: 'test'
  },
  contract_brief:
    'Договор содержит ключевые обязательства для роли contractor и требует проверки сроков оплаты.',
  contract_brief_records: [
    {
      id: 'contract-brief-intro',
      headline: "Общий контекст договора для роли 'contractor'.",
      description:
        "Договор 'service-agreement.txt' содержит 4 пункта, определен как 'Общий договор', правовая рамка: Общие нормы ГК РФ, спорных пунктов: 1.",
      recommendation:
        'Проверьте предмет договора, тип документа и ключевые спорные условия перед согласованием версии.',
      evidence: ['Фрагмент договора: Тип договора: Общий договор.']
    }
  ],
  risks: [
    {
      risk_id: 'risk-1',
      title: 'Risk',
      severity: 'high',
      clause_id: 'clause-1',
      description: 'Description',
      role_relevance: 'Role relevance',
      mitigation: 'Mitigation'
    }
  ],
  disputed_clauses: [
    {
      clause_id: 'clause-4',
      clause_excerpt: 'Customer may interpret service quality at its sole discretion.',
      dispute_reason: 'Quality criteria are discretionary.',
      possible_consequence: 'The contractor may face subjective acceptance disputes.',
      confidence: 0.74
    }
  ],
  role_focused_summary: {
    role: 'contractor',
    overview: 'Legacy overview.',
    must_do: ['Contractor must deliver the report within 5 business days.'],
    should_review: ['Customer may change the scope at its sole discretion.'],
    payment_terms: ['Customer pays the invoice within 15 days.'],
    deadlines: ['Contractor must deliver the report within 5 business days.'],
    penalties: ['Penalty 1% applies for delayed delivery.']
  },
  role_focused_summary_records: [
    {
      id: 'role-summary-overview',
      headline: "Сводка для роли 'contractor'.",
      description:
        "Для роли 'contractor' собрана сводка по 4 пунктам договора, выявлено 1 рисков, из них 1 с высоким приоритетом.",
      recommendation:
        'Проверьте пункты с высоким риском, подтвердите критичные обязательства и согласуйте спорные условия до подписания.',
      evidence: ['Фрагмент договора: Contractor must deliver the report within 5 business days.']
    }
  ]
};

const report = (
  service as unknown as {
    buildReport: (contract: StoredContract, remoteResult: AnalysisEngineOutput) => any;
  }
).buildReport(contract, remoteResult);

assert.equal(report.summaryText, remoteResult.contract_brief);
assert.equal(report.summary.shortDescription, remoteResult.contract_brief);
assert.deepEqual(report.summary.obligationsForSelectedRole, [
  'Contractor must deliver the report within 5 business days.',
  'Customer pays the invoice within 15 days.',
  'Penalty 1% applies for delayed delivery.'
]);
assert.deepEqual(report.contractBriefRecords, remoteResult.contract_brief_records);
assert.deepEqual(report.roleFocusedSummaryRecords, remoteResult.role_focused_summary_records);
assert.equal(report.contractBriefRecords[0].recommendation.startsWith('Проверьте'), true);
assert.equal(report.roleFocusedSummaryRecords[0].headline.endsWith('.'), true);
assert.deepEqual(UPLOAD_POLICY.ALLOWED_MIME_TYPES_DEFAULT, [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);
assert.equal(UPLOAD_POLICY.ALLOWED_MIME_TYPES_DEFAULT.includes('application/msword'), false);
assert.deepEqual(UPLOAD_POLICY.REJECTED_MIME_TYPES_DEFAULT, ['application/msword']);

void (async () => {
  const lifecycleRepository = new ContractsRepository();
  const lifecycleService = new ContractsService(
    new JobOrchestrationService(),
    {} as never,
    lifecycleRepository,
    {} as never
  );
  const uploadedLifecycleContract = await lifecycleRepository.create({
    contract: {
      ...contract,
      id: 'ctr_lifecycle_success',
      job: {
        contractId: 'ctr_lifecycle_success',
        status: JobStatus.Uploaded,
        updatedAt: '2026-04-29T10:05:00.000Z'
      }
    },
    file: {
      originalname: 'service-agreement.txt',
      mimetype: 'text/plain',
      size: 19,
      buffer: Buffer.from('contract text secret')
    } as Express.Multer.File
  });
  const analyzingLifecycleContract = await lifecycleRepository.save({
    ...uploadedLifecycleContract,
    job: {
      ...uploadedLifecycleContract.job,
      status: JobStatus.Analyzing
    }
  });

  assert.equal(lifecycleRepository.hasStoredFileForTesting('ctr_lifecycle_success'), true);
  await (
    lifecycleService as unknown as {
      completeContract: (
        contract: StoredContract,
        remoteResult: AnalysisEngineOutput
      ) => Promise<StoredContract>;
    }
  ).completeContract(analyzingLifecycleContract, remoteResult);
  assert.equal(lifecycleRepository.hasStoredFileForTesting('ctr_lifecycle_success'), false);

  const failedLifecycleContract = await lifecycleRepository.create({
    contract: {
      ...contract,
      id: 'ctr_lifecycle_failed',
      job: {
        contractId: 'ctr_lifecycle_failed',
        status: JobStatus.Uploaded,
        updatedAt: '2026-04-29T10:05:00.000Z'
      }
    },
    file: {
      originalname: 'service-agreement.txt',
      mimetype: 'text/plain',
      size: 19,
      buffer: Buffer.from('contract text secret')
    } as Express.Multer.File
  });

  assert.equal(lifecycleRepository.hasStoredFileForTesting('ctr_lifecycle_failed'), true);
  await (
    lifecycleService as unknown as {
      markFailed: (contract: StoredContract, errorMessage: string) => Promise<StoredContract>;
    }
  ).markFailed(failedLifecycleContract, 'analysis failed');
  assert.equal(lifecycleRepository.hasStoredFileForTesting('ctr_lifecycle_failed'), false);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((async () =>
    ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({}),
      text: async () => 'raw secret document text'
    })) as unknown) as typeof fetch;

  try {
    const redactionClient = new AnalysisEngineClient({
      get: (key: string) => {
        const values: Record<string, unknown> = {
          'analysisEngine.enabled': true,
          'analysisEngine.baseUrl': 'http://analysis-engine.local/',
          'analysisEngine.requestTimeoutMs': 100
        };
        return values[key];
      }
    } as never);

    await assert.rejects(
      () =>
        redactionClient.runAnalysis({
          contractId: 'ctr_redaction',
          documentName: 'secret.txt',
          role: 'contractor',
          locale: SupportedLocale.EN,
          documentText: 'raw secret document text',
          mimeType: 'text/plain'
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /analysis-engine request failed \(500 Internal Server Error\)/);
        assert.equal(error.message.includes('raw secret document text'), false);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
})().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
