import { Injectable } from '@nestjs/common';
import type {
  ExecutionMetadata,
  Finding,
  ReviewResult,
  TraceStep,
} from 'shared';
import type { ReviewSummary } from '../types';

interface FormatResultParams {
  findings: Finding[];
  reviewSummary: ReviewSummary;
  trace: TraceStep[];
}

@Injectable()
export class ResultFormatter {
  format(params: FormatResultParams): ReviewResult {
    const { findings, reviewSummary, trace } = params;
    const executionMetadata = this.calculateExecutionMetadata(trace);

    return {
      findings,
      summary: reviewSummary.text,
      review_summary: reviewSummary,
      execution_metadata: executionMetadata,
    };
  }

  private calculateExecutionMetadata(trace: TraceStep[]): ExecutionMetadata {
    if (trace.length === 0) {
      return { agent_count: 0, duration_ms: 0, total_tokens: 0 };
    }

    const successfulAgents = trace.filter((step) => step.status === 'ok');

    const firstStart = new Date(trace[0].started_at);
    const lastFinish = new Date(
      Math.max(...trace.map((step) => new Date(step.finished_at).getTime())),
    );
    const durationMs = lastFinish.getTime() - firstStart.getTime();

    const totalTokens = trace
      .filter((step) => step.status === 'ok' && step.tokens_used !== undefined)
      .reduce((sum, step) => sum + (step.tokens_used ?? 0), 0);

    return {
      agent_count: successfulAgents.length,
      duration_ms: durationMs,
      total_tokens: totalTokens,
    };
  }
}
