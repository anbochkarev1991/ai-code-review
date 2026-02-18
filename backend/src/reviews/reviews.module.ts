import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { CodeQualityAgent } from './agents/code-quality.agent';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [BillingModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, CodeQualityAgent],
  exports: [ReviewsService, CodeQualityAgent],
})
export class ReviewsModule {}
