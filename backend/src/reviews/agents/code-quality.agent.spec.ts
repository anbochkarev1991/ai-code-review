import { Test, TestingModule } from '@nestjs/testing';
import { CodeQualityAgent } from './code-quality.agent';
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
    path: 'src/utils.ts',
    status: 'modified',
    language: 'typescript',
    hunks: [
      {
        startLine: 40,
        endLine: 45,
        content: '+const x = 42;\n+console.log("hello");',
        addedLines: ['const x = 42;', 'console.log("hello");'],
        removedLines: [],
      },
    ],
  },
];

describe('CodeQualityAgent', () => {
  let agent: CodeQualityAgent;
  const originalEnv = process.env;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: 'sk-test' };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CodeQualityAgent, DiffParser],
    }).compile();

    agent = module.get(CodeQualityAgent);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('run', () => {
    it('throws when OPENAI_API_KEY is not set', async () => {
      delete process.env.OPENAI_API_KEY;
      const diffParser = new DiffParser();
      const freshAgent = new CodeQualityAgent(diffParser);
      await expect(freshAgent.run(SAMPLE_FILES)).rejects.toThrow(
        'OPENAI_API_KEY is required',
      );
    });

    it('returns JSON matching schema when OpenAI returns valid response', async () => {
      const validJson = {
        findings: [
          {
            id: 'f1',
            title: 'Unused variable',
            severity: 'medium',
            category: 'code-quality',
            file: 'src/utils.ts',
            line: 42,
            message: 'Variable x is declared but never used.',
            suggested_fix: 'Remove the unused variable.',
          },
        ],
        summary: 'One code quality issue found.',
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(validJson) } }],
      });

      const result = await agent.run(SAMPLE_FILES);

      expect(result).toEqual(validJson);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].id).toBe('f1');
      expect(result.findings[0].severity).toBe('medium');
      expect(result.summary).toBe('One code quality issue found.');
    });

    it('strips markdown code fences from response before parsing', async () => {
      const validJson = {
        findings: [],
        summary: 'No issues found.',
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

      await expect(agent.run(SAMPLE_FILES)).rejects.toThrow('invalid JSON');
    });
  });
});
