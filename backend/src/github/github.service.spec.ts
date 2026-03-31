import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { GitHubService } from './github.service';

describe('GitHubService — malformed external payloads', () => {
  let service: GitHubService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    process.env.GITHUB_CLIENT_ID = 'test-client-id';
    process.env.GITHUB_CLIENT_SECRET = 'test-secret';
    process.env.GITHUB_OAUTH_REDIRECT_URI = 'http://localhost/callback';
    service = new GitHubService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('exchangeCodeForToken', () => {
    it.each([
      ['null', null],
      ['string', 'not-json-object'],
      ['array', []],
    ])(
      'throws UnauthorizedException when JSON is %s',
      async (_label, jsonBody) => {
        fetchMock.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(jsonBody),
        });

        await expect(service.exchangeCodeForToken('code')).rejects.toThrow(
          /Invalid token response from GitHub/,
        );
      },
    );

    it('throws UnauthorizedException when object has no access_token', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await expect(service.exchangeCodeForToken('code')).rejects.toThrow(
        'No access token in response',
      );
    });

    it('throws UnauthorizedException when error field is set', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ error: 'incorrect_client_credentials' }),
      });

      await expect(service.exchangeCodeForToken('code')).rejects.toThrow(
        'incorrect_client_credentials',
      );
    });
  });

  describe('getPullDiff', () => {
    it('throws UnauthorizedException when pull missing head', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            base: { sha: 'abc111', ref: 'main' },
          }),
      });

      await expect(
        service.getPullDiff('token', 'owner', 'repo', 1),
      ).rejects.toThrow(UnauthorizedException);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws UnauthorizedException when head.sha is missing', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            base: { sha: 'abc111', ref: 'main' },
            head: { ref: 'feat' },
          }),
      });

      await expect(
        service.getPullDiff('token', 'owner', 'repo', 1),
      ).rejects.toThrow(/Invalid pull request response from GitHub/);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('propagates NotFoundException when PR returns 404', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
      });

      await expect(
        service.getPullDiff('token', 'owner', 'repo', 99),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listPulls', () => {
    it('throws UnauthorizedException when response is not an array', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: 'unexpected' }),
      });

      await expect(service.listPulls('token', 'owner', 'repo')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.listPulls('token', 'owner', 'repo')).rejects.toThrow(
        /Failed to fetch pull requests from GitHub/,
      );
    });

    it('skips entries missing head.ref and keeps valid ones', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              number: 1,
              title: 'Good',
              state: 'open',
              head: { ref: 'main' },
              created_at: '2024-01-01T00:00:00Z',
            },
            {
              number: 2,
              title: 'Bad head',
              state: 'open',
              head: {},
              created_at: '2024-01-01T00:00:00Z',
            },
            {
              number: 3,
              title: 'Missing head',
              state: 'open',
              created_at: '2024-01-01T00:00:00Z',
            },
          ]),
      });

      const result = await service.listPulls('token', 'owner', 'repo');
      expect(result.pulls).toHaveLength(1);
      expect(result.pulls[0].number).toBe(1);
      expect(result.pulls[0].head.ref).toBe('main');
    });
  });
});
