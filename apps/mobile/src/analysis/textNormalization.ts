const XML_ENTITY_PATTERN = /&(?:amp|lt|gt|quot|apos);|&#(?:x[0-9A-Fa-f]+|\d+);/g;

const CP1251_DECODE_TABLE = [
  'Ђ',
  'Ѓ',
  '‚',
  'ѓ',
  '„',
  '…',
  '†',
  '‡',
  '€',
  '‰',
  'Љ',
  '‹',
  'Њ',
  'Ќ',
  'Ћ',
  'Џ',
  'ђ',
  '‘',
  '’',
  '“',
  '”',
  '•',
  '–',
  '—',
  '˜',
  '™',
  'љ',
  '›',
  'њ',
  'ќ',
  'ћ',
  'џ',
  '\u00a0',
  'Ў',
  'ў',
  'Ј',
  '¤',
  'Ґ',
  '¦',
  '§',
  'Ё',
  '©',
  'Є',
  '«',
  '¬',
  '\u00ad',
  '®',
  'Ї',
  '°',
  '±',
  'І',
  'і',
  'ґ',
  'µ',
  '¶',
  '·',
  'ё',
  '№',
  'є',
  '»',
  'ј',
  'Ѕ',
  'ѕ',
  'ї',
  'А',
  'Б',
  'В',
  'Г',
  'Д',
  'Е',
  'Ж',
  'З',
  'И',
  'Й',
  'К',
  'Л',
  'М',
  'Н',
  'О',
  'П',
  'Р',
  'С',
  'Т',
  'У',
  'Ф',
  'Х',
  'Ц',
  'Ч',
  'Ш',
  'Щ',
  'Ъ',
  'Ы',
  'Ь',
  'Э',
  'Ю',
  'Я',
  'а',
  'б',
  'в',
  'г',
  'д',
  'е',
  'ж',
  'з',
  'и',
  'й',
  'к',
  'л',
  'м',
  'н',
  'о',
  'п',
  'р',
  'с',
  'т',
  'у',
  'ф',
  'х',
  'ц',
  'ч',
  'ш',
  'щ',
  'ъ',
  'ы',
  'ь',
  'э',
  'ю',
  'я',
];

const CP1251_CHAR_TO_BYTE = new Map<string, number>(
  CP1251_DECODE_TABLE.map((character, index) => [character, index + 0x80]),
);

const UTF8_MOJIBAKE_MARKERS = /[РСЂЃЄЁІЇЈЉЊЋЌЏЎўјѕїћџ]|Ã|Â|Ð|Ñ/g;

const decodeUtf8Bytes = (bytes: number[]): string => {
  try {
    return decodeURIComponent(bytes.map((byte) => `%${byte.toString(16).padStart(2, '0')}`).join(''));
  } catch {
    return '';
  }
};

const scoreMojibake = (input: string): number => {
  const matches = input.match(UTF8_MOJIBAKE_MARKERS);
  return matches ? matches.length : 0;
};

const isLikelyMojibakeToken = (token: string): boolean => {
  const tokenScore = scoreMojibake(token);
  if (token.length < 4) {
    return false;
  }

  return tokenScore / token.length >= 0.35;
};

const decodeCp1251Mojibake = (input: string): string => {
  const bytes: number[] = [];

  for (const character of input) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) {
      continue;
    }

    if (codePoint < 0x80) {
      bytes.push(codePoint);
      continue;
    }

    const byte = CP1251_CHAR_TO_BYTE.get(character);
    if (byte === undefined) {
      return '';
    }

    bytes.push(byte);
  }

  return decodeUtf8Bytes(bytes);
};

export const decodeXmlEntities = (input: string): string => {
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
      default: {
        if (entity.startsWith('&#x')) {
          const value = Number.parseInt(entity.slice(3, -1), 16);
          return Number.isFinite(value) ? String.fromCodePoint(value) : entity;
        }

        if (entity.startsWith('&#')) {
          const value = Number.parseInt(entity.slice(2, -1), 10);
          return Number.isFinite(value) ? String.fromCodePoint(value) : entity;
        }

        return entity;
      }
    }
  });
};

export const repairMojibakeText = (input: string): string => {
  return input
    .replace(/\u0000/g, '')
    .replace(/\S+/g, (token) => {
      if (!isLikelyMojibakeToken(token)) {
        return token;
      }

      const repairedCp1251 = decodeCp1251Mojibake(token);
      if (repairedCp1251 && scoreMojibake(repairedCp1251) < scoreMojibake(token)) {
        return repairedCp1251;
      }

      return token;
    });
};

export const normalizeExtractedText = (input: string): string => {
  return repairMojibakeText(input)
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+\n/g, '\n')
    .replace(/\n[ \t\f\v]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const collapseWhitespace = (input: string): string => {
  return normalizeExtractedText(input).replace(/\s+/g, ' ').trim();
};

export const stripDiacritics = (input: string): string => {
  return input.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
};

export const normalizeSearchText = (input: string): string => {
  return stripDiacritics(collapseWhitespace(input)).toLowerCase();
};

export const uniqueStrings = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
};
