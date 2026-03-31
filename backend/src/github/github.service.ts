import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import type {
  DiffFile,
  DiffFileStatus,
  DiffResponse,
  Pull,
  PullsResponse,
  Repo,
  ReposResponse,
} from '../types';

const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GITHUB_REPOS_URL = 'https://api.github.com/user/repos';
const GITHUB_PULLS_URL = 'https://api.github.com/repos';

interface GitHubUserResponse {
  id: number;
  login: string;
  avatar_url?: string;
}

/** Pull payload from GET /repos/{owner}/{repo}/pulls/{number} — validated before nested access. */
interface GitHubPullForCompare {
  base: { sha: string; ref: string };
  head: { sha: string; ref: string };
  title?: string;
  user?: { login: string };
  commits?: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOAuthTokenJson(json: unknown): string {
  if (!isPlainObject(json)) {
    throw new UnauthorizedException('Invalid token response from GitHub');
  }
  if (typeof json.error === 'string' && json.error.length > 0) {
    throw new UnauthorizedException(json.error);
  }
  const token = json.access_token;
  if (typeof token !== 'string' || !token) {
    throw new UnauthorizedException('No access token in response');
  }
  return token;
}

function parsePullForCompare(pull: unknown): GitHubPullForCompare {
  if (!isPlainObject(pull)) {
    throw new UnauthorizedException(
      'Invalid pull request response from GitHub',
    );
  }
  const base = pull.base;
  const head = pull.head;
  if (!isPlainObject(base) || !isPlainObject(head)) {
    throw new UnauthorizedException(
      'Invalid pull request response from GitHub',
    );
  }
  const baseSha = base.sha;
  const headSha = head.sha;
  const baseRef = base.ref;
  const headRef = head.ref;
  if (typeof baseSha !== 'string' || baseSha.length === 0) {
    throw new UnauthorizedException(
      'Invalid pull request response from GitHub',
    );
  }
  if (typeof headSha !== 'string' || headSha.length === 0) {
    throw new UnauthorizedException(
      'Invalid pull request response from GitHub',
    );
  }
  if (typeof baseRef !== 'string' || baseRef.length === 0) {
    throw new UnauthorizedException(
      'Invalid pull request response from GitHub',
    );
  }
  if (typeof headRef !== 'string' || headRef.length === 0) {
    throw new UnauthorizedException(
      'Invalid pull request response from GitHub',
    );
  }

  const out: GitHubPullForCompare = {
    base: { sha: baseSha, ref: baseRef },
    head: { sha: headSha, ref: headRef },
  };
  if (typeof pull.title === 'string') {
    out.title = pull.title;
  }
  if (typeof pull.commits === 'number' && Number.isFinite(pull.commits)) {
    out.commits = pull.commits;
  }
  const u = pull.user;
  if (isPlainObject(u) && typeof u.login === 'string' && u.login.length > 0) {
    out.user = { login: u.login };
  }
  return out;
}

/** Validates a single PR in list response before accessing `head.ref`. */
function isValidListPullEntry(p: unknown): p is {
  number: number;
  title: string;
  state: string;
  head: { ref: string };
  created_at: string;
} {
  if (!isPlainObject(p)) return false;
  if (typeof p.number !== 'number' || !Number.isFinite(p.number)) return false;
  if (typeof p.title !== 'string') return false;
  if (typeof p.state !== 'string') return false;
  if (typeof p.created_at !== 'string') return false;
  if (!isPlainObject(p.head)) return false;
  if (typeof p.head.ref !== 'string' || p.head.ref.length === 0) return false;
  return true;
}

@Injectable()
export class GitHubService {
  async exchangeCodeForToken(code: string): Promise<string> {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new UnauthorizedException('GitHub OAuth is not configured');
    }

    const response = await fetch(GITHUB_ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new UnauthorizedException('Failed to exchange code for token');
    }

    const json: unknown = await response.json();
    return parseOAuthTokenJson(json);
  }

  async getGitHubUser(accessToken: string): Promise<GitHubUserResponse> {
    const response = await fetch(GITHUB_USER_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!response.ok) {
      throw new UnauthorizedException('Failed to fetch GitHub user');
    }

    return response.json() as Promise<GitHubUserResponse>;
  }

  async createOrUpdateConnection(
    user: User,
    githubUserId: string,
    accessToken: string,
    userJwt: string,
  ): Promise<void> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new UnauthorizedException('Supabase is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
    });
    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from('github_connections')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('github_connections')
        .update({
          github_user_id: githubUserId,
          access_token: accessToken,
          updated_at: now,
        })
        .eq('user_id', user.id);

      if (error) {
        throw new UnauthorizedException('Failed to update GitHub connection');
      }
    } else {
      const { error } = await supabase.from('github_connections').insert({
        user_id: user.id,
        github_user_id: githubUserId,
        access_token: accessToken,
        created_at: now,
        updated_at: now,
      });

      if (error) {
        throw new UnauthorizedException('Failed to create GitHub connection');
      }
    }
  }

  async getAccessTokenForUser(
    userId: string,
    userJwt: string,
  ): Promise<string> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new UnauthorizedException('Supabase is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
    });

    const { data, error } = await supabase
      .from('github_connections')
      .select('access_token')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new UnauthorizedException('Failed to fetch GitHub connection');
    }
    if (!data?.access_token) {
      throw new UnauthorizedException('GitHub account not connected');
    }

    return data.access_token as string;
  }

  async listRepos(
    accessToken: string,
    page = 1,
    perPage = 30,
  ): Promise<ReposResponse> {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(Math.min(perPage, 100)),
    });

    const response = await fetch(`${GITHUB_REPOS_URL}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!response.ok) {
      throw new UnauthorizedException(
        'Failed to fetch repositories from GitHub',
      );
    }

    const data = (await response.json()) as Array<{
      full_name: string;
      private: boolean;
      default_branch: string;
    }>;

    const repos: Repo[] = data.map((r) => ({
      full_name: r.full_name,
      private: r.private,
      default_branch: r.default_branch,
    }));

    return { repos };
  }

  async listPulls(
    accessToken: string,
    owner: string,
    repo: string,
    state?: 'open' | 'closed' | 'all',
  ): Promise<PullsResponse> {
    const params = new URLSearchParams();
    if (state) {
      params.set('state', state);
    }

    const url = `${GITHUB_PULLS_URL}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!response.ok) {
      throw new UnauthorizedException(
        'Failed to fetch pull requests from GitHub',
      );
    }

    const json: unknown = await response.json();
    if (!Array.isArray(json)) {
      throw new UnauthorizedException(
        'Failed to fetch pull requests from GitHub',
      );
    }

    const pulls: Pull[] = json.filter(isValidListPullEntry).map((p) => ({
      number: p.number,
      title: p.title,
      state: p.state,
      head: { ref: p.head.ref },
      created_at: p.created_at,
    }));

    return { pulls };
  }

  async getPullDiff(
    accessToken: string,
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<DiffResponse> {
    const pullsUrl = `${GITHUB_PULLS_URL}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}`;
    const pullResponse = await fetch(pullsUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!pullResponse.ok) {
      if (pullResponse.status === 404) {
        throw new NotFoundException('Pull request not found');
      }
      throw new UnauthorizedException(
        'Failed to fetch pull request from GitHub',
      );
    }

    const pullJson: unknown = await pullResponse.json();
    const pull = parsePullForCompare(pullJson);
    const baseSha = pull.base.sha;
    const headSha = pull.head.sha;

    const compareUrl = `${GITHUB_PULLS_URL}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/compare/${baseSha}...${headSha}`;
    const compareResponse = await fetch(compareUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!compareResponse.ok) {
      throw new UnauthorizedException('Failed to fetch diff from GitHub');
    }

    const compare = (await compareResponse.json()) as {
      files?: Array<{
        filename: string;
        patch: string | null;
        status?: string;
      }>;
    };

    const files: DiffFile[] = (compare.files ?? []).map((f) => ({
      filename: f.filename,
      patch: f.patch ?? '',
      status: (f.status ?? 'modified') as DiffFileStatus,
    }));

    const diff = files
      .map((f) => f.patch)
      .filter((p) => !!p)
      .join('\n');

    return {
      diff,
      files,
      pr_title: pull.title,
      pr_author: pull.user?.login,
      commit_count: pull.commits,
      head_sha: headSha,
    };
  }

  /**
   * Fetches the full file content from GitHub Contents API.
   * Used by the review engine to expand diff hunks with surrounding context.
   *
   * @param accessToken - GitHub OAuth token
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param path - File path (e.g. "src/utils.ts")
   * @param ref - Git ref (branch, SHA, or tag, e.g. "main" or commit SHA)
   * @returns Decoded file content or null on error (404, non-file, etc.)
   */
  async getFileContent(
    accessToken: string,
    owner: string,
    repo: string,
    path: string,
    ref: string,
  ): Promise<string | null> {
    const encodedPath = path
      .split('/')
      .map((p) => encodeURIComponent(p))
      .join('/');
    const url = `${GITHUB_PULLS_URL}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.raw',
      },
    });

    if (!response.ok) {
      return null;
    }

    return response.text();
  }
}
