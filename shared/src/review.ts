import { z } from 'zod';

// ── Primitive domain types ──

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';

export type FindingCategory = 'security' | 'performance' | 'architecture' | 'code-quality';

export type RiskLevel = 'Low risk' | 'Moderate' | 'High' | 'Critical';

export type MergeRecommendation = 'Safe to merge' | 'Merge with caution' | 'Merge blocked';

export type ReviewStatus = 'complete' | 'partial' | 'failed';

export type AgentStatus = 'ok' | 'timeout' | 'error';

export type MergeExplanation = string;

// ── Consolidated finding types (production hardening) ──

export type ConsensusLevel = 'single-agent' | 'multi-agent';

export type FalsePositiveRisk = 'low' | 'medium' | 'high';

export interface AffectedLocation {
  file: string;
  line?: number;
}

// ── Engine & version constants ──

export const ENGINE_VERSION = '3.0.0';

export const AGENT_VERSIONS: Record<string, string> = {
  'code-quality': '3.0.0',
  'architecture': '3.0.0',
  'performance': '3.0.0',
  'security': '3.0.0',
};

// ── Zod schema for agent output ──

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

export const AGENT_OUTPUT_SCHEMA_PROMPT =
  `{ "findings": [{ "id": string (e.g. "sec-1"), "title": string, "severity": "critical"|"high"|"medium"|"low" (lowercase only), "category": "security"|"performance"|"architecture"|"code-quality", "file": string (required — path from diff), "line": number (required — line number from diff), "message": string, "suggested_fix": string, "confidence": number (0-1, required, e.g. 0.85), "impact": string (required — describe the business/system consequence, e.g. "May allow SQL injection leading to database compromise"), "reasoning_trace"?: string }], "summary": string }. IMPORTANT: "id" must be a string, "severity" must be lowercase, "confidence" must be a number not a string. "file" and "line" are required — reference exact paths and lines from the diff. "suggested_fix" is the recommended code change. "impact" describes business/system consequences of the issue.`;

// ── Diff context attached to findings (PART 3) ──

export interface DiffContext {
  snippet: string;
  diff_context_before: string;
  diff_context_after: string;
}

// ── Finding ──

export interface Finding {
  id: string;
  title: string;
  severity: FindingSeverity;
  category: string;
  categories?: string[];
  file?: string;
  line?: number;
  affected_locations?: AffectedLocation[];
  message: string;
  /** @deprecated Use suggested_fix instead */
  suggestion?: string;
  suggested_fix?: string;
  agent_name?: string;
  confidence: number;
  reasoning_trace?: string;
  impact?: string;
  merged_agents?: string[];
  merged_categories?: string[];
  consensus_level?: ConsensusLevel;
  false_positive_risk?: FalsePositiveRisk;
  outside_diff?: boolean;
  diff_context?: DiffContext;
}

// ── Risk breakdown (PART 1) ──

export interface RiskBreakdown {
  raw_weighted_sum: number;
  severity_contribution: Record<FindingSeverity, number>;
  category_contribution: Record<string, number>;
  floor_applied?: string;
  diminishing_return_score: number;
  final_score: number;
}

// ── Per-agent result (PART 4) ──

export interface AgentResult {
  agent_name: string;
  status: AgentStatus;
  output?: AgentOutput;
  tokens_used?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  duration_ms: number;
  error_message?: string;
  retried: boolean;
}

// ── Review signature (PART 5) ──

export interface ReviewSignature {
  review_id?: string;
  review_hash: string;
  engine_version: string;
  agent_versions: Record<string, string>;
  review_status: ReviewStatus;
}

// ── Performance summary (PART 9) ──

export interface PerformanceSummary {
  total_duration_ms: number;
  agents_parallel: number;
  avg_agent_latency_ms: number;
  per_agent_latency: Record<string, number>;
}

// ── PR metadata ──

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

// ── Cost estimation ──

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

// ── Execution metadata ──

export interface ExecutionMetadata {
  agent_count: number;
  duration_ms: number;
  total_tokens: number;
  cost_estimate?: CostEstimate;
  agents_status: Record<string, AgentStatus>;
}

// ── Review summary ──

export interface ReviewSummary {
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  risk_score: number;
  risk_level: RiskLevel;
  risk_breakdown?: RiskBreakdown;
  merge_recommendation: MergeRecommendation;
  merge_explanation: MergeExplanation;
  primary_risk_category?: string;
  most_severe_issue?: string;
  systemic_patterns?: string[];
  multi_agent_confirmed_count?: number;
  text: string;
}

// ── Review result ──

export interface ReviewMetadata {
  review_id?: string;
  review_hash: string;
  engine_version: string;
  agent_versions: Record<string, string>;
  review_status: ReviewStatus;
}

export interface ReviewResult {
  findings: Finding[];
  /** @deprecated Use review_summary.text instead */
  summary: string;
  review_summary?: ReviewSummary;
  execution_metadata?: ExecutionMetadata;
  pr_metadata?: PRMetadata;
  signature?: ReviewSignature;
  review_metadata?: ReviewMetadata;
  performance?: PerformanceSummary;
}

// ── Trace ──

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
  retried?: boolean;
  raw_output?: string;
}

export const TRACE_RAW_OUTPUT_MAX_LENGTH = 8192;

export function truncateRawOutputForTrace(raw: string): string {
  if (raw.length <= TRACE_RAW_OUTPUT_MAX_LENGTH) {
    return raw;
  }
  return raw.slice(0, TRACE_RAW_OUTPUT_MAX_LENGTH - 3) + '...';
}

// ── Review run (DB row) ──

export interface ReviewRun {
  id: string;
  user_id: string;
  repo_full_name: string;
  pr_number: number;
  pr_title: string;
  status: ReviewStatus;
  result_snapshot?: ReviewResult;
  trace?: TraceStep[];
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

// ── API contracts ──

export interface PostReviewsBody {
  repo_full_name: string;
  pr_number: number;
}

export interface PostReviewsResponse {
  id: string;
  status: ReviewStatus;
  result_snapshot?: ReviewResult;
  trace?: TraceStep[];
  error_message?: string;
  usage?: import('./billing').UsageResponse;
}

export interface GetReviewResponse {
  id: string;
  status: ReviewStatus;
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

// ── Engine options (PART 10) ──

export interface ReviewEngineOptions {
  strictMode?: boolean;
  maxAgents?: number;
  timeoutMs?: number;
}
