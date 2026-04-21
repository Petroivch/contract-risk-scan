export const ANALYSIS_ENGINE_POLICY = {
  ENABLED_DEFAULT: true,
  BASE_URL_DEFAULT: 'http://127.0.0.1:8010',
  REQUEST_TIMEOUT_MS_DEFAULT: 15000,
  POLL_INTERVAL_MS_DEFAULT: 2000,
  MAX_POLLING_DURATION_MS_DEFAULT: 120000,
  RUN_PATH: '/analysis/run',
  STATUS_PATH: (jobId: string): string => `/analysis/${jobId}/status`,
  RESULT_PATH: (jobId: string): string => `/analysis/${jobId}/result`
} as const;
