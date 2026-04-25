import * as FileSystem from 'expo-file-system';
import JSZip from 'jszip';

import type { UploadContractRequest } from '../api/types';
import type { SupportedLanguage } from '../i18n/types';

import { decodeXmlEntities, normalizeExtractedText } from './textNormalization';

declare const require: (moduleName: string) => unknown;

type PakoModule = {
  inflate: (input: Uint8Array) => Uint8Array;
};

interface PdfUnicodeMap {
  codeByteLengths: number[];
  mappings: Map<string, string>;
}

export interface ExtractedContractText {
  text: string;
  warnings: string[];
}

const { inflate: inflateZlib } = require('pako') as PakoModule;

const PDF_HEX_TEXT_OBJECT_PATTERN = /<([0-9A-Fa-f\s]+)>\s*(?:Tj|'|")/g;
const PDF_LENGTH_PATTERN = /\/Length\s+(\d+)/;
const PDF_OBJECT_PATTERN = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
const PDF_STREAM_HINT_PATTERN = /\b(?:BT|ET|Tf|Tj|TJ|Tm|Td|TD)\b|['"]/;
const PDF_STREAM_START_PATTERN = /\bstream(?:\r\n|\n|\r)/;
const PDF_TEXT_ARRAY_ITEM_PATTERN = /\(([^()]*(?:\\.[^()]*)*)\)|<([0-9A-Fa-f\s]+)>|(-?\d*\.?\d+)/g;
const PDF_TEXT_ARRAY_PATTERN = /\[(.*?)\]\s*TJ/gs;
const PDF_TEXT_OBJECT_PATTERN = /\(([^()]*(?:\\.[^()]*)*)\)\s*(?:Tj|'|")/g;
const XML_TAG_PATTERN = /<[^>]+>/g;
const HTML_BREAK_TAG_PATTERN = /<(?:br|\/p|\/div|\/li|\/tr|\/h[1-6])\b[^>]*>/gi;
const HTML_TAG_PATTERN = /<[^>]+>/g;
const DOCX_ABSTRACT_NUM_PATTERN =
  /<w:abstractNum\b[^>]*w:abstractNumId=(?:"([^"]+)"|'([^']+)')[\s\S]*?<\/w:abstractNum>/g;
const DOCX_BLOCK_PATTERN = /<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>/g;
const DOCX_BODY_PATTERN = /<w:body\b[^>]*>([\s\S]*?)<\/w:body>/i;
const DOCX_LEVEL_PATTERN = /<w:lvl\b[^>]*w:ilvl=(?:"([^"]+)"|'([^']+)')[\s\S]*?<\/w:lvl>/g;
const DOCX_MIN_STRUCTURED_RATIO = 0.6;
const DOCX_NUM_PATTERN =
  /<w:num\b[^>]*w:numId=(?:"([^"]+)"|'([^']+)')[\s\S]*?<w:abstractNumId\b[^>]*w:val=(?:"([^"]+)"|'([^']+)')/g;
const DOCX_PARAGRAPH_PATTERN = /<w:p\b[\s\S]*?<\/w:p>/g;
const DOCX_TABLE_CELL_PATTERN = /<w:tc\b[\s\S]*?<\/w:tc>/g;
const DOCX_TABLE_ROW_PATTERN = /<w:tr\b[\s\S]*?<\/w:tr>/g;
const MIN_EXTRACTED_TEXT_LENGTH = 160;

const localizedWarnings: Record<SupportedLanguage, { emptyText: string; limitedPdf: string; legacyDoc: string }> = {
  ru: {
    emptyText:
      'Не удалось извлечь читаемый текст из файла. Для офлайн-анализа лучше использовать текстовый PDF, DOCX или TXT.',
    limitedPdf:
      'PDF обработан в офлайн-режиме с ограниченным извлечением текста. Для сканов качество анализа может быть ниже.',
    legacyDoc:
      'Формат .doc пока не поддерживается локальным извлечением в мобильном приложении. Для точного анализа сохраните файл как DOCX, PDF с текстовым слоем или TXT.',
  },
  en: {
    emptyText:
      'Readable text could not be extracted from the file. For offline analysis, use a text-based PDF, DOCX, or TXT file.',
    limitedPdf:
      'The PDF was processed with limited offline text extraction. Scanned PDFs may produce lower-quality results.',
    legacyDoc:
      'The .doc format is not yet supported by local extraction in the mobile app. For accurate analysis, save the file as DOCX, a text-based PDF, or TXT.',
  },
  it: {
    emptyText:
      'Non e stato possibile estrarre testo leggibile dal file. Per l analisi offline usare PDF testuale, DOCX o TXT.',
    limitedPdf:
      'Il PDF e stato elaborato con estrazione testuale offline limitata. I PDF scansionati possono ridurre la qualita del risultato.',
    legacyDoc:
      'Il formato .doc non e ancora supportato dall estrazione locale nell app mobile. Per un analisi accurata salvare il file come DOCX, PDF testuale o TXT.',
  },
  fr: {
    emptyText:
      'Le texte lisible n a pas pu etre extrait du fichier. Pour l analyse hors ligne, utilisez un PDF texte, DOCX ou TXT.',
    limitedPdf:
      'Le PDF a ete traite avec une extraction de texte hors ligne limitee. Les PDF scannes peuvent reduire la qualite du resultat.',
    legacyDoc:
      'Le format .doc n est pas encore pris en charge par l extraction locale dans l application mobile. Pour une analyse fiable, enregistrez le fichier en DOCX, PDF texte ou TXT.',
  },
};

const normalizeText = (input: string): string => {
  return normalizeExtractedText(input);
};

interface DocxParagraphMeta {
  text: string;
  styleId: string;
  numId: string;
  ilvl: number;
}

interface DocxLevelDefinition {
  numFmt: string;
  lvlText: string;
}

interface DocxNumberingDefinition {
  numToAbstract: Map<string, string>;
  levelsByAbstract: Map<string, Map<number, DocxLevelDefinition>>;
}

interface DocxListMarker {
  continuationIndent: string;
  prefix: string;
}

const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

const decodeBase64ToBytes = (base64: string): Uint8Array => {
  const sanitized = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const output: number[] = [];
  let index = 0;

  while (index < sanitized.length) {
    const enc1 = base64Alphabet.indexOf(sanitized.charAt(index++));
    const enc2 = base64Alphabet.indexOf(sanitized.charAt(index++));
    const enc3 = base64Alphabet.indexOf(sanitized.charAt(index++));
    const enc4 = base64Alphabet.indexOf(sanitized.charAt(index++));

    if (enc1 < 0 || enc2 < 0) {
      continue;
    }

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    output.push(chr1 & 0xff);

    if (enc3 !== 64 && enc3 !== -1) {
      output.push(chr2 & 0xff);
    }

    if (enc4 !== 64 && enc4 !== -1) {
      output.push(chr3 & 0xff);
    }
  }

  return Uint8Array.from(output);
};

const binaryStringToBytes = (binary: string): Uint8Array => {
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index) & 0xff;
  }

  return output;
};

const bytesToBinaryString = (bytes: Uint8Array): string => {
  let output = '';

  for (let index = 0; index < bytes.length; index += 1) {
    output += String.fromCharCode(bytes[index]);
  }

  return output;
};

const bytesToHex = (bytes: Uint8Array): string => {
  let output = '';

  for (let index = 0; index < bytes.length; index += 1) {
    output += bytes[index].toString(16).padStart(2, '0');
  }

  return output.toUpperCase();
};

const decodePdfHexToBytes = (value: string): Uint8Array => {
  const sanitizedBase = value.replace(/[^0-9A-Fa-f]/g, '');
  const sanitized = sanitizedBase.length % 2 === 0 ? sanitizedBase : `${sanitizedBase}0`;

  if (!sanitized) {
    return new Uint8Array();
  }

  const bytes: number[] = [];

  for (let index = 0; index < sanitized.length; index += 2) {
    const nextByte = Number.parseInt(sanitized.slice(index, index + 2), 16);
    if (!Number.isNaN(nextByte)) {
      bytes.push(nextByte);
    }
  }

  return Uint8Array.from(bytes);
};

const decodePdfStringToBytes = (value: string): Uint8Array => {
  const bytes: number[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (char !== '\\') {
      bytes.push(char.charCodeAt(0) & 0xff);
      continue;
    }

    const nextChar = value[index + 1];
    if (!nextChar) {
      break;
    }

    if (nextChar === '\r') {
      index += value[index + 2] === '\n' ? 2 : 1;
      continue;
    }

    if (nextChar === '\n') {
      index += 1;
      continue;
    }

    if (/[0-7]/.test(nextChar)) {
      let octal = nextChar;
      let cursor = index + 2;

      while (octal.length < 3 && /[0-7]/.test(value[cursor] ?? '')) {
        octal += value[cursor] ?? '';
        cursor += 1;
      }

      bytes.push(Number.parseInt(octal, 8) & 0xff);
      index += octal.length;
      continue;
    }

    switch (nextChar) {
      case 'b':
        bytes.push(8);
        break;
      case 'f':
        bytes.push(12);
        break;
      case 'n':
        bytes.push(10);
        break;
      case 'r':
        bytes.push(13);
        break;
      case 't':
        bytes.push(9);
        break;
      default:
        bytes.push(nextChar.charCodeAt(0) & 0xff);
        break;
    }

    index += 1;
  }

  return Uint8Array.from(bytes);
};

const decodeUtf16BeBytes = (bytes: Uint8Array, stripBom = false): string => {
  if (bytes.length < 2) {
    return '';
  }

  const offset = stripBom && bytes[0] === 0xfe && bytes[1] === 0xff ? 2 : 0;
  let output = '';

  for (let index = offset; index + 1 < bytes.length; index += 2) {
    output += String.fromCharCode((bytes[index] << 8) | bytes[index + 1]);
  }

  return output;
};

const looksLikeUtf16Be = (bytes: Uint8Array): boolean => {
  if (bytes.length < 2 || bytes.length % 2 !== 0) {
    return false;
  }

  let zeroPairs = 0;
  const totalPairs = bytes.length / 2;

  for (let index = 0; index + 1 < bytes.length; index += 2) {
    if (bytes[index] === 0 || bytes[index + 1] === 0) {
      zeroPairs += 1;
    }
  }

  return zeroPairs >= Math.ceil(totalPairs / 3);
};

const decodePdfBytesAsLatin1 = (bytes: Uint8Array): string => {
  return bytesToBinaryString(bytes);
};

const sanitizePdfTextCandidate = (value: string): string => {
  return normalizeText(value.replace(/[\r\n\t]+/g, ' '));
};

const PDF_ARRAY_SPACE_GAP = -140;
const PDF_ARRAY_LINE_GAP = -900;
const CYRILLIC_LETTER_PATTERN = /[А-Яа-яЁё]/;

const isWordLikeCharacter = (value: string | undefined): boolean => {
  return Boolean(value && /[0-9A-Za-zА-Яа-яЁё]/.test(value));
};

const isOpeningPunctuation = (value: string | undefined): boolean => {
  return Boolean(value && /[([{"'«„]/.test(value));
};

const isClosingPunctuation = (value: string | undefined): boolean => {
  return Boolean(value && /[)\]},"'»“.!?:;%]/.test(value));
};

const collapseSpacedRussianLetters = (value: string): string => {
  return value.replace(
    /(^|[^0-9A-Za-zА-Яа-яЁё])([А-Яа-яЁё](?:\s+[А-Яа-яЁё]){2,})(?=[^0-9A-Za-zА-Яа-яЁё]|$)/g,
    (_fullMatch, prefix: string, letters: string) => `${prefix}${letters.replace(/\s+/g, '')}`,
  );
};

const repairPdfTextLayout = (value: string): string => {
  return value
    .replace(/([0-9A-Za-zА-Яа-яЁё])-\s*\n\s*(?=[0-9A-Za-zА-Яа-яЁё])/g, '$1')
    .replace(/([^\n])\n(?=\s*(?:[-*•▪‣◦]|\d+[.)]|[A-Za-zА-Яа-яЁё][.)])\s+)/g, '$1\n')
    .split('\n')
    .map((line) => collapseSpacedRussianLetters(line))
    .join('\n');
};

const normalizePdfText = (value: string): string => {
  return normalizeText(repairPdfTextLayout(value));
};

const scorePdfTextCandidate = (value: string): number => {
  let score = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const code = char.charCodeAt(0);

    if (code === 0xfffd || (code < 32 && code !== 9 && code !== 10 && code !== 13)) {
      score -= 4;
      continue;
    }

    if (/\s/.test(char)) {
      score += 0.4;
      continue;
    }

    if (char.toLowerCase() !== char.toUpperCase()) {
      score += 2;
      continue;
    }

    if ((code >= 48 && code <= 57) || (code >= 33 && code <= 126) || code >= 160) {
      score += 1;
      continue;
    }

    score -= 1;
  }

  return score;
};

const isLikelyPdfTextChunk = (value: string): boolean => {
  const normalized = normalizePdfText(value);
  if (normalized.length < 20) {
    return false;
  }

  const alphaCount = (normalized.match(/\p{L}/gu) ?? []).length;
  const digitCount = (normalized.match(/\p{N}/gu) ?? []).length;
  const strangeCount = (normalized.match(/[^\p{L}\p{N}\s.,:;!?()[\]{}"'`«»„“”%№/\-–—]/gu) ?? []).length;

  return alphaCount >= 12 && strangeCount <= Math.max(6, Math.trunc((alphaCount + digitCount) * 0.25));
};

const trimPdfNoiseLines = (value: string): string => {
  const lines = normalizePdfText(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return '';
  }

  let firstUsefulIndex = 0;
  for (let index = 0; index < Math.min(lines.length, 6); index += 1) {
    if (isLikelyPdfTextChunk(lines[index] ?? '')) {
      firstUsefulIndex = index;
      break;
    }
  }

  return normalizePdfText(
    lines
      .slice(firstUsefulIndex)
      .filter((line) => isLikelyPdfTextChunk(line) || /[\p{L}\p{N}]{3,}/u.test(line))
      .join('\n'),
  );
};

const appendUniqueTextChunk = (target: string[], seen: Set<string>, value: string): void => {
  const normalized = trimPdfNoiseLines(value);
  if (!normalized || seen.has(normalized)) {
    return;
  }

  seen.add(normalized);
  target.push(normalized);
};

const decodeUnicodeHexString = (value: string): string => {
  return decodeUtf16BeBytes(decodePdfHexToBytes(value));
};

const incrementHexValue = (value: string, offset: number): string => {
  const base = Number.parseInt(value, 16);
  if (Number.isNaN(base)) {
    return value.toUpperCase();
  }

  return (base + offset).toString(16).padStart(value.length, '0').toUpperCase();
};

const parsePdfUnicodeMap = (content: string): PdfUnicodeMap | null => {
  if (!content.includes('begincmap')) {
    return null;
  }

  const mappings = new Map<string, string>();

  for (const block of content.matchAll(/\d+\s+beginbfchar([\s\S]*?)endbfchar/g)) {
    const body = block[1] ?? '';

    for (const entry of body.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const source = (entry[1] ?? '').toUpperCase();
      const target = decodeUnicodeHexString(entry[2] ?? '');

      if (source && target) {
        mappings.set(source, target);
      }
    }
  }

  for (const block of content.matchAll(/\d+\s+beginbfrange([\s\S]*?)endbfrange/g)) {
    const body = block[1] ?? '';

    for (const entry of body.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[((?:\s*<[^>]+>\s*)+)\]/g)) {
      const start = Number.parseInt(entry[1] ?? '', 16);
      const end = Number.parseInt(entry[2] ?? '', 16);
      const targets = Array.from((entry[3] ?? '').matchAll(/<([0-9A-Fa-f]+)>/g), (match) => match[1] ?? '');
      const width = (entry[1] ?? '').length;

      if (Number.isNaN(start) || Number.isNaN(end) || !targets.length) {
        continue;
      }

      for (let offset = 0; offset <= end - start && offset < targets.length; offset += 1) {
        const source = (start + offset).toString(16).padStart(width, '0').toUpperCase();
        const target = decodeUnicodeHexString(targets[offset] ?? '');

        if (target) {
          mappings.set(source, target);
        }
      }
    }

    for (const entry of body.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const start = Number.parseInt(entry[1] ?? '', 16);
      const end = Number.parseInt(entry[2] ?? '', 16);
      const width = (entry[1] ?? '').length;
      const targetSeed = entry[3] ?? '';

      if (Number.isNaN(start) || Number.isNaN(end) || !targetSeed) {
        continue;
      }

      for (let offset = 0; offset <= end - start; offset += 1) {
        const source = (start + offset).toString(16).padStart(width, '0').toUpperCase();
        const target = decodeUnicodeHexString(incrementHexValue(targetSeed, offset));

        if (target) {
          mappings.set(source, target);
        }
      }
    }
  }

  if (!mappings.size) {
    return null;
  }

  const codeByteLengths = Array.from(
    new Set(Array.from(mappings.keys(), (key) => key.length / 2).filter((length) => length > 0)),
  ).sort((left, right) => right - left);

  return {
    codeByteLengths,
    mappings,
  };
};

const decodeWithUnicodeMap = (bytes: Uint8Array, unicodeMap: PdfUnicodeMap): string => {
  let output = '';
  let index = 0;

  while (index < bytes.length) {
    let matched = false;

    for (const codeByteLength of unicodeMap.codeByteLengths) {
      if (codeByteLength <= 0 || index + codeByteLength > bytes.length) {
        continue;
      }

      const code = bytesToHex(bytes.slice(index, index + codeByteLength));
      const decoded = unicodeMap.mappings.get(code);

      if (!decoded) {
        continue;
      }

      output += decoded;
      index += codeByteLength;
      matched = true;
      break;
    }

    if (!matched) {
      output += String.fromCharCode(bytes[index] ?? 0);
      index += 1;
    }
  }

  return output;
};

const decodePdfTextBytes = (bytes: Uint8Array, unicodeMaps: PdfUnicodeMap[]): string => {
  const candidates = new Map<string, number>();

  const addCandidate = (value: string): void => {
    const normalized = sanitizePdfTextCandidate(value);
    if (!normalized) {
      return;
    }

    const score = scorePdfTextCandidate(value);
    const existingScore = candidates.get(normalized);
    if (existingScore === undefined || score > existingScore) {
      candidates.set(normalized, score);
    }
  };

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    addCandidate(decodeUtf16BeBytes(bytes, true));
  }

  if (looksLikeUtf16Be(bytes)) {
    addCandidate(decodeUtf16BeBytes(bytes));
  }

  addCandidate(decodePdfBytesAsLatin1(bytes));

  for (const unicodeMap of unicodeMaps) {
    addCandidate(decodeWithUnicodeMap(bytes, unicodeMap));
  }

  let bestCandidate = '';
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const [candidate, score] of candidates.entries()) {
    if (score > bestScore || (score === bestScore && candidate.length > bestCandidate.length)) {
      bestCandidate = candidate;
      bestScore = score;
    }
  }

  return bestCandidate;
};

const decodePdfString = (value: string, unicodeMaps: PdfUnicodeMap[]): string => {
  return decodePdfTextBytes(decodePdfStringToBytes(value), unicodeMaps);
};

const decodePdfHexString = (value: string, unicodeMaps: PdfUnicodeMap[]): string => {
  return decodePdfTextBytes(decodePdfHexToBytes(value), unicodeMaps);
};

const shouldInsertArraySeparator = (
  currentOutput: string,
  nextChunk: string,
  pendingGap: number | null,
): '' | ' ' | '\n' => {
  if (!currentOutput) {
    return '';
  }

  const previousCharacter = currentOutput[currentOutput.length - 1];
  const nextCharacter = nextChunk[0];

  if (!previousCharacter || !nextCharacter) {
    return '';
  }

  if (/\s/.test(previousCharacter) || /\s/.test(nextCharacter)) {
    return '';
  }

  if (pendingGap !== null) {
    if (pendingGap <= PDF_ARRAY_LINE_GAP) {
      return '\n';
    }

    if (pendingGap <= PDF_ARRAY_SPACE_GAP) {
      return ' ';
    }
  }

  if (isOpeningPunctuation(nextCharacter) || isClosingPunctuation(previousCharacter)) {
    return '';
  }

  if (isClosingPunctuation(nextCharacter)) {
    return '';
  }

  if (isOpeningPunctuation(previousCharacter)) {
    return '';
  }

  if (isWordLikeCharacter(previousCharacter) && isWordLikeCharacter(nextCharacter)) {
    if (CYRILLIC_LETTER_PATTERN.test(previousCharacter) && CYRILLIC_LETTER_PATTERN.test(nextCharacter)) {
      return '';
    }

    return pendingGap !== null && pendingGap <= PDF_ARRAY_SPACE_GAP / 2 ? ' ' : '';
  }

  return '';
};

const decodePdfTextArray = (value: string, unicodeMaps: PdfUnicodeMap[]): string => {
  let output = '';
  let pendingGap: number | null = null;

  for (const item of value.matchAll(PDF_TEXT_ARRAY_ITEM_PATTERN)) {
    if (item[3]) {
      const numericGap = Number.parseFloat(item[3]);
      pendingGap = Number.isFinite(numericGap) ? numericGap : pendingGap;
      continue;
    }

    const decoded = item[1]
      ? decodePdfString(item[1], unicodeMaps)
      : item[2]
        ? decodePdfHexString(item[2], unicodeMaps)
        : '';

    if (!decoded) {
      continue;
    }

    output += `${shouldInsertArraySeparator(output, decoded, pendingGap)}${decoded}`;
    pendingGap = null;
  }

  return output;
};

const normalizePdfFilterName = (value: string): string => {
  switch (value.replace(/^\/+/, '')) {
    case 'A85':
    case 'ASCII85Decode':
      return 'ASCII85Decode';
    case 'AHx':
    case 'ASCIIHexDecode':
      return 'ASCIIHexDecode';
    case 'Fl':
    case 'FlateDecode':
      return 'FlateDecode';
    default:
      return value.replace(/^\/+/, '');
  }
};

const extractPdfFilterNames = (dictionary: string): string[] => {
  const filterMatch = dictionary.match(/\/Filter\s*(\[[^\]]+\]|\/[A-Za-z0-9.#]+)/);
  const rawValue = filterMatch?.[1] ?? '';

  if (!rawValue) {
    return [];
  }

  return Array.from(rawValue.matchAll(/\/([A-Za-z0-9.#]+)/g), (match) => normalizePdfFilterName(match[1] ?? ''));
};

const decodeAsciiHexBytes = (value: string): Uint8Array => {
  return decodePdfHexToBytes(value.replace(/>.*$/s, ''));
};

const decodeAscii85Bytes = (value: string): Uint8Array => {
  const trimmed = value.replace(/\s+/g, '');
  const withoutPrefix = trimmed.startsWith('<~') ? trimmed.slice(2) : trimmed;
  const endIndex = withoutPrefix.indexOf('~>');
  const payload = (endIndex === -1 ? withoutPrefix : withoutPrefix.slice(0, endIndex)).replace(/\s+/g, '');
  const bytes: number[] = [];
  const group: number[] = [];

  for (let index = 0; index < payload.length; index += 1) {
    const char = payload[index];

    if (char === 'z' && group.length === 0) {
      bytes.push(0, 0, 0, 0);
      continue;
    }

    const code = char.charCodeAt(0);
    if (code < 33 || code > 117) {
      continue;
    }

    group.push(code - 33);

    if (group.length === 5) {
      let value32 = 0;

      for (const digit of group) {
        value32 = value32 * 85 + digit;
      }

      bytes.push((value32 >>> 24) & 0xff, (value32 >>> 16) & 0xff, (value32 >>> 8) & 0xff, value32 & 0xff);
      group.length = 0;
    }
  }

  if (group.length > 1) {
    const outputLength = group.length - 1;

    while (group.length < 5) {
      group.push(84);
    }

    let value32 = 0;

    for (const digit of group) {
      value32 = value32 * 85 + digit;
    }

    const padded = [(value32 >>> 24) & 0xff, (value32 >>> 16) & 0xff, (value32 >>> 8) & 0xff, value32 & 0xff];
    bytes.push(...padded.slice(0, outputLength));
  }

  return Uint8Array.from(bytes);
};

const decodePdfStreamData = (rawStream: string, filters: string[]): Uint8Array | null => {
  let decoded = binaryStringToBytes(rawStream);

  for (const filter of filters) {
    try {
      switch (filter) {
        case 'ASCII85Decode':
          decoded = decodeAscii85Bytes(bytesToBinaryString(decoded));
          break;
        case 'ASCIIHexDecode':
          decoded = decodeAsciiHexBytes(bytesToBinaryString(decoded));
          break;
        case 'FlateDecode':
          decoded = inflateZlib(decoded);
          break;
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  return decoded;
};

const trimPdfStreamSuffix = (value: string): string => {
  if (value.endsWith('\r\n')) {
    return value.slice(0, -2);
  }

  if (value.endsWith('\n') || value.endsWith('\r')) {
    return value.slice(0, -1);
  }

  return value;
};

const extractDecodedPdfStreams = (binary: string): string[] => {
  const streams: string[] = [];

  for (const pdfObject of binary.matchAll(PDF_OBJECT_PATTERN)) {
    const body = pdfObject[3] ?? '';
    const streamMatch = PDF_STREAM_START_PATTERN.exec(body);

    if (!streamMatch) {
      continue;
    }

    const streamStart = (streamMatch.index ?? 0) + streamMatch[0].length;
    const dictionaryEnd = body.lastIndexOf('>>', streamMatch.index);
    const dictionaryStart = dictionaryEnd >= 0 ? body.lastIndexOf('<<', dictionaryEnd) : -1;

    if (dictionaryStart < 0 || dictionaryEnd < 0) {
      continue;
    }

    const dictionary = body.slice(dictionaryStart, dictionaryEnd + 2);
    const filters = extractPdfFilterNames(dictionary);
    const lengthMatch = dictionary.match(PDF_LENGTH_PATTERN);
    let rawStream = '';

    if (lengthMatch?.[1]) {
      const streamLength = Number.parseInt(lengthMatch[1], 10);

      if (!Number.isNaN(streamLength) && streamStart + streamLength <= body.length) {
        rawStream = body.slice(streamStart, streamStart + streamLength);
      }
    }

    if (!rawStream) {
      const streamEnd = body.indexOf('endstream', streamStart);

      if (streamEnd < 0) {
        continue;
      }

      rawStream = trimPdfStreamSuffix(body.slice(streamStart, streamEnd));
    }

    const decodedBytes = decodePdfStreamData(rawStream, filters);

    if (!decodedBytes?.length) {
      continue;
    }

    streams.push(bytesToBinaryString(decodedBytes));
  }

  return streams;
};

const extractPdfText = (binary: string, unicodeMaps: PdfUnicodeMap[]): string => {
  const textChunks: string[] = [];
  const seen = new Set<string>();

  for (const match of binary.matchAll(PDF_TEXT_OBJECT_PATTERN)) {
    appendUniqueTextChunk(textChunks, seen, decodePdfString(match[1] ?? '', unicodeMaps));
  }

  for (const match of binary.matchAll(PDF_HEX_TEXT_OBJECT_PATTERN)) {
    appendUniqueTextChunk(textChunks, seen, decodePdfHexString(match[1] ?? '', unicodeMaps));
  }

  for (const match of binary.matchAll(PDF_TEXT_ARRAY_PATTERN)) {
    const decoded = decodePdfTextArray(match[1] ?? '', unicodeMaps);

    appendUniqueTextChunk(textChunks, seen, decoded);
  }

  return normalizePdfText(textChunks.join('\n'));
};

const extractPdfDocumentText = (binary: string): string => {
  const decodedStreams = extractDecodedPdfStreams(binary);
  const unicodeMaps = decodedStreams
    .map((stream) => parsePdfUnicodeMap(stream))
    .filter((unicodeMap): unicodeMap is PdfUnicodeMap => Boolean(unicodeMap));
  const textChunks: string[] = [];
  const seen = new Set<string>();

  const mainText = extractPdfText(binary, unicodeMaps);
  if (isLikelyPdfTextChunk(mainText)) {
    appendUniqueTextChunk(textChunks, seen, mainText);
  }

  for (const stream of decodedStreams) {
    if (!PDF_STREAM_HINT_PATTERN.test(stream)) {
      continue;
    }

    const streamText = extractPdfText(stream, unicodeMaps);
    if (!isLikelyPdfTextChunk(streamText)) {
      continue;
    }

    appendUniqueTextChunk(textChunks, seen, streamText);
  }

  return normalizePdfText(textChunks.join('\n'));
};

const extractHtmlText = (html: string): string => {
  const stripped = decodeXmlEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(HTML_BREAK_TAG_PATTERN, '\n')
      .replace(HTML_TAG_PATTERN, ' '),
  );

  return normalizeText(stripped);
};

const extractXmlAttribute = (xml: string, pattern: RegExp): string => {
  const match = xml.match(pattern);
  return decodeXmlEntities((match?.[1] ?? match?.[2] ?? '').trim());
};

const stripDocxNonVisibleXml = (xml: string): string => {
  return xml
    .replace(/<w:del\b[\s\S]*?<\/w:del>/g, '')
    .replace(/<w:delText\b[\s\S]*?<\/w:delText>/g, '')
    .replace(/<w:instrText\b[\s\S]*?<\/w:instrText>/g, '')
    .replace(/<w:(?:bookmark|commentRange)(?:Start|End)\b[^>]*\/>/g, '')
    .replace(/<w:proofErr\b[^>]*\/>/g, '');
};

const extractFlatDocxText = (documentXml: string): string => {
  const structuredXml = stripDocxNonVisibleXml(documentXml)
    .replace(/<w:tab\b[^>]*\/>/g, ' ')
    .replace(/<w:(?:br|cr)\b[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:t\b[^>]*>/g, '')
    .replace(/<\/w:t>/g, '')
    .replace(XML_TAG_PATTERN, ' ');

  return normalizeText(decodeXmlEntities(structuredXml));
};

const extractDocxInlineText = (xml: string): string => {
  const inlineText = stripDocxNonVisibleXml(xml)
    .replace(/<w:(?:tab|ptab)\b[^>]*\/>/g, '\t')
    .replace(/<w:(?:br|cr)\b[^>]*\/>/g, '\n')
    .replace(/<w:noBreakHyphen\b[^>]*\/>/g, '-')
    .replace(/<w:softHyphen\b[^>]*\/>/g, '')
    .replace(/<w:t\b[^>]*>/g, '')
    .replace(/<\/w:t>/g, '')
    .replace(XML_TAG_PATTERN, '');

  return decodeXmlEntities(inlineText)
    .replace(/\u00a0/g, ' ')
    .replace(/\t+/g, ' ')
    .replace(/[ ]*\n[ ]*/g, '\n');
};

const parseDocxNumberingDefinition = (numberingXml: string | undefined): DocxNumberingDefinition => {
  const levelsByAbstract = new Map<string, Map<number, DocxLevelDefinition>>();
  const numToAbstract = new Map<string, string>();

  if (!numberingXml) {
    return { levelsByAbstract, numToAbstract };
  }

  for (const abstractMatch of numberingXml.matchAll(DOCX_ABSTRACT_NUM_PATTERN)) {
    const abstractXml = abstractMatch[0] ?? '';
    const abstractNumId = abstractMatch[1] ?? abstractMatch[2] ?? '';

    if (!abstractNumId) {
      continue;
    }

    const levels = new Map<number, DocxLevelDefinition>();

    for (const levelMatch of abstractXml.matchAll(DOCX_LEVEL_PATTERN)) {
      const levelXml = levelMatch[0] ?? '';
      const ilvl = Number.parseInt(levelMatch[1] ?? levelMatch[2] ?? '0', 10);

      if (Number.isNaN(ilvl)) {
        continue;
      }

      levels.set(ilvl, {
        lvlText: extractXmlAttribute(levelXml, /<w:lvlText\b[^>]*w:val=(?:"([^"]+)"|'([^']+)')/i) || `%${ilvl + 1}.`,
        numFmt: extractXmlAttribute(levelXml, /<w:numFmt\b[^>]*w:val=(?:"([^"]+)"|'([^']+)')/i) || 'decimal',
      });
    }

    if (levels.size) {
      levelsByAbstract.set(abstractNumId, levels);
    }
  }

  for (const numMatch of numberingXml.matchAll(DOCX_NUM_PATTERN)) {
    const numId = numMatch[1] ?? numMatch[2] ?? '';
    const abstractNumId = numMatch[3] ?? numMatch[4] ?? '';

    if (!numId || !abstractNumId) {
      continue;
    }

    numToAbstract.set(numId, abstractNumId);
  }

  return { levelsByAbstract, numToAbstract };
};

const formatRomanNumeral = (value: number): string => {
  if (value <= 0) {
    return '0';
  }

  const romanValues: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let remaining = value;
  let output = '';

  for (const [numericValue, romanToken] of romanValues) {
    while (remaining >= numericValue) {
      output += romanToken;
      remaining -= numericValue;
    }
  }

  return output;
};

const formatAlphabeticCounter = (value: number): string => {
  if (value <= 0) {
    return '0';
  }

  let remaining = value;
  let output = '';

  while (remaining > 0) {
    remaining -= 1;
    output = String.fromCharCode(65 + (remaining % 26)) + output;
    remaining = Math.floor(remaining / 26);
  }

  return output;
};

const formatDocxListCounter = (value: number, format: string): string => {
  switch (format) {
    case 'lowerLetter':
      return formatAlphabeticCounter(value).toLowerCase();
    case 'upperLetter':
      return formatAlphabeticCounter(value);
    case 'lowerRoman':
      return formatRomanNumeral(value).toLowerCase();
    case 'upperRoman':
      return formatRomanNumeral(value);
    case 'decimalZero':
      return value.toString().padStart(2, '0');
    default:
      return value.toString();
  }
};

const parseDocxParagraphMeta = (paragraphXml: string): DocxParagraphMeta => {
  const text = normalizeText(extractDocxInlineText(paragraphXml));
  const styleId = extractXmlAttribute(paragraphXml, /<w:pStyle\b[^>]*w:val=(?:"([^"]+)"|'([^']+)')/i);
  const numPrMatch = paragraphXml.match(/<w:numPr\b[\s\S]*?<\/w:numPr>/);
  const numPrXml = numPrMatch?.[0] ?? '';
  const numId = extractXmlAttribute(numPrXml, /<w:numId\b[^>]*w:val=(?:"([^"]+)"|'([^']+)')/i);
  const ilvl = Number.parseInt(
    extractXmlAttribute(numPrXml, /<w:ilvl\b[^>]*w:val=(?:"([^"]+)"|'([^']+)')/i) || '0',
    10,
  );

  return {
    ilvl: Number.isNaN(ilvl) ? 0 : ilvl,
    numId,
    styleId,
    text,
  };
};

const getDocxHeadingLevel = (paragraphXml: string, styleId: string): number => {
  const normalizedStyle = styleId.replace(/[\s_-]+/g, '').toLowerCase();
  const headingMatch = normalizedStyle.match(/heading([1-6])/);

  if (headingMatch?.[1]) {
    return Number.parseInt(headingMatch[1], 10);
  }

  if (normalizedStyle === 'title') {
    return 1;
  }

  if (normalizedStyle === 'subtitle') {
    return 2;
  }

  const outlineLevel = Number.parseInt(
    extractXmlAttribute(paragraphXml, /<w:outlineLvl\b[^>]*w:val=(?:"([^"]+)"|'([^']+)')/i),
    10,
  );

  if (Number.isNaN(outlineLevel)) {
    return 0;
  }

  return Math.min(Math.max(outlineLevel + 1, 1), 6);
};

const getDocxListMarker = (
  paragraphMeta: DocxParagraphMeta,
  numberingDefinition: DocxNumberingDefinition,
  numberingState: Map<string, number[]>,
): DocxListMarker | null => {
  if (!paragraphMeta.numId) {
    return null;
  }

  const abstractNumId = numberingDefinition.numToAbstract.get(paragraphMeta.numId);
  const levels = abstractNumId ? numberingDefinition.levelsByAbstract.get(abstractNumId) : undefined;
  const levelDefinition = levels?.get(paragraphMeta.ilvl);
  const counters = numberingState.get(paragraphMeta.numId) ?? [];

  while (counters.length <= paragraphMeta.ilvl) {
    counters.push(0);
  }

  counters[paragraphMeta.ilvl] = (counters[paragraphMeta.ilvl] ?? 0) + 1;

  for (let index = paragraphMeta.ilvl + 1; index < counters.length; index += 1) {
    counters[index] = 0;
  }

  numberingState.set(paragraphMeta.numId, counters);

  const indent = '  '.repeat(Math.min(paragraphMeta.ilvl, 8));

  if (!levelDefinition || levelDefinition.numFmt === 'bullet') {
    const bulletText = levelDefinition?.lvlText.replace(/%\d+/g, '').trim() || '•';

    return {
      continuationIndent: `${indent}  `,
      prefix: `${indent}${bulletText.replace(/\s+/g, ' ')} `,
    };
  }

  const marker = (levelDefinition.lvlText || `%${paragraphMeta.ilvl + 1}.`)
    .replace(/%(\d+)/g, (_fullMatch, placeholderValue: string) => {
      const placeholderLevel = Math.max(Number.parseInt(placeholderValue, 10) - 1, 0);
      const counterValue = counters[placeholderLevel] && counters[placeholderLevel] > 0 ? counters[placeholderLevel] : 1;
      const counterFormat = levels?.get(placeholderLevel)?.numFmt ?? levelDefinition.numFmt;

      return formatDocxListCounter(counterValue, counterFormat);
    })
    .trim();

  return {
    continuationIndent: `${indent}  `,
    prefix: `${indent}${marker || `${formatDocxListCounter(counters[paragraphMeta.ilvl] ?? 1, levelDefinition.numFmt)}.`} `,
  };
};

const applyDocxPrefix = (text: string, prefix: string, continuationIndent = ''): string => {
  const lines = text.split('\n');

  return lines
    .map((line, index) => {
      if (index === 0) {
        return `${prefix}${line}`;
      }

      return continuationIndent ? `${continuationIndent}${line}` : line;
    })
    .join('\n');
};

const extractDocxParagraphText = (
  paragraphXml: string,
  numberingDefinition: DocxNumberingDefinition,
  numberingState: Map<string, number[]>,
): string => {
  const paragraphMeta = parseDocxParagraphMeta(paragraphXml);

  if (!paragraphMeta.text) {
    return '';
  }

  const headingLevel = getDocxHeadingLevel(paragraphXml, paragraphMeta.styleId);
  if (headingLevel > 0) {
    return applyDocxPrefix(paragraphMeta.text, `${'#'.repeat(headingLevel)} `);
  }

  const listMarker = getDocxListMarker(paragraphMeta, numberingDefinition, numberingState);
  if (listMarker) {
    return applyDocxPrefix(paragraphMeta.text, listMarker.prefix, listMarker.continuationIndent);
  }

  return paragraphMeta.text;
};

const extractDocxTableText = (
  tableXml: string,
  numberingDefinition: DocxNumberingDefinition,
  numberingState: Map<string, number[]>,
): string => {
  const rows: string[] = [];

  for (const rowMatch of tableXml.matchAll(DOCX_TABLE_ROW_PATTERN)) {
    const rowXml = rowMatch[0] ?? '';
    const cells: string[] = [];

    for (const cellMatch of rowXml.matchAll(DOCX_TABLE_CELL_PATTERN)) {
      const cellXml = cellMatch[0] ?? '';
      const cellParagraphs = Array.from(cellXml.matchAll(DOCX_PARAGRAPH_PATTERN), (paragraphMatch) =>
        extractDocxParagraphText(paragraphMatch[0] ?? '', numberingDefinition, numberingState),
      ).filter((value) => Boolean(value));

      cells.push(cellParagraphs.join('\n').trim().replace(/\n+/g, ' / '));
    }

    if (cells.some((cell) => Boolean(cell.trim()))) {
      rows.push(`| ${cells.join(' | ')} |`);
    }
  }

  return rows.join('\n');
};

const extractStructuredDocxText = (
  documentXml: string,
  numberingDefinition: DocxNumberingDefinition,
): string => {
  const bodyXml = DOCX_BODY_PATTERN.exec(documentXml)?.[1] ?? documentXml;
  const numberingState = new Map<string, number[]>();
  const blocks: string[] = [];

  for (const blockMatch of bodyXml.matchAll(DOCX_BLOCK_PATTERN)) {
    const blockXml = blockMatch[0] ?? '';
    const blockText = blockXml.startsWith('<w:tbl')
      ? extractDocxTableText(blockXml, numberingDefinition, numberingState)
      : extractDocxParagraphText(blockXml, numberingDefinition, numberingState);

    if (blockText) {
      blocks.push(blockText);
    }
  }

  return normalizeText(blocks.join('\n\n'));
};

const pickDocxExtractionResult = (structuredText: string, flatText: string): string => {
  if (!structuredText) {
    return flatText;
  }

  if (!flatText) {
    return structuredText;
  }

  return structuredText.length >= Math.ceil(flatText.length * DOCX_MIN_STRUCTURED_RATIO) ? structuredText : flatText;
};

const extractDocxText = async (uri: string): Promise<string> => {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const archive = await JSZip.loadAsync(base64, { base64: true });
  const documentXml = await archive.file('word/document.xml')?.async('string');
  const numberingXml = await archive.file('word/numbering.xml')?.async('string');

  if (!documentXml) {
    return '';
  }

  const flatText = extractFlatDocxText(documentXml);
  const structuredText = extractStructuredDocxText(documentXml, parseDocxNumberingDefinition(numberingXml));

  return pickDocxExtractionResult(structuredText, flatText);
};

const resolveLanguageWarnings = (
  language: SupportedLanguage,
): { emptyText: string; limitedPdf: string; legacyDoc: string } => {
  return localizedWarnings[language] ?? localizedWarnings.ru;
};

export const extractContractText = async (
  payload: Pick<UploadContractRequest, 'localFileUri' | 'mimeType' | 'rawText' | 'fileName'>,
  language: SupportedLanguage,
): Promise<ExtractedContractText> => {
  const warningsDictionary = resolveLanguageWarnings(language);

  if (payload.rawText?.trim()) {
    return { text: normalizeText(payload.rawText), warnings: [] };
  }

  if (!payload.localFileUri) {
    return { text: '', warnings: [warningsDictionary.emptyText] };
  }

  const fileName = (payload.fileName ?? '').toLowerCase();
  const mimeType = (payload.mimeType ?? '').toLowerCase();
  const warnings: string[] = [];

  if (mimeType === 'text/plain' || fileName.endsWith('.txt')) {
    try {
      const text = normalizeText(await FileSystem.readAsStringAsync(payload.localFileUri));
      return {
        text,
        warnings: text ? [] : [warningsDictionary.emptyText],
      };
    } catch {
      return { text: '', warnings: [warningsDictionary.emptyText] };
    }
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.endsWith('.docx')
  ) {
    try {
      const text = await extractDocxText(payload.localFileUri);
      return {
        text,
        warnings: text ? [] : [warningsDictionary.emptyText],
      };
    } catch {
      return { text: '', warnings: [warningsDictionary.emptyText] };
    }
  }

  if (mimeType === 'text/html' || fileName.endsWith('.html') || fileName.endsWith('.htm')) {
    try {
      const html = await FileSystem.readAsStringAsync(payload.localFileUri);
      const text = extractHtmlText(html);
      return {
        text,
        warnings: text ? [] : [warningsDictionary.emptyText],
      };
    } catch {
      return { text: '', warnings: [warningsDictionary.emptyText] };
    }
  }

  if (mimeType === 'application/msword' || fileName.endsWith('.doc')) {
    return { text: '', warnings: [warningsDictionary.legacyDoc] };
  }

  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    let text = '';

    try {
      const base64 = await FileSystem.readAsStringAsync(payload.localFileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      text = extractPdfDocumentText(bytesToBinaryString(decodeBase64ToBytes(base64)));
    } catch {
      warnings.push(warningsDictionary.emptyText);
      return { text: '', warnings };
    }

    if (text.length < MIN_EXTRACTED_TEXT_LENGTH) {
      warnings.push(warningsDictionary.limitedPdf);
    }

    if (!text) {
      warnings.push(warningsDictionary.emptyText);
    }

    return { text, warnings };
  }

  const fallbackText = normalizeText(await FileSystem.readAsStringAsync(payload.localFileUri).catch(() => ''));
  return {
    text: fallbackText,
    warnings: fallbackText ? [] : [warningsDictionary.emptyText],
  };
};

