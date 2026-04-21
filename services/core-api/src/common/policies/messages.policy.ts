export const MESSAGE_POLICY = {
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password',
  FILE_REQUIRED: 'file is required (multipart/form-data)',
  FILE_SIZE_LIMIT_EXCEEDED: 'Uploaded file exceeds configured size limit',
  FILE_MIME_TYPE_NOT_ALLOWED: 'Uploaded file MIME type is not allowed by server policy',
  ANALYSIS_IN_PROGRESS: 'Analysis already in progress',
  ANALYSIS_ALREADY_READY: 'Report already available. Use forceReanalyze=true to rebuild report.',
  ANALYSIS_ACCEPTED: 'Analysis accepted and delegated to analysis-engine.',
  ANALYSIS_AUTO_STARTED: 'Contract uploaded and analysis started automatically.',
  ANALYSIS_FAILED: 'Analysis failed',
  ANALYSIS_ENGINE_NOT_AVAILABLE:
    'Analysis engine is unavailable. Check ANALYSIS_ENGINE_* configuration or service health.',
  ANALYSIS_TIMEOUT:
    'Analysis exceeded the configured polling window. Retry later or trigger reanalysis.',
  ANALYSIS_RESULT_MISSING: 'analysis-engine completed the job without a result payload',
  REPORT_NOT_READY: 'Report is not ready yet. Check status endpoint first.',
  UNKNOWN_ERROR: 'Unknown error'
} as const;
