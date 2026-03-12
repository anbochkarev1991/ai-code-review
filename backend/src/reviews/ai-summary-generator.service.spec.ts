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
    const validResponse = {
      overall_assessment: 'This PR introduces reliability risks.',
      key_concerns: ['Error handling gaps', 'Validation issues'],
      recommendation: 'Address error handling before merge.',
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validResponse) } }],
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

    expect(result).toEqual(validResponse);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    type CreateCallArg = { messages: Array<{ content?: string }> };
    const calls = mockCreate.mock.calls as CreateCallArg[][];
    const userContent = calls[0]?.[0]?.messages[1]?.content ?? '';
    expect(userContent).toContain('Missing error handling');
    expect(userContent).toContain('Risk score: 65');
    expect(userContent).toContain('Merge with caution');
  });

  it('caps key_concerns at 4 items', async () => {
    const response = {
      overall_assessment: 'Summary',
      key_concerns: ['a', 'b', 'c', 'd', 'e'],
      recommendation: 'Fix issues.',
    };
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(response) } }],
    });

    const result = await service.generate([], makeReviewSummary({}));

    expect(result?.key_concerns).toHaveLength(4);
    expect(result?.key_concerns).toEqual(['a', 'b', 'c', 'd']);
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
});
