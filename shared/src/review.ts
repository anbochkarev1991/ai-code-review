import { z } from 'zod';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';

/** Zod schema for agent output — validates findings + summary from code review agents */
export const agentOutputSchema = z.object({
  findings: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      severity: z.enum(['critical', 'high', 'medium', 'low']),
      category: z.string(),
      file: z.string().optional(),
      line: z.number().optional(),
      message: z.string(),
      suggestion: z.string().optional(),
      // AI transparency metadata (optional for backward compatibility)
      agent_name: z.string().optional(),
      confidence: z.number().min(0).max(1).optional(),
      reasoning_trace: z.string().optional(),
    })
  ),
  summary: z.string(),
});

export type AgentOutput = z.infer<typeof agentOutputSchema>;

/**
 * Short text form of the agent output schema for use in prompts.
 * Kept in sync with agentOutputSchema.
 */
export const AGENT_OUTPUT_SCHEMA_PROMPT =
  `{ "findings": [{ "id": string (e.g. "cq-1"), "title": string, "severity": "critical"|"high"|"medium"|"low" (lowercase only), "category": string, "file"?: string, "line"?: number, "message": string, "suggestion"?: string, "agent_name"?: string, "confidence"?: number (0-1, e.g. 0.85), "reasoning_trace"?: string }], "summary": string }. IMPORTANT: "id" must be a string, "severity" must be lowercase, "confidence" must be a number not a string.`;

export interface Finding {
  id: string;
  title: string;
  severity: FindingSeverity;
  category: string;
  file?: string;
  line?: number;
  message: string;
  suggestion?: string;
  // AI transparency metadata (optional for backward compatibility)
  agent_name?: string;
  confidence?: number; // 0-1 range
  reasoning_trace?: string; // Short explanation of why this finding was made
}

export interface ExecutionMetadata {
  agent_count: number;
  duration_ms: number;
  total_tokens: number;
}

export interface ReviewResult {
  findings: Finding[];
  summary: string;
  execution_metadata?: ExecutionMetadata; // Optional for backward compatibility
}

export interface TraceStep {
  agent: string;
  started_at: string;
  finished_at: string;
  tokens_used?: number;
  status: 'ok' | 'failed';
  /** Optional per-agent raw output; truncated if larger than TRACE_RAW_OUTPUT_MAX_LENGTH */
  raw_output?: string;
}

/** Max length for raw_output stored in trace; larger outputs are truncated with ellipsis */
export const TRACE_RAW_OUTPUT_MAX_LENGTH = 8192;

/**
 * Truncates raw output for trace storage to avoid bloating DB.
 * Returns truncated string with ellipsis suffix if cut.
 */
export function truncateRawOutputForTrace(raw: string): string {
  if (raw.length <= TRACE_RAW_OUTPUT_MAX_LENGTH) {
    return raw;
  }
  return raw.slice(0, TRACE_RAW_OUTPUT_MAX_LENGTH - 3) + '...';
}

export interface ReviewRun {
  id: string;
  user_id: string;
  repo_full_name: string;
  pr_number: number;
  pr_title: string;
  status: string;
  result_snapshot?: ReviewResult;
  trace?: TraceStep[];
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostReviewsBody {
  repo_full_name: string;
  pr_number: number;
}

export interface PostReviewsResponse {
  id: string;
  status: string;
  result_snapshot?: ReviewResult;
  trace?: TraceStep[];
  error_message?: string;
}

export interface GetReviewResponse {
  id: string;
  status: string;
  result_snapshot?: ReviewResult;
  trace?: TraceStep[];
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GetReviewsResponse {
  items: ReviewRun[];
  total: number;
}
