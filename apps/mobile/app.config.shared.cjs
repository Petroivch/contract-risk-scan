const ENV_ALIASES = {
  API_BASE_URL: ['EXPO_PUBLIC_API_BASE_URL'],
  API_TRANSPORT: ['EXPO_PUBLIC_API_TRANSPORT'],
  API_TIMEOUT_MS: ['EXPO_PUBLIC_API_TIMEOUT_MS'],
  STATUS_POLL_INTERVAL_MS: ['EXPO_PUBLIC_STATUS_POLL_INTERVAL_MS'],
  ENABLE_LOCAL_FIRST_CACHE: ['EXPO_PUBLIC_ENABLE_LOCAL_FIRST_CACHE'],
  ENABLE_SQLITE_CACHE: ['EXPO_PUBLIC_ENABLE_SQLITE_CACHE'],
  ENABLE_FILE_CACHE: ['EXPO_PUBLIC_ENABLE_FILE_CACHE'],
  SUPPORTED_LANGUAGES: ['EXPO_PUBLIC_SUPPORTED_LANGUAGES'],
  DEFAULT_LANGUAGE: ['EXPO_PUBLIC_DEFAULT_LANGUAGE'],
  ROLE_PRESETS: ['EXPO_PUBLIC_ROLE_PRESETS'],
  MAX_UPLOAD_FILE_MB: ['EXPO_PUBLIC_MAX_UPLOAD_FILE_MB'],
  SQLITE_DB_NAME: ['EXPO_PUBLIC_SQLITE_DB_NAME'],
  FILE_CACHE_DIR: ['EXPO_PUBLIC_FILE_CACHE_DIR'],
  LANGUAGE_PREFERENCE_KEY: ['EXPO_PUBLIC_LANGUAGE_PREFERENCE_KEY'],
  STUB_CONTRACT_FILENAME: ['EXPO_PUBLIC_STUB_CONTRACT_FILENAME'],
};

const DEFAULT_EXTRA = {
  API_BASE_URL: '',
  API_TRANSPORT: 'http',
  API_TIMEOUT_MS: 15000,
  STATUS_POLL_INTERVAL_MS: 2000,
  ENABLE_LOCAL_FIRST_CACHE: false,
  ENABLE_SQLITE_CACHE: false,
  ENABLE_FILE_CACHE: false,
  SUPPORTED_LANGUAGES: 'ru,en,it,fr',
  DEFAULT_LANGUAGE: 'ru',
  ROLE_PRESETS: 'roles.performer,roles.employer,roles.customer,roles.contractor',
  MAX_UPLOAD_FILE_MB: 18,
  SQLITE_DB_NAME: 'contract-risk-scanner.db',
  FILE_CACHE_DIR: 'contract-file-cache',
  LANGUAGE_PREFERENCE_KEY: 'contract-risk-scanner.language',
  STUB_CONTRACT_FILENAME: 'service-agreement-draft.pdf',
};

const readEnv = (key) => {
  const candidates = [key, ...(ENV_ALIASES[key] ?? [])];

  for (const candidate of candidates) {
    const value = process.env[candidate];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
};

const readStringEnv = (key, fallback) => readEnv(key) ?? fallback;

const readNumberEnv = (key, fallback) => {
  const value = readEnv(key);

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readBooleanEnv = (key, fallback) => {
  const value = readEnv(key);

  if (!value) {
    return fallback;
  }

  const normalized = value.toLowerCase();

  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }

  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }

  return fallback;
};

const isTruthyEnv = (value) => {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const isExplicitOfflineLocalBuild = () =>
  isTruthyEnv(readEnv('CONTRACT_RISK_OFFLINE_LOCAL_BUILD')) ||
  isTruthyEnv(readEnv('EXPO_PUBLIC_CONTRACT_RISK_OFFLINE_LOCAL_BUILD'));

const normalizeTransport = (value) => String(value ?? '').trim().toLowerCase();

const validateRuntimeExtra = (extra) => {
  const transport = normalizeTransport(extra.API_TRANSPORT);
  const baseUrl = String(extra.API_BASE_URL ?? '').trim();

  if (transport === 'http' && !baseUrl) {
    throw new Error(
      'Invalid mobile runtime config: API_TRANSPORT=http requires API_BASE_URL. Set API_BASE_URL for backend analysis or set API_TRANSPORT=local for an explicitly offline-local build.',
    );
  }
};

const resolveRuntimeExtra = () => ({
  API_BASE_URL: readStringEnv('API_BASE_URL', DEFAULT_EXTRA.API_BASE_URL),
  API_TRANSPORT:
    readEnv('API_TRANSPORT') ??
    (isExplicitOfflineLocalBuild() && !readEnv('API_BASE_URL') ? 'local' : DEFAULT_EXTRA.API_TRANSPORT),
  API_TIMEOUT_MS: readNumberEnv('API_TIMEOUT_MS', DEFAULT_EXTRA.API_TIMEOUT_MS),
  STATUS_POLL_INTERVAL_MS: readNumberEnv(
    'STATUS_POLL_INTERVAL_MS',
    DEFAULT_EXTRA.STATUS_POLL_INTERVAL_MS,
  ),
  ENABLE_LOCAL_FIRST_CACHE: readBooleanEnv(
    'ENABLE_LOCAL_FIRST_CACHE',
    DEFAULT_EXTRA.ENABLE_LOCAL_FIRST_CACHE,
  ),
  ENABLE_SQLITE_CACHE: readBooleanEnv('ENABLE_SQLITE_CACHE', DEFAULT_EXTRA.ENABLE_SQLITE_CACHE),
  ENABLE_FILE_CACHE: readBooleanEnv('ENABLE_FILE_CACHE', DEFAULT_EXTRA.ENABLE_FILE_CACHE),
  SUPPORTED_LANGUAGES: readStringEnv('SUPPORTED_LANGUAGES', DEFAULT_EXTRA.SUPPORTED_LANGUAGES),
  DEFAULT_LANGUAGE: readStringEnv('DEFAULT_LANGUAGE', DEFAULT_EXTRA.DEFAULT_LANGUAGE),
  ROLE_PRESETS: readStringEnv('ROLE_PRESETS', DEFAULT_EXTRA.ROLE_PRESETS),
  MAX_UPLOAD_FILE_MB: readNumberEnv('MAX_UPLOAD_FILE_MB', DEFAULT_EXTRA.MAX_UPLOAD_FILE_MB),
  SQLITE_DB_NAME: readStringEnv('SQLITE_DB_NAME', DEFAULT_EXTRA.SQLITE_DB_NAME),
  FILE_CACHE_DIR: readStringEnv('FILE_CACHE_DIR', DEFAULT_EXTRA.FILE_CACHE_DIR),
  LANGUAGE_PREFERENCE_KEY: readStringEnv(
    'LANGUAGE_PREFERENCE_KEY',
    DEFAULT_EXTRA.LANGUAGE_PREFERENCE_KEY,
  ),
  STUB_CONTRACT_FILENAME: readStringEnv(
    'STUB_CONTRACT_FILENAME',
    DEFAULT_EXTRA.STUB_CONTRACT_FILENAME,
  ),
});

const buildExpoConfig = (config = {}) => {
  const extra = {
    ...(config.extra ?? {}),
    ...resolveRuntimeExtra(),
  };

  validateRuntimeExtra(extra);

  return {
    ...config,
    name: 'Contract Risk Scanner',
    slug: 'contract-risk-scanner-mobile',
    version: '0.1.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    icon: './assets/icon.png',
    assetBundlePatterns: ['**/*'],
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#0D2236',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.contractriskscanner.mobile',
      buildNumber: '1',
    },
    android: {
      package: 'com.contractriskscanner.mobile',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon-foreground.png',
        backgroundColor: '#0D2236',
      },
    },
    extra,
  };
};

module.exports = {
  DEFAULT_EXTRA,
  buildExpoConfig,
  resolveRuntimeExtra,
  validateRuntimeExtra,
};
