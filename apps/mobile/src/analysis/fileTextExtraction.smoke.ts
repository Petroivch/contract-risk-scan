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
        throw new Error('expo-file-system should not be used in extraction smoke');
      },
    };
  }

  return originalModuleLoad.call(this, request, ...rest);
};

const {
  extractPdfTextFromBytesForTesting,
}: {
  extractPdfTextFromBytesForTesting: (bytes: Uint8Array) => string;
} = require('./fileTextExtraction');

NodeModule._load = originalModuleLoad;

const escapePdfText = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const buildPdfTextObject = (objectId: number, text: string): string => {
  const stream = `BT\n/F1 12 Tf\n72 720 Td\n(${escapePdfText(text)}) Tj\nET`;
  return `${objectId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`;
};

const multiStreamPdfPages = Array.from({ length: 7 }, (_, index) => {
  const pageNumber = index + 1;
  const repeatedSentence =
    `Stream ${pageNumber} contains contract payment terms, timeline obligations, and liability wording. `.repeat(
      18,
    );

  if (pageNumber === 7) {
    return `${repeatedSentence}Late risk marker includes penalty, liability, and unilateral termination language.`;
  }

  return repeatedSentence;
});

const multiStreamPdfBinary = [
  '%PDF-1.4',
  ...multiStreamPdfPages.map((pageText, index) => buildPdfTextObject(index + 1, pageText)),
  '%%EOF',
].join('\n');

const multiStreamExtractedText = extractPdfTextFromBytesForTesting(
  Uint8Array.from(Buffer.from(multiStreamPdfBinary, 'latin1')),
);

assert.ok(multiStreamExtractedText.includes('Late risk marker includes penalty'));
assert.ok(multiStreamExtractedText.length > 9000);
