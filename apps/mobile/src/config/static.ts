export const SUPPORTED_LANGUAGES = ['ru', 'en', 'it', 'fr'] as const;
export const DEFAULT_LANGUAGE = 'ru' as const;

export const DEFAULT_ROLE_PRESET_KEYS = ['roles.performer', 'roles.employer', 'roles.customer', 'roles.contractor'];

export const CONFIG_DEFAULTS = {
  apiBaseUrl: 'http://localhost:3000/api/v1',
  apiTransport: 'stub',
  apiTimeoutMs: 15000,
  statusPollIntervalMs: 2000,
  maxUploadFileMb: 25,
  totalReleaseBudgetMb: 228,
  mobileBudgetShareMb: 120,
  sqliteDbName: 'contract-risk-scanner.db',
  fileCacheDir: 'contract-file-cache',
  languagePreferenceKey: 'contract-risk-scanner.language',
  demoEmail: 'demo@company.com',
  demoPassword: 'password',
  stubContractFileName: 'service-agreement-draft.pdf',
} as const;
