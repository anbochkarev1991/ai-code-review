import { z } from 'zod';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';

export type FindingCategory = 'security' | 'performance' | 'architecture' | 'code-quality';

export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Critical';

export type MergeRecommendation = 'Safe to merge' | 'Merge with caution' | 'Block merge';

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
      impact: z.string().optional(),
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
  `{ "findings": [{ "id": string (e.g. "sec-1"), "title": string, "severity": "critical"|"high"|"medium"|"low" (lowercase only), "category": "security"|"performance"|"architecture"|"code-quality", "file": string (required — path from diff), "line": number (required — line number from diff), "message": string, "suggested_fix": string, "confidence": number (0-1, required, e.g. 0.85), "impact": string (required — describe the business/system consequence, e.g. "May allow SQL injection leading to database compromise"), "reasoning_trace"?: string }], "summary": string }. IMPORTANT: "id" must be a string, "severity" must be lowercase, "confidence" must be a number not a string. "file" and "line" are required — reference exact paths and lines from the diff. "suggested_fix" is the recommended code change. "impact" describes business/system consequences of the issue.`;

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
  impact?: string;
  /** Set when multiple agents flagged the same issue; lists all originating agents */
  merged_agents?: string[];
  /** Set when merged from multiple categories during deduplication */
  merged_categories?: string[];
  /** True if the finding references a file or line not present in the diff */
  outside_diff?: boolean;
}

export type AgentStatus = 'ok' | 'timeout' | 'error';

/** Human-readable explanation for the merge recommendation */
export type MergeExplanation = string;

/** PR metadata collected during diff analysis for transparency */
export interface PRMetadata {
  pr_number: number;
  pr_title: string;
  pr_author?: string;
  commit_count?: number;
  total_files_changed: number;
  total_additions: number;
  total_deletions: number;
  analysis_scope: 'diff-only';
}

/** Per-model rate in USD per token for cost estimation */
export interface ModelRate {
  prompt: number;
  completion: number;
}

export const MODEL_RATES: Record<string, ModelRate> = {
  'gpt-4o': { prompt: 2.5e-6, completion: 10e-6 },
  'gpt-4o-mini': { prompt: 0.15e-6, completion: 0.6e-6 },
  'gpt-4-turbo': { prompt: 10e-6, completion: 30e-6 },
  'gpt-4': { prompt: 30e-6, completion: 60e-6 },
  'gpt-3.5-turbo': { prompt: 0.5e-6, completion: 1.5e-6 },
};

export interface CostEstimate {
  total_usd: number;
  prompt_tokens: number;
  completion_tokens: number;
  model: string;
}

export interface ExecutionMetadata {
  agent_count: number;
  duration_ms: number;
  total_tokens: number;
  cost_estimate?: CostEstimate;
  agents_status: Record<string, AgentStatus>;
}

export interface ReviewSummary {
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  risk_score: number;
  risk_level: RiskLevel;
  merge_recommendation: MergeRecommendation;
  merge_explanation: MergeExplanation;
  primary_risk_category?: string;
  most_severe_issue?: string;
  text: string;
}

export interface ReviewResult {
  findings: Finding[];
  /** @deprecated Use review_summary.text instead */
  summary: string;
  review_summary?: ReviewSummary;
  execution_metadata?: ExecutionMetadata;
  pr_metadata?: PRMetadata;
}

export interface TraceStep {
  agent: string;
  started_at: string;
  finished_at: string;
  duration_ms?: number;
  tokens_used?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_size_chars?: number;
  parallel: boolean;
  status: AgentStatus;
  error_message?: string;
  finding_count?: number;
  avg_confidence?: number;
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
