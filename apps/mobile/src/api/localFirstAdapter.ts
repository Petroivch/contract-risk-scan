import type { ContractRiskScannerApi } from './types';

interface LocalFirstAdapterConfig {
  enableLocalFirst: boolean;
}

interface LegacyLocalStore {
  clearAll?(): Promise<void>;
}

export const createLocalFirstAdapter = (
  remoteClient: ContractRiskScannerApi,
  _localStore: LegacyLocalStore,
  _config: LocalFirstAdapterConfig,
): ContractRiskScannerApi => {
  return remoteClient;
};
