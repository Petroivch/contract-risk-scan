import * as assert from 'node:assert/strict';

import { buildAnalysisArtifacts } from './contractAnalysis';
import { normalizeExtractedText, repairMojibakeText } from './textNormalization';
import { splitStructuredText } from '../components/report/reportText';

const repaired = repairMojibakeText('Р вЂќР С•Р С–Р С•Р Р†Р С•РЎР‚ РїРѕСЃС‚Р°РІРєРё');
assert.ok(repaired.includes('поставки'));

const normalizedParagraphs = normalizeExtractedText('Line 1\r\n\r\nLine 2');
assert.ok(normalizedParagraphs.includes('Line 1\n\nLine 2'));

const sampleContractText = [
  'Service agreement',
  'Customer shall pay the invoice within 10 business days.',
  'Contractor shall deliver the report within 5 days.',
  'Any changes are made only by agreement of the parties.',
  'The supplier may at its sole discretion terminate this contract.',
  'Liquidated damages apply for late delivery.',
  'The contract contains liability and indemnification obligations.',
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

assert.equal(analysis.summary.contractType, 'Service agreement');
assert.ok(
  analysis.summary.obligationsForSelectedRole.some((line) =>
    line.toLowerCase().includes('customer shall pay the invoice'),
  ),
);

const riskTitles = analysis.risks.map((risk) => risk.title);
assert.ok(riskTitles.includes('Unilateral change or termination'));
assert.ok(riskTitles.includes('Penalties and sanctions'));
assert.ok(riskTitles.includes('Liability and indemnification'));
assert.ok(riskTitles.includes('Unclear acceptance process'));
assert.ok(riskTitles.includes('Automatic renewal'));

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

assert.equal(
  russianAnalysis.summary.shortDescription,
  'Документ содержит 4 пунктов. Для роли "Исполнитель" в фокусе обязательства, сроки, платежи и условия с повышенным риском.',
);
assert.equal(russianAnalysis.summary.obligationsForSelectedRole[0], 'Исполнитель обязан оказать услуги и предоставить результат.');
assert.equal(russianAnalysis.risks[0]?.evidence?.[0], 'Заказчик вправе в одностороннем порядке изменить сроки.');
assert.equal(russianAnalysis.disputedClauses[0]?.clauseText, 'Заказчик вправе в одностороннем порядке изменить сроки.');

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

const normalizedStructuredText = splitStructuredText("Р' договоре есть условия об ответственности. Выявлено в пункте 5.1", 4);
assert.equal(normalizedStructuredText[0], 'В договоре есть условия об ответственности.');
