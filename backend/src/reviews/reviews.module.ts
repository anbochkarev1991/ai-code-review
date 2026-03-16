import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { GitHubModule } from '../github/github.module';
import { AiSummaryGeneratorService } from './ai-summary-generator.service';
import { AgentContextShaper } from './agent-context-shaper';
import { ArchitectureAgent } from './agents/architecture.agent';
import { CodeQualityAgent } from './agents/code-quality.agent';
import { PerformanceAgent } from './agents/performance.agent';
import { SecurityAgent } from './agents/security.agent';
import { ContextBuilder } from './context-builder';
import { DeterministicAggregator } from './deterministic-aggregator';
import { DiffParser } from './diff-parser';
import { FindingDeduplicatorService } from './finding-deduplicator.service';
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
    AiSummaryGeneratorService,
    ReviewsService,
    ReviewRunsRepository,
    DiffParser,
    FindingDeduplicatorService,
    ContextBuilder,
    AgentContextShaper,
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
