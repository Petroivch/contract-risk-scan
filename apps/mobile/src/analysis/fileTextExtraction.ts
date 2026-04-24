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
const MIN_EXTRACTED_TEXT_LENGTH = 160;

const localizedWarnings: Record<SupportedLanguage, { emptyText: string; limitedPdf: string }> = {
  ru: {
    emptyText:
      'Не удалось извлечь читаемый текст из файла. Для офлайн-анализа лучше использовать текстовый PDF, DOCX или TXT.',
    limitedPdf:
      'PDF обработан в офлайн-режиме с ограниченным извлечением текста. Для сканов качество анализа может быть ниже.',
  },
  en: {
    emptyText:
      'Readable text could not be extracted from the file. For offline analysis, use a text-based PDF, DOCX, or TXT file.',
    limitedPdf:
      'The PDF was processed with limited offline text extraction. Scanned PDFs may produce lower-quality results.',
  },
  it: {
    emptyText:
      'Non e stato possibile estrarre testo leggibile dal file. Per l analisi offline usare PDF testuale, DOCX o TXT.',
    limitedPdf:
      'Il PDF e stato elaborato con estrazione testuale offline limitata. I PDF scansionati possono ridurre la qualita del risultato.',
  },
  fr: {
    emptyText:
      'Le texte lisible n a pas pu etre extrait du fichier. Pour l analyse hors ligne, utilisez un PDF texte, DOCX ou TXT.',
    limitedPdf:
      'Le PDF a ete traite avec une extraction de texte hors ligne limitee. Les PDF scannes peuvent reduire la qualite du resultat.',
  },
};

const normalizeText = (input: string): string => {
  return normalizeExtractedText(input);
};

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

const appendUniqueTextChunk = (target: string[], seen: Set<string>, value: string): void => {
  const normalized = normalizePdfText(value);
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

  appendUniqueTextChunk(textChunks, seen, extractPdfText(binary, unicodeMaps));

  for (const stream of decodedStreams) {
    if (!PDF_STREAM_HINT_PATTERN.test(stream)) {
      continue;
    }

    appendUniqueTextChunk(textChunks, seen, extractPdfText(stream, unicodeMaps));
  }

  return normalizePdfText(textChunks.join('\n'));
};

const extractDocxText = async (uri: string): Promise<string> => {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const archive = await JSZip.loadAsync(base64, { base64: true });
  const documentXml = await archive.file('word/document.xml')?.async('string');

  if (!documentXml) {
    return '';
  }

  const structuredXml = documentXml
    .replace(/<w:tab\b[^>]*\/>/g, ' ')
    .replace(/<w:br\b[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:t\b[^>]*>/g, '')
    .replace(/<\/w:t>/g, '')
    .replace(XML_TAG_PATTERN, ' ');

  return normalizeText(decodeXmlEntities(structuredXml));
};

const resolveLanguageWarnings = (language: SupportedLanguage): { emptyText: string; limitedPdf: string } => {
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

  const fileName = payload.fileName.toLowerCase();
  const mimeType = payload.mimeType.toLowerCase();
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

