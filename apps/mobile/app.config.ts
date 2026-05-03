import type { ConfigContext, ExpoConfig } from 'expo/config';

const { buildExpoConfig } = require('./app.config.shared.cjs') as {
  buildExpoConfig: (config?: ExpoConfig) => ExpoConfig;
};

export default ({ config }: ConfigContext): ExpoConfig => buildExpoConfig(config);
