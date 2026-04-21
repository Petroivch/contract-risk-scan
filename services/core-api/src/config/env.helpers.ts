export function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new Error(`Invalid boolean value: '${value}'`);
}

export function parseNumberEnv(value: string | undefined, fallback: number, key: string): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${key}: '${value}'`);
  }

  return parsed;
}

export function parseListEnv(value: string | undefined, fallback: readonly string[]): string[] {
  if (value === undefined || value.trim() === '') {
    return [...fallback];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function requireEnv(value: string | undefined, key: string): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value.trim();
}

export function parseEnumEnv<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
  key: string
): T {
  if (!value || value.trim() === '') {
    return fallback;
  }

  const normalized = value.trim() as T;
  if (!allowed.includes(normalized)) {
    throw new Error(`Invalid value for ${key}: '${value}'. Allowed: ${allowed.join(', ')}`);
  }

  return normalized;
}