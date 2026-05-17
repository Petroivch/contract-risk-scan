import * as assert from 'node:assert/strict';

declare const require: (moduleName: string) => any;

const NodeModule = require('node:module') as {
  _load: (...args: any[]) => unknown;
};
const originalModuleLoad = NodeModule._load;

NodeModule._load = function patchedModuleLoad(request: string, ...rest: any[]): unknown {
  if (request === 'expo-file-system') {
    return {
      EncodingType: { Base64: 'base64' },
      readAsStringAsync: async () => {
        throw new Error('expo-file-system should not be used in local analyzer smoke');
      },
    };
  }

  return originalModuleLoad.call(this, request, ...rest);
};

const {
  analyzeContractLocally,
}: {
  analyzeContractLocally: (...args: any[]) => Promise<any>;
} = require('./localContractAnalyzer');
const {
  buildStrictRoleTerms,
}: {
  buildStrictRoleTerms: (selectedRole: string) => string[];
} = require('./contractAnalysis');

NodeModule._load = originalModuleLoad;

const run = async (): Promise<void> => {
  assert.ok(!buildStrictRoleTerms('Contractor').includes('provider'));

  const aliasOnlyRoleReport = await analyzeContractLocally(
    {
      fileName: 'alias-only-role.txt',
      mimeType: 'text/plain',
      selectedRole: 'Contractor',
      rawText: [
        '1. The provider shall deliver the report within 5 business days.',
        '2. The provider shall pay liquidated damages of 10% of the contract price for each day of delay.',
      ].join('\n\n'),
      language: 'en',
    },
    'en',
  );

  assert.equal(aliasOnlyRoleReport.summary.roleFound, false);
  assert.deepEqual(aliasOnlyRoleReport.summary.obligationsForSelectedRole, []);
  assert.deepEqual(aliasOnlyRoleReport.risks, []);
  assert.match(aliasOnlyRoleReport.summary.shortDescription, /The role "Contractor" was not found/u);

  const oppositeRoleText = [
    '1. Contractor shall deliver the report within 5 days.',
    '2. The customer may at its sole discretion terminate this contract.',
    '3. The contractor shall pay liquidated damages of 10% of the contract price for each day of delay.',
    '4. The customer lost profits are not recoverable.',
  ].join('\n\n');

  const performerReport = await analyzeContractLocally(
    {
      fileName: 'opposite-role-performer.txt',
      mimeType: 'text/plain',
      selectedRole: 'Contractor',
      rawText: oppositeRoleText,
      language: 'en',
    },
    'en',
  );

  const customerReport = await analyzeContractLocally(
    {
      fileName: 'opposite-role-customer.txt',
      mimeType: 'text/plain',
      selectedRole: 'Customer',
      rawText: oppositeRoleText,
      language: 'en',
    },
    'en',
  );

  assert.equal(performerReport.summary.roleFound, true);
  assert.equal(customerReport.summary.roleFound, true);
  assert.ok(
    performerReport.contractBriefRecords?.some(
      (record: any) => record.id === 'local-ai-reasoning-overview',
    ),
  );

  const performerGroups = new Set(performerReport.risks.map((risk: any) => risk.groupId));
  assert.ok(performerGroups.has('penalties'));
  assert.ok(performerGroups.has('unilateral'));
  assert.ok(
    performerReport.risks
      .find((risk: any) => risk.groupId === 'penalties')
      ?.evidence?.some((line: string) =>
        line.includes('The contractor shall pay liquidated damages of 10% of the contract price for each day of delay.'),
      ),
  );
  assert.ok(
    performerReport.risks
      .find((risk: any) => risk.groupId === 'unilateral')
      ?.evidence?.some((line: string) =>
        line.includes('The customer may at its sole discretion terminate this contract.'),
      ),
  );

  const customerGroups = new Set(customerReport.risks.map((risk: any) => risk.groupId));
  assert.ok(customerGroups.has('liability'));
  assert.ok(!customerGroups.has('penalties'));
  assert.ok(!customerGroups.has('unilateral'));
  assert.ok(
    customerReport.risks
      .find((risk: any) => risk.groupId === 'liability')
      ?.evidence?.some((line: string) => line.includes('The customer lost profits are not recoverable.')),
  );
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
