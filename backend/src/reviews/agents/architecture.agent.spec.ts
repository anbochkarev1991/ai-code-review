import { Test, TestingModule } from '@nestjs/testing';
import { ArchitectureAgent } from './architecture.agent';
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
        startLine: 1,
        endLine: 10,
        content:
          '+import { db } from "./database";\n+const users = db.query("SELECT * FROM users");',
        addedLines: [
          'import { db } from "./database";',
          'const users = db.query("SELECT * FROM users");',
        ],
        removedLines: [],
      },
    ],
  },
];

describe('ArchitectureAgent', () => {
  let agent: ArchitectureAgent;
  const originalEnv = process.env;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: 'sk-test' };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ArchitectureAgent, DiffParser],
    }).compile();

    agent = module.get(ArchitectureAgent);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('run', () => {
    it('throws when OPENAI_API_KEY is not set', async () => {
      delete process.env.OPENAI_API_KEY;
      const diffParser = new DiffParser();
      const freshAgent = new ArchitectureAgent(diffParser);
      await expect(freshAgent.run(SAMPLE_FILES)).rejects.toThrow(
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
            suggested_fix: 'Use a service layer to abstract data access.',
          },
        ],
        summary: 'One architecture issue found.',
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(validJson) } }],
      });

      const result = await agent.run(SAMPLE_FILES);

      expect(result.output).toEqual(validJson);
      expect(result.output.findings).toHaveLength(1);
      expect(result.output.findings[0].id).toBe('a1');
      expect(result.output.findings[0].severity).toBe('high');
      expect(result.output.findings[0].category).toBe('architecture');
      expect(result.output.summary).toBe('One architecture issue found.');
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
