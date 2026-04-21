import { AuthTokenType } from '../domain/auth-token-type.enum';

export const AUTH_POLICY = {
  PASSWORD_MIN_LENGTH: 8,
  USER_ID_PREFIX: 'usr',
  TOKEN_TYPE_DEFAULT: AuthTokenType.Bearer,
  ACCESS_TOKEN_TTL_SECONDS_DEFAULT: 3600,
  JWT_EXPIRES_IN_DEFAULT: '1h',
  HASH_ALGORITHM: 'sha256'
} as const;