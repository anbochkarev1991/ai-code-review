import { type TraceStep, truncateRawOutputForTrace } from 'shared';

/**
 * Agent names for trace steps. Order: Code Quality, Architecture, Performance, Security.
 * Aggregation is now deterministic and not traced as an LLM step.
 */
export const TRACE_AGENT_NAMES = [
  'Code Quality',
  'Architecture',
  'Performance',
  'Security',
] as const;

export type TraceAgentName = (typeof TRACE_AGENT_NAMES)[number];

export interface BuildTraceStepOptions {
  agent: string;
  startedAt: Date;
  finishedAt: Date;
  status: 'ok' | 'timeout' | 'error';
  tokensUsed?: number;
  promptTokens?: number;
  completionTokens?: number;
  promptSizeChars?: number;
  parallel: boolean;
  errorMessage?: string;
  findingCount?: number;
  avgConfidence?: number;
  rawOutput?: string;
}

/**
 * Builds an enriched trace step for pipeline recording.
 * Includes latency, token breakdown, prompt size, and per-agent finding statistics.
 */
export function buildTraceStep(options: BuildTraceStepOptions): TraceStep {
  const {
    agent,
    startedAt,
    finishedAt,
    status,
    tokensUsed,
    promptTokens,
    completionTokens,
    promptSizeChars,
    parallel,
    errorMessage,
    findingCount,
    avgConfidence,
    rawOutput,
  } = options;

  const durationMs = finishedAt.getTime() - startedAt.getTime();

  const step: TraceStep = {
    agent,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: durationMs,
    parallel,
    status,
  };

  if (tokensUsed !== undefined) {
    step.tokens_used = tokensUsed;
  }
  if (promptTokens !== undefined) {
    step.prompt_tokens = promptTokens;
  }
  if (completionTokens !== undefined) {
    step.completion_tokens = completionTokens;
  }
  if (promptSizeChars !== undefined) {
    step.prompt_size_chars = promptSizeChars;
  }
  if (errorMessage) {
    step.error_message = errorMessage;
  }
  if (findingCount !== undefined) {
    step.finding_count = findingCount;
  }
  if (avgConfidence !== undefined) {
    step.avg_confidence = Math.round(avgConfidence * 100) / 100;
  }

  if (rawOutput !== undefined && rawOutput !== '') {
    step.raw_output = truncateRawOutputForTrace(rawOutput);
  }

  return step;
}
