export const MESSAGE_POLICY = {
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password',
  FILE_REQUIRED: 'file is required (multipart/form-data)',
  FILE_SIZE_LIMIT_EXCEEDED: 'Uploaded file exceeds configured size limit',
  FILE_MIME_TYPE_NOT_ALLOWED: 'Uploaded file MIME type is not allowed by server policy',
  ANALYSIS_IN_PROGRESS: 'Analysis already in progress',
  ANALYSIS_ALREADY_READY: 'Report already available. Use forceReanalyze=true to rebuild report.',
  ANALYSIS_COMPLETED_STUB: 'Analysis completed in sync-stub mode. Async workers will be integrated next.',
  ANALYSIS_FAILED_STUB: 'Analysis failed in stub pipeline',
  REPORT_NOT_READY: 'Report is not ready yet. Check status endpoint first.',
  UNKNOWN_ERROR: 'Unknown error'
} as const;