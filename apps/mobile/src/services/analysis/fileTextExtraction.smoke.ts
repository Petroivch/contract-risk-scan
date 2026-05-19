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

const encodeWindows1251 = (value: string): Uint8Array => {
  const bytes: number[] = [];

  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0x7f) {
      bytes.push(code);
    } else if (code >= 0x0410 && code <= 0x044f) {
      bytes.push(code - 0x0410 + 0xc0);
    } else if (code === 0x0401) {
      bytes.push(0xa8);
    } else if (code === 0x0451) {
      bytes.push(0xb8);
    } else {
      bytes.push(0x20);
    }
  }

  return Uint8Array.from(bytes);
};

const escapePdfLiteralBytes = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => {
    switch (byte) {
      case 0x08:
        return '\\b';
      case 0x09:
        return '\\t';
      case 0x0a:
        return '\\n';
      case 0x0c:
        return '\\f';
      case 0x0d:
        return '\\r';
      case 0x28:
      case 0x29:
      case 0x5c:
        return `\\${String.fromCharCode(byte)}`;
      default:
        return String.fromCharCode(byte);
    }
  }).join('');

const buildPdfTextObject = (objectId: number, text: string): string => {
  const stream = `BT\n/F1 12 Tf\n72 720 Td\n(${escapePdfText(text)}) Tj\nET`;
  return `${objectId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`;
};

const buildPdfTextObjectFromBytes = (objectId: number, textBytes: Uint8Array): string => {
  const escapedText = escapePdfLiteralBytes(textBytes);
  const stream = `BT\n/F1 12 Tf\n72 720 Td\n(${escapedText}) Tj\nET`;
  return `${objectId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`;
};

const buildRawPdfTextObject = (objectId: number, rawLiteralText: string): string => {
  const stream = `BT\n/F1 12 Tf\n72 720 Td\n(${rawLiteralText}) Tj\nET`;
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

const windows1251PdfText =
  'Работник уплачивает штраф Работодателю за нарушение срока договора.';
const windows1251PdfBinary = [
  '%PDF-1.4',
  buildPdfTextObjectFromBytes(20, encodeWindows1251(windows1251PdfText)),
  '%%EOF',
].join('\n');
const windows1251ExtractedText = extractPdfTextFromBytesForTesting(
  Uint8Array.from(Buffer.from(windows1251PdfBinary, 'latin1')),
);

assert.ok(windows1251ExtractedText.includes(windows1251PdfText));
assert.ok(!windows1251ExtractedText.includes('Ð'));

const utf8PdfText = 'Исполнитель уплачивает штраф 5% за просрочку.';
const utf8PdfBinary = [
  '%PDF-1.4',
  buildPdfTextObjectFromBytes(21, Uint8Array.from(Buffer.from(utf8PdfText, 'utf8'))),
  '%%EOF',
].join('\n');
const utf8ExtractedText = extractPdfTextFromBytesForTesting(
  Uint8Array.from(Buffer.from(utf8PdfBinary, 'latin1')),
);

assert.ok(utf8ExtractedText.includes(utf8PdfText));
assert.ok(!utf8ExtractedText.includes('Ð'));

const nestedParenthesesPdfText =
  'Customer (Buyer) may charge Contractor a penalty for delay.';
const nestedParenthesesPdfBinary = [
  '%PDF-1.4',
  buildRawPdfTextObject(22, nestedParenthesesPdfText),
  '%%EOF',
].join('\n');
const nestedParenthesesExtractedText = extractPdfTextFromBytesForTesting(
  Uint8Array.from(Buffer.from(nestedParenthesesPdfBinary, 'latin1')),
);

assert.ok(nestedParenthesesExtractedText.includes(nestedParenthesesPdfText));
