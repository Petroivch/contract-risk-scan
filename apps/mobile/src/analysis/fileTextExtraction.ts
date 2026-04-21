import * as FileSystem from 'expo-file-system';
import JSZip from 'jszip';

import type { UploadContractRequest } from '../api/types';
import type { SupportedLanguage } from '../i18n/types';

export interface ExtractedContractText {
  text: string;
  warnings: string[];
}

const PDF_TEXT_OBJECT_PATTERN = /\(([^()]*(?:\\.[^()]*)*)\)\s*Tj/g;
const PDF_TEXT_ARRAY_PATTERN = /\[(.*?)\]\s*TJ/g;
const XML_TAG_PATTERN = /<[^>]+>/g;
const XML_ENTITY_PATTERN = /&(?:amp|lt|gt|quot|apos);/g;
const WHITESPACE_PATTERN = /\s+/g;
const MIN_EXTRACTED_TEXT_LENGTH = 160;

const localizedWarnings: Record<SupportedLanguage, { emptyText: string; limitedPdf: string }> = {
  ru: {
    emptyText:
      'Не удалось извлечь читаемый текст из файла. Для офлайн-анализа лучше использовать текстовый PDF, DOCX или TXT.',
    limitedPdf:
      'PDF обработан в офлайн-режиме с ограниченным текстовым извлечением. Для сканов качество анализа может быть ниже.',
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
  return input.replace(/\r/g, '\n').replace(WHITESPACE_PATTERN, ' ').trim();
};

const decodeXmlEntities = (input: string): string => {
  return input.replace(XML_ENTITY_PATTERN, (entity) => {
    switch (entity) {
      case '&amp;':
        return '&';
      case '&lt;':
        return '<';
      case '&gt;':
        return '>';
      case '&quot;':
        return '"';
      case '&apos;':
        return "'";
      default:
        return entity;
    }
  });
};

const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

const decodeBase64ToBinary = (base64: string): string => {
  const sanitized = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  let output = '';
  let index = 0;

  while (index < sanitized.length) {
    const enc1 = base64Alphabet.indexOf(sanitized.charAt(index++));
    const enc2 = base64Alphabet.indexOf(sanitized.charAt(index++));
    const enc3 = base64Alphabet.indexOf(sanitized.charAt(index++));
    const enc4 = base64Alphabet.indexOf(sanitized.charAt(index++));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    output += String.fromCharCode(chr1);

    if (enc3 !== 64 && enc3 !== -1) {
      output += String.fromCharCode(chr2);
    }

    if (enc4 !== 64 && enc4 !== -1) {
      output += String.fromCharCode(chr3);
    }
  }

  return output;
};

const decodePdfString = (value: string): string => {
  return value
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\r/g, ' ')
    .replace(/\\n/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\\d{3}/g, ' ');
};

const extractPdfText = (binary: string): string => {
  const textChunks: string[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = PDF_TEXT_OBJECT_PATTERN.exec(binary)) !== null) {
    const decoded = normalizeText(decodePdfString(match[1] ?? ''));
    if (decoded) {
      textChunks.push(decoded);
    }
  }

  while ((match = PDF_TEXT_ARRAY_PATTERN.exec(binary)) !== null) {
    const rawItems = (match[1] ?? '').match(/\(([^()]*(?:\\.[^()]*)*)\)/g) ?? [];
    const decoded = normalizeText(rawItems.map((item) => decodePdfString(item.slice(1, -1))).join(' '));
    if (decoded) {
      textChunks.push(decoded);
    }
  }

  return normalizeText(textChunks.join('\n'));
};

const extractDocxText = async (uri: string): Promise<string> => {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const archive = await JSZip.loadAsync(base64, { base64: true });
  const documentXml = await archive.file('word/document.xml')?.async('string');

  if (!documentXml) {
    return '';
  }

  return normalizeText(decodeXmlEntities(documentXml.replace(XML_TAG_PATTERN, ' ')));
};

const resolveLanguageWarnings = (language: SupportedLanguage) => localizedWarnings[language] ?? localizedWarnings.ru;

export const extractContractText = async (
  payload: Pick<UploadContractRequest, 'localFileUri' | 'mimeType' | 'rawText' | 'fileName'>,
  language: SupportedLanguage,
): Promise<ExtractedContractText> => {
  if (payload.rawText?.trim()) {
    return { text: payload.rawText.trim(), warnings: [] };
  }

  if (!payload.localFileUri) {
    return { text: '', warnings: [resolveLanguageWarnings(language).emptyText] };
  }

  const fileName = payload.fileName.toLowerCase();
  const mimeType = payload.mimeType.toLowerCase();
  const warnings: string[] = [];

  if (mimeType === 'text/plain' || fileName.endsWith('.txt')) {
    const text = normalizeText(await FileSystem.readAsStringAsync(payload.localFileUri));
    return {
      text,
      warnings: text ? [] : [resolveLanguageWarnings(language).emptyText],
    };
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.endsWith('.docx')
  ) {
    const text = await extractDocxText(payload.localFileUri);
    return {
      text,
      warnings: text ? [] : [resolveLanguageWarnings(language).emptyText],
    };
  }

  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
    const base64 = await FileSystem.readAsStringAsync(payload.localFileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const text = extractPdfText(decodeBase64ToBinary(base64));

    if (text.length < MIN_EXTRACTED_TEXT_LENGTH) {
      warnings.push(resolveLanguageWarnings(language).limitedPdf);
    }

    if (!text) {
      warnings.push(resolveLanguageWarnings(language).emptyText);
    }

    return { text, warnings };
  }

  const fallbackText = normalizeText(await FileSystem.readAsStringAsync(payload.localFileUri).catch(() => ''));
  return {
    text: fallbackText,
    warnings: fallbackText ? [] : [resolveLanguageWarnings(language).emptyText],
  };
};
