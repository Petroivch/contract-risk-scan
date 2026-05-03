import Constants from 'expo-constants';

type RuntimeValue = string | number | boolean | undefined;

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, RuntimeValue>;

const resolveKeys = (key: string): string[] => [key, `EXPO_PUBLIC_${key}`];

const fromProcess = (keys: string[]): string | undefined => {
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;

  for (const key of keys) {
    const value = processEnv?.[key];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
};

const fromExtra = (keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = extra[key];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
  }

  return undefined;
};

const readRaw = (key: string): string | undefined => {
  const keys = resolveKeys(key);
  return fromProcess(keys) ?? fromExtra(keys);
};

export const readString = (key: string, fallback: string): string => {
  return readRaw(key) ?? fallback;
};

export const readNumber = (key: string, fallback: number): number => {
  const raw = readRaw(key);
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
};

export const readBoolean = (key: string, fallback: boolean): boolean => {
  const raw = readRaw(key);
  if (!raw) {
    return fallback;
  }

  const normalized = raw.toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }

  return fallback;
};

export const readCsv = (key: string, fallback: string[]): string[] => {
  const raw = readRaw(key);
  if (!raw) {
    return fallback;
  }

  const parsed = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return parsed.length > 0 ? parsed : fallback;
};
