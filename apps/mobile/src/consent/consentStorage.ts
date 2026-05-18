import AsyncStorage from '@react-native-async-storage/async-storage';

import { appConfig, getEffectiveApiTransport, type ApiTransport } from '../config/appConfig';

export interface ConsentRecord {
  version: string;
  acceptedAt: string;
  transport: ApiTransport;
  locale: string;
}

interface ConsentSnapshot {
  version: string;
  transport: ApiTransport;
}

const isApiTransport = (value: unknown): value is ApiTransport => {
  return value === 'local' || value === 'stub' || value === 'http';
};

const isConsentRecord = (value: unknown): value is ConsentRecord => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ConsentRecord>;
  return (
    typeof candidate.version === 'string' &&
    typeof candidate.acceptedAt === 'string' &&
    typeof candidate.locale === 'string' &&
    isApiTransport(candidate.transport)
  );
};

export const getConsentSnapshot = (): ConsentSnapshot => ({
  version: appConfig.compliance.policyConsentVersion,
  transport: getEffectiveApiTransport(),
});

export const readConsentRecord = async (): Promise<ConsentRecord | null> => {
  const raw = await AsyncStorage.getItem(appConfig.localStorage.policyConsentKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isConsentRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const saveConsentRecord = async (input: {
  locale: string;
  acceptedAt?: string;
  version?: string;
  transport?: ApiTransport;
}): Promise<ConsentRecord> => {
  const snapshot = getConsentSnapshot();
  const record: ConsentRecord = {
    version: input.version ?? snapshot.version,
    acceptedAt: input.acceptedAt ?? new Date().toISOString(),
    transport: input.transport ?? snapshot.transport,
    locale: input.locale,
  };

  await AsyncStorage.setItem(appConfig.localStorage.policyConsentKey, JSON.stringify(record));
  return record;
};

export const clearConsentRecord = async (): Promise<void> => {
  await AsyncStorage.removeItem(appConfig.localStorage.policyConsentKey);
};

export const isCurrentConsentRecord = (
  record: ConsentRecord | null,
  snapshot: ConsentSnapshot = getConsentSnapshot(),
): boolean => {
  return Boolean(
    record && record.version === snapshot.version && record.transport === snapshot.transport,
  );
};


