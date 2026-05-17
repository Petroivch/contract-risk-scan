import { Module } from '@nestjs/common';
import { JobOrchestrationService } from '../services/job-orchestration.service';
import { AnalysisEngineClient } from '../services/analysis-engine.client';
import { ContractsController } from './contracts.controller';
import { ContractsRepository } from '../repository/contracts.repository';
import { ContractsService } from '../services/contracts.service';

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
