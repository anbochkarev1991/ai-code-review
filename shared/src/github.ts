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
