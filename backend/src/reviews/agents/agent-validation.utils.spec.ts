import type OpenAI from 'openai';
import {
  parseAndValidate,
  callWithValidationRetry,
  type CallWithValidationRetryOptions,
} from './agent-validation.utils';

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

function createMockClient(): OpenAI {
  return {
    chat: {
      completions: {
        create: mockCreate as OpenAI['chat']['completions']['create'],
      },
    },
  } as OpenAI;
}

describe('agent-validation.utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseAndValidate', () => {
    it('returns success for valid schema', () => {
      const raw = JSON.stringify({
        findings: [
          {
            id: 'f1',
            title: 'Test',
            severity: 'medium',
            category: 'test',
            message: 'Message',
          },
        ],
        summary: 'Summary',
      });
      const result = parseAndValidate(raw);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.findings).toHaveLength(1);
        expect(result.data.summary).toBe('Summary');
      }
    });

    it('returns failure for invalid schema', () => {
      const raw = JSON.stringify({
        findings: [{ invalid: 'structure' }],
        summary: null,
      });
      const result = parseAndValidate(raw);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }
    });

    it('returns failure for malformed JSON', () => {
      const result = parseAndValidate('not json {');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('JSON');
      }
    });

    it('strips markdown code fences', () => {
      const valid = { findings: [], summary: 'ok' };
      const raw = '```json\n' + JSON.stringify(valid) + '\n```';
      const result = parseAndValidate(raw);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(valid);
      }
    });
  });

  describe('callWithValidationRetry', () => {
    const validResponse = {
      findings: [
        {
          id: 'f1',
          title: 'Test',
          severity: 'low',
          category: 'test',
          message: 'Msg',
        },
      ],
      summary: 'Summary',
    };

    const getOptions = (): CallWithValidationRetryOptions => ({
      client: createMockClient(),
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'User' },
      ],
      agentName: 'TestAgent',
    });

    it('returns validated output on first attempt', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(validResponse) } }],
      });

      const result = await callWithValidationRetry(getOptions());

      expect(result).toEqual(validResponse);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('retries on invalid JSON and succeeds on second attempt', async () => {
      mockCreate
        .mockResolvedValueOnce({
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
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: JSON.stringify(validResponse) } }],
        });

      const result = await callWithValidationRetry(getOptions());

      expect(result).toEqual(validResponse);
      expect(mockCreate).toHaveBeenCalledTimes(2); // First failed validation, retry succeeded
    });

    it('retries up to 2 times then throws', async () => {
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

      await expect(callWithValidationRetry(getOptions())).rejects.toThrow(
        'TestAgent Agent returned invalid JSON after 3 attempts',
      );
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it('throws on empty response', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '' } }],
      });

      await expect(callWithValidationRetry(getOptions())).rejects.toThrow(
        'TestAgent Agent returned empty response from OpenAI',
      );
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });
});
