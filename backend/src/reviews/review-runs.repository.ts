import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import type {
  GetReviewResponse,
  GetReviewsResponse,
  ReviewResult,
  ReviewRun,
  TraceStep,
} from 'shared';

export interface CreateReviewRunParams {
  userId: string;
  repoFullName: string;
  prNumber: number;
  prTitle: string | null;
  status: 'completed' | 'failed';
  resultSnapshot?: ReviewResult;
  trace?: TraceStep[];
  errorMessage?: string | null;
}

export interface ReviewRunRow {
  id: string;
  user_id: string;
  repo_full_name: string;
  pr_number: number;
  pr_title: string | null;
  status: string;
  result_snapshot: unknown;
  trace: unknown;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Repository for persisting review runs to Supabase review_runs table.
 * Uses user JWT for RLS so the insert is scoped to the authenticated user.
 */
@Injectable()
export class ReviewRunsRepository {
  async create(params: CreateReviewRunParams, userJwt: string): Promise<string> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase not configured');
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
      throw new Error(`Failed to create review run: ${error.message}`);
    }
    return data.id;
  }

  /**
   * Fetches one review run by id. Uses user JWT for RLS so only the owner can fetch.
   * Returns null if not found or not owned by the authenticated user.
   */
  async findById(id: string, userJwt: string): Promise<GetReviewResponse | null> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase not configured');
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
      throw new Error(`Failed to fetch review run: ${error.message}`);
    }
    if (!data) {
      return null;
    }

    const row = data as {
      id: string;
      status: string;
      result_snapshot: unknown;
      trace: unknown;
      error_message: string | null;
      created_at: string;
      updated_at: string;
    };
    return {
      id: row.id,
      status: row.status,
      result_snapshot: row.result_snapshot as ReviewResult | undefined,
      trace: (row.trace as TraceStep[] | undefined) ?? undefined,
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
      throw new Error('Supabase not configured');
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
      throw new Error(`Failed to fetch review runs: ${itemsRes.error.message}`);
    }
    if (countRes.error) {
      throw new Error(`Failed to count review runs: ${countRes.error.message}`);
    }

    const total = countRes.count ?? 0;
    const rows = (itemsRes.data ?? []) as ReviewRunRow[];

    const items: ReviewRun[] = rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      repo_full_name: row.repo_full_name,
      pr_number: row.pr_number,
      pr_title: row.pr_title ?? '',
      status: row.status,
      result_snapshot: row.result_snapshot as ReviewRun['result_snapshot'],
      trace: row.trace as ReviewRun['trace'],
      error_message: row.error_message,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return { items, total };
  }
}
