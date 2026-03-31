import { z } from 'zod';

export interface Repo {
  full_name: string;
  private: boolean;
  default_branch: string;
}

export interface ReposResponse {
  repos: Repo[];
}

export interface PullRef {
  ref: string;
}

export interface Pull {
  number: number;
  title: string;
  state: string;
  head: PullRef;
  created_at: string;
}

export interface PullsResponse {
  pulls: Pull[];
}

const repoSchema = z.object({
  full_name: z.string(),
  private: z.boolean(),
  default_branch: z.string(),
});

export const reposResponseSchema = z.object({
  repos: z.array(repoSchema),
});

const pullSchema = z.object({
  number: z.number(),
  title: z.string(),
  state: z.string(),
  head: z.object({ ref: z.string() }),
  created_at: z.string(),
});

export const pullsResponseSchema = z.object({
  pulls: z.array(pullSchema),
});

/** Safe parse for GET /github/repos JSON bodies. */
export function parseReposResponse(json: unknown): ReposResponse | null {
  const r = reposResponseSchema.safeParse(json);
  return r.success ? r.data : null;
}

/** Safe parse for GET .../pulls JSON bodies. */
export function parsePullsResponse(json: unknown): PullsResponse | null {
  const r = pullsResponseSchema.safeParse(json);
  return r.success ? r.data : null;
}

export type DiffFileStatus = 'added' | 'modified' | 'removed' | 'renamed' | 'copied' | 'changed';

export interface DiffFile {
  filename: string;
  patch: string;
  status: DiffFileStatus;
}

export interface DiffResponse {
  diff: string;
  files: DiffFile[];
  pr_title?: string;
  pr_author?: string;
  commit_count?: number;
  /** Head SHA of the PR branch (for fetching file content at PR state) */
  head_sha?: string;
}

// ── Structured diff types for agent consumption ──

export interface DiffHunk {
  /** First changed line number in the new file */
  startLine: number;
  /** Last changed line number in the new file */
  endLine: number;
  /** The raw hunk content (changed + context lines) */
  content: string;
  /** Added lines only (prefixed with +) */
  addedLines: string[];
  /** Removed lines only (prefixed with -) */
  removedLines: string[];
}

export interface ParsedFile {
  path: string;
  status: DiffFileStatus;
  hunks: DiffHunk[];
  language: string;
}

export interface DiffStats {
  filesChanged: number;
  additions: number;
  deletions: number;
  totalChangedLines: number;
}

export interface ParsedDiff {
  files: ParsedFile[];
  stats: DiffStats;
}

// ── Context expansion types for agent prompts ──

export interface ExpandedContext {
  /** Full text of the enclosing function/method/block */
  enclosingFunction: string | null;
  /** Nearby variable/const/let declarations referenced by changed code */
  referencedDeclarations: string[];
  /** Bodies of helper functions called from changed code (same file only) */
  calledHelpers: string[];
}

export interface ExpandedHunk {
  hunk: DiffHunk;
  localContext: ExpandedContext;
}

export interface ExpandedFile extends ParsedFile {
  expandedHunks: ExpandedHunk[];
  /** Full file source (internal use only, not sent to agents) */
  fullSource?: string;
}
