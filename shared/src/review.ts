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
      suggested_fix: z.string().optional(),
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
  `{ "findings": [{ "id": string (e.g. "sec-1"), "title": string, "severity": "critical"|"high"|"medium"|"low" (lowercase only), "category": "security"|"performance"|"architecture"|"code-quality", "file": string (required — path from diff), "line": number (required — line number from diff), "message": string, "suggested_fix": string, "confidence": number (0-1, required, e.g. 0.85), "reasoning_trace"?: string }], "summary": string }. IMPORTANT: "id" must be a string, "severity" must be lowercase, "confidence" must be a number not a string. "file" and "line" are required — reference exact paths and lines from the diff. "suggested_fix" is the recommended code change.`;

export interface Finding {
  id: string;
  title: string;
  severity: FindingSeverity;
  category: string;
  file?: string;
  line?: number;
  message: string;
  /** @deprecated Use suggested_fix instead */
  suggestion?: string;
  suggested_fix?: string;
  agent_name?: string;
  confidence?: number;
  reasoning_trace?: string;
}

export interface ExecutionMetadata {
  agent_count: number;
  duration_ms: number;
  total_tokens: number;
}

export interface ReviewSummary {
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  risk_score: number;
  text: string;
}

export interface ReviewResult {
  findings: Finding[];
  /** @deprecated Use review_summary.text instead */
  summary: string;
  review_summary?: ReviewSummary;
  execution_metadata?: ExecutionMetadata;
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
  usage?: import('./billing').UsageResponse;
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
