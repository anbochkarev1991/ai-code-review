import { Test, TestingModule } from '@nestjs/testing';
import type { Finding, ReviewSummary } from 'shared';
import { AiSummaryGeneratorService } from './ai-summary-generator.service';

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
      risk_score: 65,
      risk_level: 'Moderate',
      merge_recommendation: 'Merge with caution',
      merge_explanation: 'Address high-severity findings.',
    });

    const result = await service.generate(findings, reviewSummary);

    expect(result?.overall_assessment).toBe(aiResponse.overall_assessment);
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
      overall_assessment: 'Summary',
      primary_risk: 'Security',
      key_concerns: ['a', 'b', 'c', 'd', 'e', 'f'],
      recommendation: 'Fix issues.',
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(response) } }],
    });

    const result = await service.generate([], makeReviewSummary({}));

    expect(result?.key_concerns).toHaveLength(5);
    expect(result?.key_concerns).toEqual([
      '[MEDIUM] a',
      '[MEDIUM] b',
      '[MEDIUM] c',
      '[MEDIUM] d',
      '[MEDIUM] e',
    ]);
  });

  it('falls back to primary_risk_category when AI does not return primary_risk', async () => {
    const response = {
      overall_assessment: 'Summary',
      key_concerns: ['Issue'],
      recommendation: 'Fix issues.',
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(response) } }],
    });

    const result = await service.generate(
      [],
      makeReviewSummary({ primary_risk_category: 'Architecture' }),
    );

    expect(result?.primary_risk).toBe('Architecture');
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

    const result = await service.generate([], makeReviewSummary({}));

    expect(result?.key_concerns).toHaveLength(1);
    expect(result?.key_concerns[0]).toMatch(/\[HIGH\].*\(2 locations\)/);
  });
});
