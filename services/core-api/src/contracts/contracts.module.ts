import { Module } from '@nestjs/common';
import { JobOrchestrationService } from '../common/job-orchestration/job-orchestration.service';
import { AnalysisEngineClient } from './analysis-engine.client';
import { ContractsController } from './contracts.controller';
import { ContractsRepository } from './contracts.repository';
import { ContractsService } from './contracts.service';

@Module({
  controllers: [ContractsController],
  providers: [
    ContractsService,
    ContractsRepository,
    JobOrchestrationService,
    AnalysisEngineClient
  ]
})
export class ContractsModule {}
