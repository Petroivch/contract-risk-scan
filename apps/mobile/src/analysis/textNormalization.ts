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
  '',
  '™',
  'љ',
  '›',
  'њ',
  'ќ',
  'ћ',
  'џ',
  ' ',
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
  '­',
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

const SHORT_MOJIBAKE_TOKEN_FIXES: Record<string, string> = {
  'Р В°': 'Р°',
  'Р С’': 'Рђ',
  'Р Р†': 'РІ',
  'Р вЂ™': 'Р’',
  'Р С‘': 'Рё',
  'Р В': 'Р',
  'РЎРѓ': 'СЃ',
  'Р РЋ': 'РЎ',
  'Р С”': 'Рє',
  'Р С™': 'Рљ',
  'Р С•': 'Рѕ',
  'Р С›': 'Рћ',
  'РЎС“': 'Сѓ',
  'Р Р€': 'РЈ',
};

const UTF8_MOJIBAKE_MARKERS = /[Р РЎР‚РѓР„РЃР†Р‡Р€Р‰РЉР‹РЊРЏРЋСћСС•С—С›Сџ]|Гѓ|Г‚|Гђ|Г‘/g;

const SPACED_LETTERS_PATTERN =
  /(^|[^A-Za-zА-Яа-яЁёÀ-ÖØ-öø-ÿ])((?:[A-Za-zА-Яа-яЁёÀ-ÖØ-öø-ÿ]\s+){3,}[A-Za-zА-Яа-яЁёÀ-ÖØ-öø-ÿ])(?=[^A-Za-zА-Яа-яЁёÀ-ÖØ-öø-ÿ]|$)/gu;
const NON_NEWLINE_CONTROL_CHARS_PATTERN = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200D\u2060\uFEFF]/g;
const LINE_WRAP_HYPHEN_PATTERN =
  /([0-9A-Za-zА-Яа-яЁёÀ-ÖØ-öø-ÿ])(?:[\u00AD\u2010\u2011-])[ \t]*\n[ \t]*(?=[0-9A-Za-zА-Яа-яЁёÀ-ÖØ-öø-ÿ])/gu;
const SOFT_LINE_BREAK_PATTERN =
  /([0-9A-Za-zА-Яа-яЁёÀ-ÖØ-öø-ÿ])\n(?=[0-9a-zа-яёß-öø-ÿ][0-9A-Za-zА-Яа-яЁёÀ-ÖØ-öø-ÿ]{1,})/gu;

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
      if (SHORT_MOJIBAKE_TOKEN_FIXES[token]) {
        return SHORT_MOJIBAKE_TOKEN_FIXES[token];
      }

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

const stripControlCharacters = (input: string): string => {
  return input.replace(NON_NEWLINE_CONTROL_CHARS_PATTERN, '');
};

const repairBrokenWords = (input: string): string => {
  return input
    .replace(SPACED_LETTERS_PATTERN, (_match, prefix: string, letters: string) =>
      `${prefix}${letters.replace(/\s+/g, '')}`,
    )
    .replace(LINE_WRAP_HYPHEN_PATTERN, '$1')
    .replace(SOFT_LINE_BREAK_PATTERN, '$1 ');
};

export const normalizeExtractedText = (input: string): string => {
  return repairBrokenWords(stripControlCharacters(repairMojibakeText(input)))
    .replace(/\u00a0/g, ' ')
    .replace(/\u00ad/g, '')
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
  const normalized =
    typeof input.normalize === 'function' ? input.normalize('NFKD') : input;
  return normalized.replace(/[\u0300-\u036f]/g, '');
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


