import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import type {
  GetReviewResponse,
  GetReviewsResponse,
  ReviewResult,
  ReviewRun,
  ReviewStatus,
  TraceStep,
} from 'shared';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isReviewStatus(value: unknown): value is ReviewStatus {
  return value === 'complete' || value === 'partial' || value === 'failed';
}

function isAgentStatus(value: unknown): value is TraceStep['status'] {
  return value === 'ok' || value === 'timeout' || value === 'error';
}

function parseTraceStep(value: unknown): TraceStep | null {
  if (!isPlainObject(value)) return null;
  if (
    typeof value.agent !== 'string' ||
    typeof value.started_at !== 'string' ||
    typeof value.finished_at !== 'string' ||
    typeof value.parallel !== 'boolean' ||
    !isAgentStatus(value.status)
  ) {
    return null;
  }
  if (
    value.duration_ms !== undefined &&
    typeof value.duration_ms !== 'number' &&
    value.duration_ms !== null
  ) {
    return null;
  }
  if (
    value.tokens_used !== undefined &&
    typeof value.tokens_used !== 'number' &&
    value.tokens_used !== null
  ) {
    return null;
  }
  if (
    value.prompt_tokens !== undefined &&
    typeof value.prompt_tokens !== 'number' &&
    value.prompt_tokens !== null
  ) {
    return null;
  }
  if (
    value.completion_tokens !== undefined &&
    typeof value.completion_tokens !== 'number' &&
    value.completion_tokens !== null
  ) {
    return null;
  }
  if (
    value.prompt_size_chars !== undefined &&
    typeof value.prompt_size_chars !== 'number' &&
    value.prompt_size_chars !== null
  ) {
    return null;
  }
  if (
    value.error_message !== undefined &&
    value.error_message !== null &&
    typeof value.error_message !== 'string'
  ) {
    return null;
  }
  if (
    value.finding_count !== undefined &&
    value.finding_count !== null &&
    typeof value.finding_count !== 'number'
  ) {
    return null;
  }
  if (
    value.avg_confidence !== undefined &&
    value.avg_confidence !== null &&
    typeof value.avg_confidence !== 'number'
  ) {
    return null;
  }
  if (
    value.retried !== undefined &&
    value.retried !== null &&
    typeof value.retried !== 'boolean'
  ) {
    return null;
  }
  if (
    value.raw_output !== undefined &&
    value.raw_output !== null &&
    typeof value.raw_output !== 'string'
  ) {
    return null;
  }

  return {
    agent: value.agent,
    started_at: value.started_at,
    finished_at: value.finished_at,
    duration_ms:
      typeof value.duration_ms === 'number' ? value.duration_ms : undefined,
    tokens_used:
      typeof value.tokens_used === 'number' ? value.tokens_used : undefined,
    prompt_tokens:
      typeof value.prompt_tokens === 'number' ? value.prompt_tokens : undefined,
    completion_tokens:
      typeof value.completion_tokens === 'number'
        ? value.completion_tokens
        : undefined,
    prompt_size_chars:
      typeof value.prompt_size_chars === 'number'
        ? value.prompt_size_chars
        : undefined,
    parallel: value.parallel,
    status: value.status,
    error_message:
      typeof value.error_message === 'string' ? value.error_message : undefined,
    finding_count:
      typeof value.finding_count === 'number' ? value.finding_count : undefined,
    avg_confidence:
      typeof value.avg_confidence === 'number' ? value.avg_confidence : undefined,
    retried: typeof value.retried === 'boolean' ? value.retried : undefined,
    raw_output:
      typeof value.raw_output === 'string' ? value.raw_output : undefined,
  };
}

function parseTrace(value: unknown): TraceStep[] | undefined | null {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const trace: TraceStep[] = [];
  for (const entry of value) {
    const parsed = parseTraceStep(entry);
    if (!parsed) {
      return null;
    }
    trace.push(parsed);
  }
  return trace;
}

function parseReviewRunData(
  value: unknown,
): {
  id: string;
  status: ReviewStatus;
  result_snapshot?: ReviewResult;
  trace?: TraceStep[];
  error_message?: string;
  created_at: string;
  updated_at: string;
} | null {
  if (!isPlainObject(value)) return null;
  if (typeof value.id !== 'string') return null;
  if (!isReviewStatus(value.status)) return null;
  if (typeof value.created_at !== 'string' || typeof value.updated_at !== 'string')
    return null;
  if (
    value.error_message !== undefined &&
    value.error_message !== null &&
    typeof value.error_message !== 'string'
  ) {
    return null;
  }

  const trace = parseTrace(value.trace);
  if (trace === null) {
    return null;
  }

  return {
    id: value.id,
    status: value.status,
    result_snapshot:
      value.result_snapshot === undefined || value.result_snapshot === null
        ? undefined
        : (value.result_snapshot as ReviewResult),
    trace,
    error_message:
      typeof value.error_message === 'string' ? value.error_message : undefined,
    created_at: value.created_at,
    updated_at: value.updated_at,
  };
}

function parseReviewRunRow(value: unknown): ReviewRun | null {
  if (!isPlainObject(value)) return null;
  if (
    typeof value.id !== 'string' ||
    typeof value.user_id !== 'string' ||
    typeof value.repo_full_name !== 'string' ||
    typeof value.pr_number !== 'number' ||
    !Number.isFinite(value.pr_number) ||
    !isReviewStatus(value.status) ||
    typeof value.created_at !== 'string' ||
    typeof value.updated_at !== 'string'
  ) {
    return null;
  }
  if (value.pr_title !== null && typeof value.pr_title !== 'string') {
    return null;
  }
  if (
    value.error_message !== null &&
    value.error_message !== undefined &&
    typeof value.error_message !== 'string'
  ) {
    return null;
  }

  const trace = parseTrace(value.trace);
  if (trace === null) {
    return null;
  }

  return {
    id: value.id,
    user_id: value.user_id,
    repo_full_name: value.repo_full_name,
    pr_number: value.pr_number,
    pr_title: value.pr_title ?? '',
    status: value.status,
    result_snapshot:
      value.result_snapshot === undefined || value.result_snapshot === null
        ? undefined
        : (value.result_snapshot as ReviewRun['result_snapshot']),
    trace,
    error_message:
      value.error_message === null || value.error_message === undefined
        ? null
        : value.error_message,
    created_at: value.created_at,
    updated_at: value.updated_at,
  };
}

export interface CreateReviewRunParams {
  userId: string;
  repoFullName: string;
  prNumber: number;
  prTitle: string | null;
  status: ReviewStatus;
  resultSnapshot?: ReviewResult;
  trace?: TraceStep[];
  errorMessage?: string | null;
}

/**
 * Repository for persisting review runs to Supabase review_runs table.
 * Uses user JWT for RLS so the insert is scoped to the authenticated user.
 */
@Injectable()
export class ReviewRunsRepository {
  async create(
    params: CreateReviewRunParams,
    userJwt: string,
  ): Promise<string> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new InternalServerErrorException('Supabase not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
    });

    const now = new Date().toISOString();
    const row = {
      user_id: params.userId,
      repo_full_name: params.repoFullName,
      pr_number: params.prNumber,
      pr_title: params.prTitle ?? null,
      status: params.status,
      result_snapshot: params.resultSnapshot ?? null,
      trace: params.trace ?? null,
      error_message: params.errorMessage ?? null,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('review_runs')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      throw new InternalServerErrorException(
        `Failed to create review run: ${error.message}`,
      );
    }
    if (!data) {
      throw new InternalServerErrorException(
        'Review run insert returned no row',
      );
    }
    if (typeof data.id !== 'string' || data.id.length === 0) {
      throw new InternalServerErrorException(
        'Review run insert returned invalid id',
      );
    }
    return data.id;
  }

  /**
   * Fetches one review run by id. Uses user JWT for RLS so only the owner can fetch.
   * Returns null if not found or not owned by the authenticated user.
   */
  async findById(
    id: string,
    userJwt: string,
  ): Promise<GetReviewResponse | null> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new InternalServerErrorException('Supabase not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
    });

    const { data, error } = await supabase
      .from('review_runs')
      .select(
        'id, status, result_snapshot, trace, error_message, created_at, updated_at',
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(
        `Failed to fetch review run: ${error.message}`,
      );
    }
    if (!data) {
      return null;
    }

    const row = parseReviewRunData(data);
    if (!row) {
      throw new InternalServerErrorException(
        'Review run row has invalid shape',
      );
    }
    return {
      id: row.id,
      status: row.status,
      result_snapshot: row.result_snapshot,
      trace: row.trace,
      error_message: row.error_message ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Lists review runs for the current user with pagination.
   * Uses user JWT for RLS so only the owner's runs are returned.
   */
  async findAll(
    limit: number,
    offset: number,
    userJwt: string,
  ): Promise<GetReviewsResponse> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new InternalServerErrorException('Supabase not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
    });

    const select =
      'id, user_id, repo_full_name, pr_number, pr_title, status, result_snapshot, trace, error_message, created_at, updated_at';

    const [itemsRes, countRes] = await Promise.all([
      supabase
        .from('review_runs')
        .select(select)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      supabase.from('review_runs').select('id', { count: 'exact', head: true }),
    ]);

    if (itemsRes.error) {
      throw new InternalServerErrorException(
        `Failed to fetch review runs: ${itemsRes.error.message}`,
      );
    }
    if (countRes.error) {
      throw new InternalServerErrorException(
        `Failed to count review runs: ${countRes.error.message}`,
      );
    }

    const total = countRes.count ?? 0;
    const rows = itemsRes.data ?? [];
    if (!Array.isArray(rows)) {
      throw new InternalServerErrorException('Review runs list has invalid shape');
    }

    const items: ReviewRun[] = [];
    for (const row of rows) {
      const parsed = parseReviewRunRow(row);
      if (!parsed) {
        throw new InternalServerErrorException(
          'Review runs list contains invalid row shape',
        );
      }
      items.push(parsed);
    }

    return { items, total };
  }
}
