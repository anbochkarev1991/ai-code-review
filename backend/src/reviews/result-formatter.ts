import { Injectable } from '@nestjs/common';
import type {
  ExecutionMetadata,
  Finding,
  PRMetadata,
  ReviewResult,
  TraceStep,
} from 'shared';
import type { ReviewSummary } from '../types';

interface FormatResultParams {
  findings: Finding[];
  reviewSummary: ReviewSummary;
  trace: TraceStep[];
  prMetadata?: PRMetadata;
}

/**
 * Result formatter — transforms internal aggregated data into the ReviewResult
 * structure consumed by the API layer and persisted in the database.
 *
 * This module has no business logic. It is a pure structural mapping layer.
 * Agents do not know about this format; the aggregator produces normalized
 * internal structures that are mapped here to the API contract.
 */
@Injectable()
export class ResultFormatter {
  format(params: FormatResultParams): ReviewResult {
    const { findings, reviewSummary, trace, prMetadata } = params;
    const executionMetadata = this.calculateExecutionMetadata(trace);

    return {
      findings,
      summary: reviewSummary.text,
      review_summary: reviewSummary,
      execution_metadata: executionMetadata,
      pr_metadata: prMetadata,
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
