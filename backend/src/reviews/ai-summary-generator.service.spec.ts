import { Test, TestingModule } from '@nestjs/testing';
import type { Finding, ReviewSummary } from 'shared';
import {
  AiSummaryGeneratorService,
  buildFactualSeverityPrefix,
  stripSeverityCountClaims,
} from './ai-summary-generator.service';

function makeReviewSummary(overrides: Partial<ReviewSummary>): ReviewSummary {
  return {
    total_findings: 0,
    critical_count: 0,
    high_count: 0,
    medium_count: 0,
    low_count: 0,
    risk_score: 0,
    risk_level: 'Low risk',
    merge_recommendation: 'Safe to merge',
    merge_explanation: '',
    text: '',
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

describe('buildFactualSeverityPrefix', () => {
  it('returns no issues when all counts are zero', () => {
    expect(
      buildFactualSeverityPrefix(
        makeReviewSummary({
          critical_count: 0,
          high_count: 0,
          medium_count: 0,
          low_count: 0,
        }),
      ),
    ).toBe('No issues found.');
  });

  it('formats single-severity breakdown with singular and plural', () => {
    expect(
      buildFactualSeverityPrefix(
        makeReviewSummary({
          high_count: 1,
          medium_count: 2,
        }),
      ),
    ).toBe(
      'This PR contains 1 high-severity issue and 2 medium-severity issues.',
    );
  });

  it('uses Oxford-style list for three or more severity bands', () => {
    expect(
      buildFactualSeverityPrefix(
        makeReviewSummary({
          critical_count: 1,
          high_count: 1,
          medium_count: 1,
          low_count: 0,
        }),
      ),
    ).toBe(
      'This PR contains 1 critical-severity issue, 1 high-severity issue, and 1 medium-severity issue.',
    );
  });
});

describe('stripSeverityCountClaims', () => {
  const counts = { critical: 0, high: 1, medium: 2, low: 0 };

  it('removes sentences with hallucinated numeric severity counts', () => {
    const raw =
      'This PR has three high-severity issues. The main risk is weak validation.';
    expect(stripSeverityCountClaims(raw, counts)).toBe(
      'The main risk is weak validation.',
    );
  });

  it('keeps qualitative sentences without severity counts', () => {
    const raw =
      'Reliability is the main concern; auth flows need hardening before merge.';
    expect(stripSeverityCountClaims(raw, counts)).toBe(raw);
  });

  it('drops vague quantifiers tied to severity wording', () => {
    const raw =
      'Multiple high-severity problems exist. Address validation gaps.';
    expect(stripSeverityCountClaims(raw, counts)).toBe(
      'Address validation gaps.',
    );
  });
});

describe('AiSummaryGeneratorService', () => {
  let service: AiSummaryGeneratorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'sk-test';
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiSummaryGeneratorService],
    }).compile();
    service = module.get(AiSummaryGeneratorService);
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('returns parsed AiReviewSummary when OpenAI returns valid JSON', async () => {
    const aiResponse = {
      overall_assessment: 'This PR introduces reliability risks.',
      primary_risk: 'Reliability',
      key_concerns: ['Error handling gaps', 'Validation issues'],
      recommendation: 'Address error handling before merge.',
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(aiResponse) } }],
    });

    const findings: Finding[] = [
      {
        id: '1',
        title: 'Missing error handling',
        severity: 'high',
        category: 'code-quality',
        message: 'Billing methods lack try/catch.',
        confidence: 0.9,
      },
    ];
    const reviewSummary = makeReviewSummary({
      total_findings: 1,
      high_count: 1,
      risk_score: 65,
      risk_level: 'Moderate',
      merge_recommendation: 'Merge with caution',
      merge_explanation: 'Address high-severity findings.',
    });

    const result = await service.generate(findings, reviewSummary);

    expect(result?.overall_assessment).toBe(
      'This PR contains 1 high-severity issue. This PR introduces reliability risks.',
    );
    expect(result?.primary_risk).toBe(aiResponse.primary_risk);
    expect(result?.recommendation).toBe(aiResponse.recommendation);
    expect(result?.key_concerns).toEqual([
      '[MEDIUM] Error handling gaps',
      '[MEDIUM] Validation issues',
    ]);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    type CreateCallArg = { messages: Array<{ content?: string }> };
    const calls = mockCreate.mock.calls as CreateCallArg[][];
    const userContent = calls[0]?.[0]?.messages[1]?.content ?? '';
    expect(userContent).toContain('Missing error handling');
    expect(userContent).toContain('Risk score: 65');
    expect(userContent).toContain('Merge with caution');
  });

  it('caps key_concerns at 5 items', async () => {
    const response = {
      overall_assessment: 'Summary.',
      primary_risk: 'Security',
      key_concerns: ['a', 'b', 'c', 'd', 'e', 'f'],
      recommendation: 'Fix issues.',
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(response) } }],
    });

    const result = await service.generate(
      [],
      makeReviewSummary({
        total_findings: 0,
        medium_count: 1,
      }),
    );

    expect(result?.key_concerns).toHaveLength(5);
    expect(result?.key_concerns).toEqual([
      '[MEDIUM] a',
      '[MEDIUM] b',
      '[MEDIUM] c',
      '[MEDIUM] d',
      '[MEDIUM] e',
    ]);
    expect(result?.overall_assessment).toMatch(
      /^This PR contains 1 medium-severity issue\./,
    );
  });

  it('falls back to primary_risk_category when AI does not return primary_risk', async () => {
    const response = {
      overall_assessment: 'Summary.',
      key_concerns: ['Issue'],
      recommendation: 'Fix issues.',
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(response) } }],
    });

    const result = await service.generate(
      [],
      makeReviewSummary({
        primary_risk_category: 'Architecture',
        low_count: 1,
        total_findings: 1,
      }),
    );

    expect(result?.primary_risk).toBe('Architecture');
    expect(result?.overall_assessment).toMatch(
      /^This PR contains 1 low-severity issue\./,
    );
  });

  it('returns undefined when OPENAI_API_KEY is not set', async () => {
    delete process.env.OPENAI_API_KEY;
    const freshModule = await Test.createTestingModule({
      providers: [AiSummaryGeneratorService],
    }).compile();
    const freshService = freshModule.get(AiSummaryGeneratorService);

    const result = await freshService.generate([], makeReviewSummary({}));

    expect(result).toBeUndefined();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns undefined when OpenAI returns invalid JSON shape', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ foo: 'bar' }) } }],
    });

    const result = await service.generate([], makeReviewSummary({}));

    expect(result).toBeUndefined();
  });

  it('returns undefined when OpenAI returns empty content', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: '' } }] });

    const result = await service.generate([], makeReviewSummary({}));

    expect(result).toBeUndefined();
  });

  it('merges similar concerns into single aggregated items', async () => {
    const response = {
      overall_assessment: 'Multiple null checks missing.',
      primary_risk: 'Reliability',
      key_concerns: [
        '[HIGH] Missing null check in checkout method',
        '[HIGH] Missing null check in getUsage method',
      ],
      recommendation: 'Add null checks to token handling.',
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(response) } }],
    });

    const result = await service.generate(
      [],
      makeReviewSummary({ high_count: 2, total_findings: 2 }),
    );

    expect(result?.key_concerns).toHaveLength(1);
    expect(result?.key_concerns[0]).toMatch(/\[HIGH\].*\(2 locations\)/);
    expect(result?.overall_assessment).toBe(
      'This PR contains 2 high-severity issues. Multiple null checks missing.',
    );
  });

  it('strips hallucinated severity counts and prepends factual prefix', async () => {
    const aiResponse = {
      overall_assessment:
        'This PR has three high-severity issues. Weak validation is the main theme.',
      primary_risk: 'Security',
      key_concerns: ['[HIGH] Validation gaps'],
      recommendation: 'Harden validation before merge.',
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(aiResponse) } }],
    });

    const findings: Finding[] = [
      {
        id: '1',
        title: 'Weak validation',
        severity: 'high',
        category: 'security',
        message: 'Input not sanitized.',
        confidence: 0.9,
      },
      {
        id: '2',
        title: 'Rate limit',
        severity: 'medium',
        category: 'security',
        message: 'Missing throttle.',
        confidence: 0.8,
      },
      {
        id: '3',
        title: 'Logging',
        severity: 'medium',
        category: 'security',
        message: 'PII in logs.',
        confidence: 0.8,
      },
    ];

    const result = await service.generate(
      findings,
      makeReviewSummary({
        total_findings: 3,
        high_count: 1,
        medium_count: 2,
        merge_recommendation: 'Merge blocked',
      }),
    );

    expect(result?.overall_assessment).toBe(
      'This PR contains 1 high-severity issue and 2 medium-severity issues. Weak validation is the main theme.',
    );
  });
});
