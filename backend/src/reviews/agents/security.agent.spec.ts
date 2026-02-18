import { Test, TestingModule } from '@nestjs/testing';
import { SecurityAgent } from './security.agent';

const mockCreate = jest.fn();

jest.mock('openai', () => ({
  __esModule: true,
  default: class MockOpenAI {
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  },
}));

describe('SecurityAgent', () => {
  let agent: SecurityAgent;
  const originalEnv = process.env;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: 'sk-test' };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SecurityAgent],
    }).compile();

    agent = module.get(SecurityAgent);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('run', () => {
    it('throws when OPENAI_API_KEY is not set', async () => {
      delete process.env.OPENAI_API_KEY;
      const freshAgent = new SecurityAgent();
      await expect(freshAgent.run('diff')).rejects.toThrow(
        'OPENAI_API_KEY is required',
      );
    });

    it('returns JSON matching schema when OpenAI returns valid response', async () => {
      const validJson = {
        findings: [
          {
            id: 's1',
            title: 'SQL injection vulnerability',
            severity: 'high',
            category: 'security',
            file: 'src/login.ts',
            line: 4,
            message:
              'Username is interpolated directly into SQL query allowing injection.',
            suggestion: 'Use parameterized queries or prepared statements.',
          },
        ],
        summary: 'One security issue found.',
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(validJson) } }],
      });

      const result = await agent.run('diff --git a/file b/file');

      expect(result).toEqual(validJson);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].id).toBe('s1');
      expect(result.findings[0].severity).toBe('high');
      expect(result.findings[0].category).toBe('security');
      expect(result.summary).toBe('One security issue found.');
    });

    it('strips markdown code fences from response before parsing', async () => {
      const validJson = {
        findings: [],
        summary: 'No security issues found.',
      };
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: '```json\n' + JSON.stringify(validJson) + '\n```',
            },
          },
        ],
      });

      const result = await agent.run('diff');

      expect(result).toEqual(validJson);
    });

    it('throws when OpenAI returns invalid schema', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                findings: [{ invalid: 'structure' }],
                summary: null,
              }),
            },
          },
        ],
      });

      await expect(agent.run('diff')).rejects.toThrow('invalid JSON');
    });
  });
});
