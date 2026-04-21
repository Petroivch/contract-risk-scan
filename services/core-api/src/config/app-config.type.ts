import { AuthTokenType } from '../common/domain/auth-token-type.enum';

export interface AppConfig {
  nodeEnv: string;
  http: {
    port: number;
    apiPrefix: string;
    publicBaseUrl: string;
  };
  swagger: {
    enabled: boolean;
    path: string;
    title: string;
    description: string;
    version: string;
  };
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
    tokenType: AuthTokenType;
    accessTokenTtlSeconds: number;
  };
  uploads: {
    maxUploadSizeMb: number;
    allowedMimeTypes: string[];
  };
}