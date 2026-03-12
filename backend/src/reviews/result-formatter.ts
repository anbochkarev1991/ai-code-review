import { Injectable } from '@nestjs/common';
import type {
  AgentStatus,
  CostEstimate,
  ExecutionMetadata,
  Finding,
  PRMetadata,
  ReviewResult,
  TraceStep,
} from 'shared';
import { MODEL_RATES } from 'shared';
import type { ReviewSummary } from '../types';

interface FormatResultParams {
  findings: Finding[];
  reviewSummary: ReviewSummary;
  trace: TraceStep[];
  prMetadata?: PRMetadata;
  model?: string;
}

/**
 * Result formatter — transforms internal aggregated data into the ReviewResult
 * structure consumed by the API layer and persisted in the database.
 *
 * This module has no business logic. It is a pure structural mapping layer
 * that also calculates execution telemetry (duration, tokens, cost).
 */
@Injectable()
export class ResultFormatter {
  format(params: FormatResultParams): ReviewResult {
    const { findings, reviewSummary, trace, prMetadata, model } = params;
    const executionMetadata = this.calculateExecutionMetadata(trace, model);

    return {
      findings,
      summary: reviewSummary.text,
      review_summary: reviewSummary,
      execution_metadata: executionMetadata,
      pr_metadata: prMetadata,
    };
  }

  private calculateExecutionMetadata(
    trace: TraceStep[],
    model?: string,
  ): ExecutionMetadata {
    const agentsStatus: Record<string, AgentStatus> = {};
    for (const step of trace) {
      agentsStatus[step.agent] = step.status;
    }

    if (trace.length === 0) {
      return {
        agent_count: 0,
        duration_ms: 0,
        total_tokens: 0,
        agents_status: agentsStatus,
      };
    }

    const successfulAgents = trace.filter((step) => step.status === 'ok');

    const firstStart = new Date(trace[0].started_at);
    const lastFinish = new Date(
      Math.max(...trace.map((step) => new Date(step.finished_at).getTime())),
    );
    const durationMs = lastFinish.getTime() - firstStart.getTime();

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;

    for (const step of trace) {
      if (step.status === 'ok') {
        totalTokens += step.tokens_used ?? 0;
        totalPromptTokens += step.prompt_tokens ?? 0;
        totalCompletionTokens += step.completion_tokens ?? 0;
      }
    }

    const costEstimate = this.estimateCost(
      totalPromptTokens,
      totalCompletionTokens,
      model,
    );

    return {
      agent_count: successfulAgents.length,
      duration_ms: durationMs,
      total_tokens: totalTokens,
      cost_estimate: costEstimate,
      agents_status: agentsStatus,
    };
  }

  /**
   * Cost estimation based on token counts and model rates.
   * Returns undefined if no tokens were tracked.
   */
  private estimateCost(
    promptTokens: number,
    completionTokens: number,
    model?: string,
  ): CostEstimate | undefined {
    if (promptTokens === 0 && completionTokens === 0) return undefined;

    const modelName = model ?? 'gpt-4o-mini';
    const rate = MODEL_RATES[modelName] ?? MODEL_RATES['gpt-4o-mini'];

    const totalUsd =
      promptTokens * rate.prompt + completionTokens * rate.completion;

    return {
      total_usd: Math.round(totalUsd * 10000) / 10000,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      model: modelName,
    };
  }
}
