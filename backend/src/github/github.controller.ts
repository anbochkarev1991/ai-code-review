import {
  Controller,
  Get,
  Query,
  Redirect,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { GitHubService } from './github.service';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_OAUTH_SCOPE = 'read:user repo';

@Controller('github')
export class GitHubController {
  constructor(private readonly githubService: GitHubService) {}

  @Get('oauth')
  @Redirect()
  oauthRedirect(@Query('state') state?: string) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw new UnauthorizedException('GitHub OAuth is not configured');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: GITHUB_OAUTH_SCOPE,
    });
    if (state) {
      params.set('state', state);
    }

    return { url: `${GITHUB_AUTHORIZE_URL}?${params.toString()}` };
  }

  @Get('oauth/callback')
  @Redirect()
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

    if (!code || !state) {
      return {
        url: `${frontendUrl}?github=error&message=missing_code_or_state`,
      };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        url: `${frontendUrl}?github=error&message=config_error`,
      };
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(state);

    if (error || !user) {
      return {
        url: `${frontendUrl}?github=error&message=invalid_state`,
      };
    }

    try {
      const accessToken = await this.githubService.exchangeCodeForToken(code);
      const githubUser = await this.githubService.getGitHubUser(accessToken);
      await this.githubService.createOrUpdateConnection(
        user,
        String(githubUser.id),
        accessToken,
        state,
      );
      return { url: `${frontendUrl}?github=connected` };
    } catch {
      return {
        url: `${frontendUrl}?github=error&message=exchange_failed`,
      };
    }
  }
}
