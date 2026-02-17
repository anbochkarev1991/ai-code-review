import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import type { Pull, PullsResponse, Repo, ReposResponse } from '../types';

const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GITHUB_REPOS_URL = 'https://api.github.com/user/repos';
const GITHUB_PULLS_URL = 'https://api.github.com/repos';

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope?: string;
}

interface GitHubUserResponse {
  id: number;
  login: string;
  avatar_url?: string;
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

    const data = (await response.json()) as GitHubTokenResponse & { error?: string };
    if (data.error) {
      throw new UnauthorizedException(data.error);
    }
    if (!data.access_token) {
      throw new UnauthorizedException('No access token in response');
    }

    return data.access_token;
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

  async getAccessTokenForUser(userId: string, userJwt: string): Promise<string> {
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

    return data.access_token;
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

    const response = await fetch(
      `${GITHUB_REPOS_URL}?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );

    if (!response.ok) {
      throw new UnauthorizedException('Failed to fetch repositories from GitHub');
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

    const data = (await response.json()) as Array<{
      number: number;
      title: string;
      state: string;
      head: { ref: string };
      created_at: string;
    }>;

    const pulls: Pull[] = data.map((p) => ({
      number: p.number,
      title: p.title,
      state: p.state,
      head: { ref: p.head.ref },
      created_at: p.created_at,
    }));

    return { pulls };
  }
}
