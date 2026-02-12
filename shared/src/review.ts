export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface Finding {
  id: string;
  title: string;
  severity: FindingSeverity;
  category: string;
  file?: string;
  line?: number;
  message: string;
  suggestion?: string;
}

export interface ReviewResult {
  findings: Finding[];
  summary: string;
}

export interface TraceStep {
  agent: string;
  started_at: string;
  finished_at: string;
  tokens_used?: number;
  status: 'ok' | 'failed';
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
