import {
  Controller,
  Get,
  Redirect,
  UnauthorizedException,
} from '@nestjs/common';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_OAUTH_SCOPE = 'read:user repo';

@Controller('github')
export class GitHubController {
  @Get('oauth')
  @Redirect()
  oauthRedirect() {
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

    return { url: `${GITHUB_AUTHORIZE_URL}?${params.toString()}` };
  }
}
