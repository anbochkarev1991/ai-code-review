import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { GitHubModule } from '../github/github.module';
import { ArchitectureAgent } from './agents/architecture.agent';
import { CodeQualityAgent } from './agents/code-quality.agent';
import { PerformanceAgent } from './agents/performance.agent';
import { SecurityAgent } from './agents/security.agent';
import { DiffParser } from './diff-parser';
import { DeterministicAggregator } from './deterministic-aggregator';
import { FindingNormalizer } from './finding-normalizer';
import { RiskEngine } from './risk-engine';
import { ResultFormatter } from './result-formatter';
import { ReviewOrchestrator } from './engine/orchestrator';
import { ReviewRunsRepository } from './review-runs.repository';
import { IssueGeneratorService } from './issue-generator.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { SeverityNormalizer } from './severity-normalizer';

@Module({
  imports: [BillingModule, GitHubModule],
  controllers: [ReviewsController],
  providers: [
    ReviewsService,
    ReviewRunsRepository,
    DiffParser,
    FindingNormalizer,
    RiskEngine,
    DeterministicAggregator,
    ResultFormatter,
    ReviewOrchestrator,
    CodeQualityAgent,
    ArchitectureAgent,
    PerformanceAgent,
    SecurityAgent,
    SeverityNormalizer,
    IssueGeneratorService,
  ],
  exports: [
    ReviewsService,
    ReviewOrchestrator,
    CodeQualityAgent,
    ArchitectureAgent,
    PerformanceAgent,
    SecurityAgent,
  ],
})
export class ReviewsModule {}
