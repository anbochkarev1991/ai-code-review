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

export interface DiffFile {
  filename: string;
  patch: string;
}

export interface DiffResponse {
  diff: string;
  files?: DiffFile[];
  pr_title?: string;
}
