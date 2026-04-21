export const HTTP_POLICY = {
  NODE_ENV_DEFAULT: 'development',
  PORT_DEFAULT: 3000,
  API_PREFIX_DEFAULT: 'api/v1',
  PUBLIC_BASE_URL_DEFAULT: 'https://api.contract-risk-scanner.local',
  SWAGGER_ENABLED_DEFAULT: true,
  SWAGGER_PATH_DEFAULT: 'api/docs',
  SWAGGER_TITLE_DEFAULT: 'Contract Risk Scanner Core API',
  SWAGGER_DESCRIPTION_DEFAULT: 'MVP API for auth, contract upload and risk report retrieval',
  SWAGGER_VERSION_DEFAULT: '0.3.0'
} as const;