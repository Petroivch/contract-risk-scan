export const CONTRACT_POLICY = {
  CONTRACT_ID_PREFIX: 'ctr',
  ROLE_MIN_LENGTH: 2,
  ROLE_MAX_LENGTH: 64,
  COUNTERPARTY_ROLE_MAX_LENGTH: 64,
  CONTRACT_LABEL_MAX_LENGTH: 120,
  FOCUS_NOTES_MAX_LENGTH: 500,
  FILE_FORM_FIELD_NAME: 'file',
  DEFAULT_COUNTERPARTY_LABEL: 'counterparty',
  ANALYSIS_ERROR_CODE: 'ANALYSIS_PIPELINE_ERROR',
  BYTES_IN_MB: 1024 * 1024
} as const;

export function buildContractStatusPath(contractId: string): string {
  return `/contracts/${contractId}/status`;
}