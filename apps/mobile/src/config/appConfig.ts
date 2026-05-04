import {
  CONFIG_DEFAULTS,
  DEFAULT_LANGUAGE,
  DEFAULT_ROLE_PRESET_KEYS,
  SUPPORTED_LANGUAGES,
} from './static';
import { readBoolean, readCsv, readNumber, readString } from './runtime';

export type ApiTransport = 'local' | 'stub' | 'http';

const apiBaseUrl = readString('API_BASE_URL', CONFIG_DEFAULTS.apiBaseUrl);
const configuredApiTransport = readString(
  'API_TRANSPORT',
  CONFIG_DEFAULTS.apiTransport,
) as ApiTransport;

export const getApiConfigurationError = (): string | undefined => {
  if (configuredApiTransport === 'http' && apiBaseUrl.trim().length === 0) {
    return 'Backend analysis is configured, but API_BASE_URL is empty. Set API_BASE_URL for HTTP transport or rebuild with API_TRANSPORT=local for an explicit offline-local app.';
  }

  return undefined;
};

export const appConfig = {
  i18n: {
    defaultLanguage: readString('DEFAULT_LANGUAGE', DEFAULT_LANGUAGE),
    supportedLanguages: readCsv('SUPPORTED_LANGUAGES', [...SUPPORTED_LANGUAGES]),
    fallbackLanguage: DEFAULT_LANGUAGE,
  },
  api: {
    baseUrl: apiBaseUrl,
    transport: configuredApiTransport,
    effectiveTransport: configuredApiTransport,
    configurationError: getApiConfigurationError(),
    timeoutMs: readNumber('API_TIMEOUT_MS', CONFIG_DEFAULTS.apiTimeoutMs),
    statusPollIntervalMs: readNumber(
      'STATUS_POLL_INTERVAL_MS',
      CONFIG_DEFAULTS.statusPollIntervalMs,
    ),
  },
  limits: {
    maxUploadFileMb: readNumber('MAX_UPLOAD_FILE_MB', CONFIG_DEFAULTS.maxUploadFileMb),
  },
  roles: {
    presetTranslationKeys: readCsv('ROLE_PRESETS', [...DEFAULT_ROLE_PRESET_KEYS]),
  },
  localStorage: {
    sqliteDbName: readString('SQLITE_DB_NAME', CONFIG_DEFAULTS.sqliteDbName),
    fileCacheDir: readString('FILE_CACHE_DIR', CONFIG_DEFAULTS.fileCacheDir),
    languagePreferenceKey: readString(
      'LANGUAGE_PREFERENCE_KEY',
      CONFIG_DEFAULTS.languagePreferenceKey,
    ),
    policyConsentKey: readString('POLICY_CONSENT_KEY', CONFIG_DEFAULTS.policyConsentKey),
  },
  featureFlags: {
    enableLocalFirstCache: readBoolean('ENABLE_LOCAL_FIRST_CACHE', false),
    enableSQLiteCache: readBoolean('ENABLE_SQLITE_CACHE', false),
    enableFileCache: readBoolean('ENABLE_FILE_CACHE', false),
  },
  compliance: {
    policyConsentVersion: readString(
      'POLICY_CONSENT_VERSION',
      CONFIG_DEFAULTS.policyConsentVersion,
    ),
  },
  defaults: {
    stubContractFileName: readString(
      'STUB_CONTRACT_FILENAME',
      CONFIG_DEFAULTS.stubContractFileName,
    ),
  },
} as const;
