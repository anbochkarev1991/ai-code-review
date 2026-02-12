import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health';
import { AuthModule } from './auth';
import { GitHubModule } from './github';
import { BillingModule } from './billing';
import { ReviewsModule } from './reviews';

@Module({
  imports: [AuthModule, GitHubModule, BillingModule, ReviewsModule],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
