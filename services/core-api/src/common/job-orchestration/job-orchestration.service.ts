import { BadRequestException, Injectable } from '@nestjs/common';
import { JOB_STATUS_TRANSITIONS } from './job-transition.map';
import { JobStatus } from './job-status.enum';

export interface AnalysisJobState {
  contractId: string;
  status: JobStatus;
  updatedAt: string;
  errorCode?: string;
  errorMessage?: string;
}

@Injectable()
export class JobOrchestrationService {
  getAllowedTransitions(currentStatus: JobStatus): JobStatus[] {
    return JOB_STATUS_TRANSITIONS[currentStatus] ?? [];
  }

  canTransition(from: JobStatus, to: JobStatus): boolean {
    return this.getAllowedTransitions(from).includes(to);
  }

  transition(job: AnalysisJobState, nextStatus: JobStatus): AnalysisJobState {
    if (!this.canTransition(job.status, nextStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${job.status} -> ${nextStatus}`
      );
    }

    return {
      ...job,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      ...(nextStatus !== JobStatus.Failed ? { errorCode: undefined, errorMessage: undefined } : {})
    };
  }
}