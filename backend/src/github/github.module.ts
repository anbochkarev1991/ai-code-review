import { Module } from '@nestjs/common';
import { GitHubController } from './github.controller';

@Module({
  imports: [],
  controllers: [GitHubController],
  providers: [],
  exports: [],
})
export class GitHubModule {}
