import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceAgent } from './performance.agent';

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

describe('PerformanceAgent', () => {
  let agent: PerformanceAgent;
  const originalEnv = process.env;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: 'sk-test' };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PerformanceAgent],
    }).compile();

    agent = module.get(PerformanceAgent);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('run', () => {
    it('throws when OPENAI_API_KEY is not set', async () => {
      delete process.env.OPENAI_API_KEY;
      const freshAgent = new PerformanceAgent();
      await expect(freshAgent.run('diff')).rejects.toThrow(
        'OPENAI_API_KEY is required',
      );
    });

    it('returns JSON matching schema when OpenAI returns valid response', async () => {
      const validJson = {
        findings: [
          {
            id: 'p1',
            title: 'N+1 query pattern',
            severity: 'high',
            category: 'performance',
            file: 'src/api.ts',
            line: 12,
            message: 'Loop fetches users one by one causing N+1 queries.',
            suggestion: 'Use batch fetch or eager loading.',
          },
        ],
        summary: 'One performance issue found.',
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(validJson) } }],
      });

      const result = await agent.run('diff --git a/file b/file');

      expect(result).toEqual(validJson);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].id).toBe('p1');
      expect(result.findings[0].severity).toBe('high');
      expect(result.findings[0].category).toBe('performance');
      expect(result.summary).toBe('One performance issue found.');
    });

    it('strips markdown code fences from response before parsing', async () => {
      const validJson = {
        findings: [],
        summary: 'No performance issues found.',
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
