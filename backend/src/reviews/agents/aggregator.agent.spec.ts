import { Test, TestingModule } from '@nestjs/testing';
import type { AgentOutput } from 'shared';
import { AggregatorAgent } from './aggregator.agent';

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

const MOCK_OUTPUTS: AgentOutput[] = [
  {
    findings: [
      {
        id: 'cq-1',
        title: 'Missing error handling',
        severity: 'medium',
        category: 'code-quality',
        file: 'src/api.ts',
        line: 42,
        message: 'No try/catch',
        suggestion: 'Add try/catch',
      },
    ],
    summary: 'Code quality: one finding.',
  },
  {
    findings: [],
    summary: 'Architecture: no issues.',
  },
  {
    findings: [],
    summary: 'Performance: no issues.',
  },
  {
    findings: [],
    summary: 'Security: no issues.',
  },
];

describe('AggregatorAgent', () => {
  let agent: AggregatorAgent;
  const originalEnv = process.env;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: 'sk-test' };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AggregatorAgent],
    }).compile();

    agent = module.get(AggregatorAgent);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('run', () => {
    it('throws when given fewer than 4 agent outputs', async () => {
      await expect(agent.run(MOCK_OUTPUTS.slice(0, 2))).rejects.toThrow(
        'Aggregator expects exactly 4 agent outputs, got 2',
      );
    });

    it('throws when given more than 4 agent outputs', async () => {
      const fiveOutputs = [...MOCK_OUTPUTS, MOCK_OUTPUTS[0]];
      await expect(agent.run(fiveOutputs)).rejects.toThrow(
        'Aggregator expects exactly 4 agent outputs, got 5',
      );
    });

    it('throws when OPENAI_API_KEY is not set', async () => {
      delete process.env.OPENAI_API_KEY;
      const freshAgent = new AggregatorAgent();
      await expect(freshAgent.run(MOCK_OUTPUTS)).rejects.toThrow(
        'OPENAI_API_KEY is required',
      );
    });

    it('returns merged findings and summary when OpenAI returns valid response', async () => {
      const mergedOutput: AgentOutput = {
        findings: [
          {
            id: 'agg-1',
            title: 'Missing error handling',
            severity: 'medium',
            category: 'code-quality',
            file: 'src/api.ts',
            line: 42,
            message: 'No try/catch',
            suggestion: 'Add try/catch',
          },
        ],
        summary: 'One finding from code quality agent.',
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mergedOutput) } }],
      });

      const result = await agent.run(MOCK_OUTPUTS);

      expect(result).toEqual(mergedOutput);
      expect(result.findings).toHaveLength(1);
      expect(result.summary).toBe('One finding from code quality agent.');
    });

    it('strips markdown code fences from response before parsing', async () => {
      const validOutput: AgentOutput = {
        findings: [],
        summary: 'All merged.',
      };
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: '```json\n' + JSON.stringify(validOutput) + '\n```',
            },
          },
        ],
      });

      const result = await agent.run(MOCK_OUTPUTS);

      expect(result).toEqual(validOutput);
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

      await expect(agent.run(MOCK_OUTPUTS)).rejects.toThrow('invalid JSON');
    });
  });
});
