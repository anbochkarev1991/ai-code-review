import {
  type TraceStep,
  truncateRawOutputForTrace,
} from 'shared';

/**
 * Agent names for trace steps. Order: Code Quality, Architecture, Performance, Security, Aggregator.
 * Trace array must have these 5 entries when pipeline completes.
 */
export const TRACE_AGENT_NAMES = [
  'Code Quality',
  'Architecture',
  'Performance',
  'Security',
  'Aggregator',
] as const;

export type TraceAgentName = (typeof TRACE_AGENT_NAMES)[number];

export interface BuildTraceStepOptions {
  agent: string;
  startedAt: Date;
  finishedAt: Date;
  status: 'ok' | 'failed';
  tokensUsed?: number;
  rawOutput?: string;
}

/**
 * Builds a trace step for pipeline recording.
 * Per-agent raw output is truncated if larger than TRACE_RAW_OUTPUT_MAX_LENGTH.
 */
export function buildTraceStep(options: BuildTraceStepOptions): TraceStep {
  const {
    agent,
    startedAt,
    finishedAt,
    status,
    tokensUsed,
    rawOutput,
  } = options;

  const step: TraceStep = {
    agent,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    status,
  };

  if (tokensUsed !== undefined) {
    step.tokens_used = tokensUsed;
  }

  if (rawOutput !== undefined && rawOutput !== '') {
    step.raw_output = truncateRawOutputForTrace(rawOutput);
  }

  return step;
}
