import { Test, TestingModule } from '@nestjs/testing';
import { ArchitectureAgent } from './architecture.agent';

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

describe('ArchitectureAgent', () => {
  let agent: ArchitectureAgent;
  const originalEnv = process.env;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: 'sk-test' };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ArchitectureAgent],
    }).compile();

    agent = module.get(ArchitectureAgent);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('run', () => {
    it('throws when OPENAI_API_KEY is not set', async () => {
      delete process.env.OPENAI_API_KEY;
      const freshAgent = new ArchitectureAgent();
      await expect(freshAgent.run('diff')).rejects.toThrow(
        'OPENAI_API_KEY is required',
      );
    });

    it('returns JSON matching schema when OpenAI returns valid response', async () => {
      const validJson = {
        findings: [
          {
            id: 'a1',
            title: 'Layer violation',
            severity: 'high',
            category: 'architecture',
            file: 'src/api.ts',
            line: 5,
            message: 'API layer directly imports and queries database.',
            suggestion: 'Use a service layer to abstract data access.',
          },
        ],
        summary: 'One architecture issue found.',
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(validJson) } }],
      });

      const result = await agent.run('diff --git a/file b/file');

      expect(result).toEqual(validJson);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].id).toBe('a1');
      expect(result.findings[0].severity).toBe('high');
      expect(result.findings[0].category).toBe('architecture');
      expect(result.summary).toBe('One architecture issue found.');
    });

    it('strips markdown code fences from response before parsing', async () => {
      const validJson = {
        findings: [],
        summary: 'No architecture issues found.',
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
