import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceAgent } from './performance.agent';
import { DiffParser } from '../diff-parser';
import type { ParsedFile } from '../../types';

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

const SAMPLE_FILES: ParsedFile[] = [
  {
    path: 'src/api.ts',
    status: 'modified',
    language: 'typescript',
    hunks: [
      {
        startLine: 10,
        endLine: 20,
        content: '+for (const user of users) {\n+  const profile = await db.query(`SELECT * FROM profiles WHERE user_id = ${user.id}`);\n+}',
        addedLines: [
          'for (const user of users) {',
          '  const profile = await db.query(`SELECT * FROM profiles WHERE user_id = ${user.id}`);',
          '}',
        ],
        removedLines: [],
      },
    ],
  },
];

describe('PerformanceAgent', () => {
  let agent: PerformanceAgent;
  const originalEnv = process.env;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: 'sk-test' };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PerformanceAgent, DiffParser],
    }).compile();

    agent = module.get(PerformanceAgent);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('run', () => {
    it('throws when OPENAI_API_KEY is not set', async () => {
      delete process.env.OPENAI_API_KEY;
      const diffParser = new DiffParser();
      const freshAgent = new PerformanceAgent(diffParser);
      await expect(freshAgent.run(SAMPLE_FILES)).rejects.toThrow(
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
            suggested_fix: 'Use batch fetch or eager loading.',
          },
        ],
        summary: 'One performance issue found.',
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(validJson) } }],
      });

      const result = await agent.run(SAMPLE_FILES);

      expect(result.output).toEqual(validJson);
      expect(result.output.findings).toHaveLength(1);
      expect(result.output.findings[0].id).toBe('p1');
      expect(result.output.findings[0].severity).toBe('high');
      expect(result.output.findings[0].category).toBe('performance');
      expect(result.output.summary).toBe('One performance issue found.');
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

      const result = await agent.run(SAMPLE_FILES);

      expect(result.output).toEqual(validJson);
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

      await expect(agent.run(SAMPLE_FILES)).rejects.toThrow('invalid JSON');
    });
  });
});
