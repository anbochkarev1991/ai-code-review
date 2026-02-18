import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { AggregatorAgent } from './agents/aggregator.agent';
import { ArchitectureAgent } from './agents/architecture.agent';
import { CodeQualityAgent } from './agents/code-quality.agent';
import { PerformanceAgent } from './agents/performance.agent';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [BillingModule],
  controllers: [ReviewsController],
  providers: [
    ReviewsService,
    CodeQualityAgent,
    ArchitectureAgent,
    PerformanceAgent,
    AggregatorAgent,
  ],
  exports: [
    ReviewsService,
    CodeQualityAgent,
    ArchitectureAgent,
    PerformanceAgent,
    AggregatorAgent,
  ],
})
export class ReviewsModule {}
