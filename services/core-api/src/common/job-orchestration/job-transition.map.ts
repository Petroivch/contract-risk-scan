import { JobStatus } from './job-status.enum';

export const JOB_STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  [JobStatus.Uploaded]: [JobStatus.Queued, JobStatus.Failed],
  [JobStatus.Queued]: [JobStatus.Preprocessing, JobStatus.Failed],
  [JobStatus.Preprocessing]: [JobStatus.Analyzing, JobStatus.Failed],
  [JobStatus.Analyzing]: [JobStatus.ReportReady, JobStatus.Failed],
  [JobStatus.ReportReady]: [JobStatus.Queued],
  [JobStatus.Failed]: [JobStatus.Queued]
};