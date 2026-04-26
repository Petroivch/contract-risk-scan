import * as assert from 'node:assert/strict';

import { buildAnalysisArtifacts, buildDisputedClauses, segmentClauses } from './contractAnalysis';
import { normalizeExtractedText } from './textNormalization';
import { splitStructuredText } from '../components/report/reportText';

const normalizedParagraphs = normalizeExtractedText('Line 1\r\n\r\nLine 2');
assert.ok(normalizedParagraphs.includes('Line 1\n\nLine 2'));

const sampleContractText = [
  'Service agreement',
  'Customer shall pay the invoice within 10 business days.',
  'Contractor shall deliver the report within 5 days.',
  'Any price changes are to be determined in a separate agreement by agreement of the parties.',
  'The supplier may at its sole discretion terminate this contract.',
  'Liquidated damages apply for late delivery.',
  'The contractor assumes full liability and indemnification for any damages.',
  'Acceptance shall be confirmed in writing within 3 days.',
  'This agreement renews automatically unless either party gives notice.',
  'La decision avverra entro un termine ragionevole.',
  'Le paiement sera effectue dans les meilleurs delais.',
  'Расторжение допускается по соглашению сторон.',
].join('\n\n');

const analysis = buildAnalysisArtifacts({
  text: sampleContractText,
  fileName: 'service-agreement-draft.pdf',
  selectedRole: 'customer',
  language: 'en',
  warnings: [],
});

assert.equal(analysis.summary.contractType, 'Supply agreement');
assert.ok(
  analysis.summary.obligationsForSelectedRole.some((line) =>
    line.toLowerCase().includes('customer shall pay the invoice'),
  ),
);
assert.ok(
  !analysis.summary.obligationsForSelectedRole.some((line) =>
    line.toLowerCase().includes('contractor shall deliver the report'),
  ),
);

const riskTitles = analysis.risks.map((risk) => risk.title);
assert.ok(riskTitles.includes('Unilateral change or termination'));
assert.ok(riskTitles.includes('Penalties and sanctions'));
assert.ok(riskTitles.includes('Liability and indemnification'));
assert.ok(riskTitles.includes('Unclear acceptance process'));
assert.ok(riskTitles.includes('Automatic renewal'));
assert.ok(riskTitles.every((title) => !/[РС][\u0080-\u04ff]/u.test(title)));

assert.ok(
  analysis.disputedClauses.some((item) => item.whyDisputed.toLowerCase().includes('future agreement between the parties')),
);
assert.ok(analysis.disputedClauses.some((item) => item.whyDisputed.toLowerCase().includes('subjective timeline')));

const russianAnalysis = buildAnalysisArtifacts({
  text: [
    '1.1. Исполнитель обязан оказать услуги и предоставить результат.',
    '2.1. Заказчик оплачивает услуги в течение 5 банковских дней.',
    '4.3. Заказчик вправе в одностороннем порядке изменить сроки.',
    '5.1. Приемка результата оформляется актом без указания четких критериев.',
  ].join('\n\n'),
  fileName: 'demo.docx',
  selectedRole: 'Исполнитель',
  language: 'ru',
  warnings: [],
});

assert.ok(russianAnalysis.summary.shortDescription.includes('Исполнитель'));
assert.ok(russianAnalysis.summary.shortDescription.includes('4'));
assert.equal(russianAnalysis.summary.obligationsForSelectedRole[0], 'Исполнитель обязан оказать услуги и предоставить результат.');
assert.ok(
  russianAnalysis.risks.some((risk) => risk.evidence?.some((line) => line.includes('Заказчик вправе в одностороннем порядке изменить сроки.'))),
);
assert.equal(russianAnalysis.disputedClauses.length, 0);
assert.ok(russianAnalysis.summary.obligationsForSelectedRole.every((line) => !line.includes('Заказчик')));

const citizenAnalysis = buildAnalysisArtifacts({
  text: [
    'Гражданин обязуется освоить образовательную программу высшего образования.',
    'Гражданин обязан в период обучения освоить программу и осуществить трудовую деятельность.',
    'Заказчик обязуется предоставить гражданину меры поддержки.',
  ].join('\n\n'),
  fileName: 'citizen.pdf',
  selectedRole: 'Гражданин',
  language: 'ru',
  warnings: [],
});

assert.equal(citizenAnalysis.summary.roleFound, true);
assert.ok(citizenAnalysis.summary.obligationsForSelectedRole.some((line) => line.includes('Гражданин')));

const contractorMissingAnalysis = buildAnalysisArtifacts({
  text: 'Исполнитель обязан оказать услуги и передать результат заказчику.',
  fileName: 'executor-only.pdf',
  selectedRole: 'Подрядчик',
  language: 'ru',
  warnings: [],
});

assert.equal(contractorMissingAnalysis.summary.roleFound, false);

const beneficiaryAnalysis = buildAnalysisArtifacts({
  text: [
    '1. Исполнитель не несет ответственности за перебои в электропитании на стороне Заказчика.',
    '2. Заказчик оплачивает услуги в течение 5 банковских дней.',
  ].join('\n\n'),
  fileName: 'beneficiary.pdf',
  selectedRole: 'Исполнитель',
  language: 'ru',
  warnings: [],
});

assert.ok(!beneficiaryAnalysis.risks.some((risk) => risk.title === 'Ответственность и возмещение убытков'));
assert.ok(
  !beneficiaryAnalysis.summary.obligationsForSelectedRole.some((line) => line.includes('не несет ответственности')),
);

const suppressedRiskAnalysis = buildAnalysisArtifacts({
  text: [
    '1. Исполнитель вправе в одностороннем порядке отказаться от оказания услуг при просрочке оплаты более 30 дней.',
    '2. Исполнитель не уплачивает штраф при задержке, вызванной просрочкой предоставления данных Заказчиком.',
    '3. Заказчик оплачивает услуги в течение 5 банковских дней.',
  ].join('\n\n'),
  fileName: 'suppressed-risks.pdf',
  selectedRole: 'Исполнитель',
  language: 'ru',
  warnings: [],
});

assert.ok(!suppressedRiskAnalysis.risks.some((risk) => risk.title === 'Штрафы и санкции'));
assert.ok(!suppressedRiskAnalysis.risks.some((risk) => risk.title === 'Одностороннее изменение или расторжение'));
assert.ok(suppressedRiskAnalysis.summary.obligationsForSelectedRole.every((line) => !line.includes('вправе')));

const explicitDeadlineDispute = buildDisputedClauses(
  segmentClauses('4.1. Сторона вправе направить уведомление. Срок реализации Этапа 1 составляет 30 календарных дней (1 месяц).'),
  'ru',
);
assert.equal(explicitDeadlineDispute.length, 0);

const penaltyEvidenceAnalysis = buildAnalysisArtifacts({
  text: [
    '4. Гражданин вправе запросить изменение условий обучения.',
    '4.1. За нарушение срока выхода на работу гражданин уплачивает штраф в размере 50 000 рублей.',
  ].join('\n\n'),
  fileName: 'penalty.pdf',
  selectedRole: 'Гражданин',
  language: 'ru',
  warnings: [],
});

const penaltyRisk = penaltyEvidenceAnalysis.risks.find((risk) => risk.title === 'Штрафы и санкции');
assert.ok(penaltyRisk);
assert.ok(penaltyRisk?.evidence?.some((line) => line.includes('гражданин уплачивает штраф')));
assert.ok(!penaltyRisk?.evidence?.some((line) => line.includes('4. Гражданин вправе запросить изменение условий обучения.')));

const educationAnalysis = buildAnalysisArtifacts({
  text: [
    'Гражданин обязуется освоить образовательную программу высшего образования.',
    'Программа определяется разделом II настоящего договора (далее - характеристики обучения).',
    'Требования к успеваемости гражданина не устанавливаются.',
    'Прием на обучение осуществляется после издания приказа образовательной организации.',
  ].join('\n\n'),
  fileName: 'education.pdf',
  selectedRole: 'Гражданин',
  language: 'ru',
  warnings: [],
});

assert.ok(!educationAnalysis.risks.some((risk) => risk.title === 'Неясная приемка результата'));
assert.ok(educationAnalysis.summary.obligationsForSelectedRole.every((line) => !line.includes('Прием на обучение')));

const clearAcceptanceAnalysis = buildAnalysisArtifacts({
  text:
    '2.6. Исполнитель выставляет Заказчику Акт сдачи-приемки оказанных услуг. Заказчик обязуется в течение 5 рабочих дней подписать акт либо направить мотивированный отказ. Стороны согласовывают перечень недостатков и сроки их устранения.',
  fileName: 'clear-acceptance.doc',
  selectedRole: 'Заказчик',
  language: 'ru',
  warnings: [],
});

assert.ok(!clearAcceptanceAnalysis.risks.some((risk) => risk.title === 'Неясная приемка результата'));

const colonCarrySummaryAnalysis = buildAnalysisArtifacts({
  text: [
    '4.1. Права и обязанности гражданина.',
    'Гражданин обязан: а) освоить образовательную программу; б) осуществить трудовую деятельность по полученной профессии; в) соблюдать учебный план.',
    'Заказчик обязан предоставить гражданину меры поддержки.',
  ].join('\n\n'),
  fileName: 'citizen-obligations.pdf',
  selectedRole: 'Гражданин',
  language: 'ru',
  warnings: [],
});

assert.ok(colonCarrySummaryAnalysis.summary.obligationsForSelectedRole.some((line) => line.includes('освоить образовательную программу')));
assert.ok(
  colonCarrySummaryAnalysis.summary.obligationsForSelectedRole.some((line) => line.includes('осуществить трудовую деятельность')),
);

const normalizedStructuredText = splitStructuredText("Р' договоре есть условия об ответственности. Выявлено в пункте 5.1", 4);
assert.equal(normalizedStructuredText[0], 'В договоре есть условия об ответственности.');
assert.equal(normalizeExtractedText('о с в о и т ь образовательную программу'), 'освоить образовательную программу');

const stringNormalizeDescriptor = Object.getOwnPropertyDescriptor(String.prototype, 'normalize');
try {
  Object.defineProperty(String.prototype, 'normalize', {
    configurable: true,
    value: undefined,
  });

  const hermesCompatibilityAnalysis = buildAnalysisArtifacts({
    text: [
      '1. Исполнитель обязан оказать услуги в срок до 10 дней.',
      '2. За просрочку Исполнитель уплачивает штраф 10% от цены договора.',
    ].join('\n\n'),
    fileName: 'hermes-compatibility.txt',
    selectedRole: 'Исполнитель',
    language: 'ru',
    warnings: [],
  });

  assert.ok(hermesCompatibilityAnalysis.risks.some((risk) => risk.title === 'Штрафы и санкции'));
} finally {
  if (stringNormalizeDescriptor) {
    Object.defineProperty(String.prototype, 'normalize', stringNormalizeDescriptor);
  }
}
