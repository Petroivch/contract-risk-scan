import { Module } from '@nestjs/common';
import { JobOrchestrationService } from '../common/job-orchestration/job-orchestration.service';
import { AnalysisEngineClient } from './analysis-engine.client';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

@Module({
  controllers: [ContractsController],
  providers: [ContractsService, JobOrchestrationService, AnalysisEngineClient]
})
export class ContractsModule {}