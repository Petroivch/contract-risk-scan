import { AuthTokenType } from '../common/domain/auth-token-type.enum';
import { ANALYSIS_ENGINE_POLICY } from '../common/policies/analysis-engine.policy';
import { AUTH_POLICY } from '../common/policies/auth.policy';
import { HTTP_POLICY } from '../common/policies/http.policy';
import { STORAGE_POLICY } from '../common/policies/storage.policy';
import { UPLOAD_POLICY } from '../common/policies/upload.policy';
import { AppConfig } from './app-config.type';
import {
  parseBooleanEnv,
  parseEnumEnv,
  parseListEnv,
  parseNumberEnv,
  requireEnv
} from './env.helpers';

export default (): AppConfig => {
  const jwtSecret = requireEnv(process.env.JWT_SECRET, 'JWT_SECRET');

  if (jwtSecret === 'replace-with-long-random-secret') {
    throw new Error('JWT_SECRET uses placeholder value. Provide a secure secret for runtime.');
  }

  const tokenType = parseEnumEnv(
    process.env.TOKEN_TYPE,
    Object.values(AuthTokenType),
    AUTH_POLICY.TOKEN_TYPE_DEFAULT,
    'TOKEN_TYPE'
  );

  return {
    nodeEnv: process.env.NODE_ENV ?? HTTP_POLICY.NODE_ENV_DEFAULT,
    http: {
      port: parseNumberEnv(process.env.PORT, HTTP_POLICY.PORT_DEFAULT, 'PORT'),
      apiPrefix: process.env.API_PREFIX ?? HTTP_POLICY.API_PREFIX_DEFAULT,
      publicBaseUrl: process.env.PUBLIC_BASE_URL ?? HTTP_POLICY.PUBLIC_BASE_URL_DEFAULT
    },
    swagger: {
      enabled: parseBooleanEnv(process.env.SWAGGER_ENABLED, HTTP_POLICY.SWAGGER_ENABLED_DEFAULT),
      path: process.env.SWAGGER_PATH ?? HTTP_POLICY.SWAGGER_PATH_DEFAULT,
      title: process.env.SWAGGER_TITLE ?? HTTP_POLICY.SWAGGER_TITLE_DEFAULT,
      description: process.env.SWAGGER_DESCRIPTION ?? HTTP_POLICY.SWAGGER_DESCRIPTION_DEFAULT,
      version: process.env.SWAGGER_VERSION ?? HTTP_POLICY.SWAGGER_VERSION_DEFAULT
    },
    auth: {
      jwtSecret,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? AUTH_POLICY.JWT_EXPIRES_IN_DEFAULT,
      tokenType,
      accessTokenTtlSeconds: parseNumberEnv(
        process.env.ACCESS_TOKEN_TTL_SECONDS,
        AUTH_POLICY.ACCESS_TOKEN_TTL_SECONDS_DEFAULT,
        'ACCESS_TOKEN_TTL_SECONDS'
      )
    },
    uploads: {
      maxUploadSizeMb: parseNumberEnv(
        process.env.MAX_UPLOAD_SIZE_MB,
        UPLOAD_POLICY.MAX_UPLOAD_SIZE_MB_DEFAULT,
        'MAX_UPLOAD_SIZE_MB'
      ),
      allowedMimeTypes: parseListEnv(
        process.env.ALLOWED_MIME_TYPES,
        UPLOAD_POLICY.ALLOWED_MIME_TYPES_DEFAULT
      )
    },
    storage: {
      dataDir: process.env.DATA_DIR?.trim() || STORAGE_POLICY.DATA_DIR_DEFAULT
    },
    analysisEngine: {
      enabled: parseBooleanEnv(
        process.env.ANALYSIS_ENGINE_ENABLED,
        ANALYSIS_ENGINE_POLICY.ENABLED_DEFAULT
      ),
      baseUrl:
        process.env.ANALYSIS_ENGINE_BASE_URL?.trim() ||
        ANALYSIS_ENGINE_POLICY.BASE_URL_DEFAULT,
      requestTimeoutMs: parseNumberEnv(
        process.env.ANALYSIS_ENGINE_REQUEST_TIMEOUT_MS,
        ANALYSIS_ENGINE_POLICY.REQUEST_TIMEOUT_MS_DEFAULT,
        'ANALYSIS_ENGINE_REQUEST_TIMEOUT_MS'
      ),
      pollIntervalMs: parseNumberEnv(
        process.env.ANALYSIS_ENGINE_POLL_INTERVAL_MS,
        ANALYSIS_ENGINE_POLICY.POLL_INTERVAL_MS_DEFAULT,
        'ANALYSIS_ENGINE_POLL_INTERVAL_MS'
      ),
      maxPollingDurationMs: parseNumberEnv(
        process.env.ANALYSIS_ENGINE_MAX_POLLING_DURATION_MS,
        ANALYSIS_ENGINE_POLICY.MAX_POLLING_DURATION_MS_DEFAULT,
        'ANALYSIS_ENGINE_MAX_POLLING_DURATION_MS'
      )
    }
  };
};
