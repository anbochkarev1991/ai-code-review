import { Test, TestingModule } from '@nestjs/testing';
import type { Finding } from 'shared';
import { FindingDeduplicatorService } from './finding-deduplicator.service';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'f-1',
    title: 'Test finding',
    severity: 'medium',
    category: 'code-quality',
    message: 'Some test finding message',
    confidence: 0.8,
    file: 'src/app.ts',
    line: 10,
    ...overrides,
  };
}

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

describe('FindingDeduplicatorService', () => {
  let service: FindingDeduplicatorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'sk-test';
    const module: TestingModule = await Test.createTestingModule({
      providers: [FindingDeduplicatorService],
    }).compile();
    service = module.get(FindingDeduplicatorService);
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('returns findings unchanged when <= 3 findings (LLM not called)', async () => {
    const findings = [
      makeFinding({ id: 'a-1', file: 'src/a.ts' }),
      makeFinding({ id: 'b-1', file: 'src/b.ts' }),
      makeFinding({ id: 'c-1', file: 'src/c.ts' }),
    ];

    const result = await service.deduplicate(findings);

    expect(result).toHaveLength(3);
    expect(result).toEqual(findings);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('merges 2 findings with same root cause across files when LLM groups them', async () => {
    const findings = [
      makeFinding({
        id: 'sec-1',
        agent_name: 'Security',
        category: 'security',
        severity: 'high',
        file: 'src/auth.ts',
        line: 10,
        message: 'Missing input validation for user ID',
        suggested_fix: 'Validate userId before use',
      }),
      makeFinding({
        id: 'cq-1',
        agent_name: 'Code Quality',
        category: 'code-quality',
        severity: 'medium',
        file: 'src/billing.ts',
        line: 25,
        message: 'Input validation missing for checkout params',
        suggested_fix: 'Add validation for all inputs',
      }),
      makeFinding({ id: 'arch-1', file: 'src/core.ts', message: 'Tight coupling' }),
      makeFinding({ id: 'perf-1', file: 'src/db.ts', message: 'N+1 query risk' }),
    ];

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              groups: [
                {
                  root_cause: 'Missing input validation',
                  finding_ids: ['sec-1', 'cq-1'],
                },
              ],
              ungrouped_ids: ['arch-1', 'perf-1'],
            }),
          },
        },
      ],
    });

    const result = await service.deduplicate(findings);

    expect(result).toHaveLength(3);
    const merged = result.find((f) => f.merged_agents?.length === 2);
    expect(merged).toBeDefined();
    expect(merged!.severity).toBe('high');
    expect(merged!.root_cause).toBe('Missing input validation');
    expect(merged!.merged_agents).toEqual(
      expect.arrayContaining(['Security', 'Code Quality']),
    );
    expect(merged!.consensus_level).toBe('multi-agent');
    expect(merged!.affected_locations).toEqual(
      expect.arrayContaining([
        { file: 'src/auth.ts', line: 10 },
        { file: 'src/billing.ts', line: 25 },
      ]),
    );
    expect(merged!.suggested_fix).toBeDefined();
    expect(merged!.suggested_fix!.toLowerCase()).toMatch(/validat/);
  });

  it('preserves all findings when LLM returns no groups', async () => {
    const findings = [
      makeFinding({ id: 'a-1', file: 'src/a.ts' }),
      makeFinding({ id: 'b-1', file: 'src/b.ts' }),
      makeFinding({ id: 'c-1', file: 'src/c.ts' }),
      makeFinding({ id: 'd-1', file: 'src/d.ts' }),
    ];

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              groups: [],
              ungrouped_ids: ['a-1', 'b-1', 'c-1', 'd-1'],
            }),
          },
        },
      ],
    });

    const result = await service.deduplicate(findings);

    expect(result).toHaveLength(4);
    expect(result.map((f) => f.id)).toEqual(['a-1', 'b-1', 'c-1', 'd-1']);
  });

  it('returns original findings when LLM returns invalid JSON', async () => {
    const findings = [
      makeFinding({ id: 'a-1' }),
      makeFinding({ id: 'b-1' }),
      makeFinding({ id: 'c-1' }),
      makeFinding({ id: 'd-1' }),
    ];

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'not valid json {{{' } }],
    });

    const result = await service.deduplicate(findings);

    expect(result).toHaveLength(4);
    expect(result).toEqual(findings);
  });

  it('returns original findings when OPENAI_API_KEY is not set', async () => {
    delete process.env.OPENAI_API_KEY;
    const module: TestingModule = await Test.createTestingModule({
      providers: [FindingDeduplicatorService],
    }).compile();
    const svc = module.get(FindingDeduplicatorService);

    const findings = [
      makeFinding({ id: 'a-1' }),
      makeFinding({ id: 'b-1' }),
      makeFinding({ id: 'c-1' }),
      makeFinding({ id: 'd-1' }),
    ];

    const result = await svc.deduplicate(findings);

    expect(result).toEqual(findings);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('ignores unknown IDs from LLM and merges valid groups', async () => {
    const findings = [
      makeFinding({
        id: 'sec-1',
        agent_name: 'Security',
        file: 'src/auth.ts',
        message: 'SQL injection risk',
      }),
      makeFinding({
        id: 'cq-1',
        agent_name: 'Code Quality',
        file: 'src/billing.ts',
        message: 'Unparameterized query',
      }),
      makeFinding({ id: 'arch-1', file: 'src/core.ts', message: 'Tight coupling' }),
      makeFinding({ id: 'perf-1', file: 'src/db.ts', message: 'N+1 risk' }),
    ];

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              groups: [
                {
                  root_cause: 'SQL injection',
                  finding_ids: ['sec-1', 'cq-1', 'nonexistent-id'],
                },
              ],
              ungrouped_ids: ['arch-1'],
            }),
          },
        },
      ],
    });

    const result = await service.deduplicate(findings);

    expect(result).toHaveLength(3);
    const merged = result.find((f) => f.merged_agents?.length === 2);
    expect(merged).toBeDefined();
    expect(merged?.root_cause).toBe('SQL injection');
    const standalone = result.find((f) => f.id === 'arch-1');
    expect(standalone).toBeDefined();
  });

  it('keeps highest severity among merged findings', async () => {
    const findings = [
      makeFinding({
        id: 'low-1',
        severity: 'low',
        agent_name: 'Code Quality',
        file: 'src/a.ts',
        message: 'Missing validation',
      }),
      makeFinding({
        id: 'critical-1',
        severity: 'critical',
        agent_name: 'Security',
        file: 'src/b.ts',
        message: 'Input not validated',
      }),
      makeFinding({ id: 'arch-1', file: 'src/core.ts', message: 'Tight coupling' }),
      makeFinding({ id: 'perf-1', file: 'src/db.ts', message: 'N+1 risk' }),
    ];

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              groups: [
                {
                  root_cause: 'Missing validation',
                  finding_ids: ['low-1', 'critical-1'],
                },
              ],
              ungrouped_ids: ['arch-1', 'perf-1'],
            }),
          },
        },
      ],
    });

    const result = await service.deduplicate(findings);

    const merged = result.find((f) => f.merged_agents?.length === 2);
    expect(merged).toBeDefined();
    expect(merged!.severity).toBe('critical');
  });

  it('returns original findings when LLM throws', async () => {
    const findings = [
      makeFinding({ id: 'a-1' }),
      makeFinding({ id: 'b-1' }),
      makeFinding({ id: 'c-1' }),
      makeFinding({ id: 'd-1' }),
    ];

    mockCreate.mockRejectedValue(new Error('API rate limit'));

    const result = await service.deduplicate(findings);

    expect(result).toEqual(findings);
  });
});
