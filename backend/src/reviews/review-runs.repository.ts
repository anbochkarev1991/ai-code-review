import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import type { ReviewResult, TraceStep } from 'shared';

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
}
