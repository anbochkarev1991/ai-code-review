import { HttpException, HttpStatus } from '@nestjs/common';
import OpenAI from 'openai';
import {
  agentOutputSchema,
  AGENT_OUTPUT_SCHEMA_PROMPT,
  type AgentOutput,
} from 'shared';

const MAX_RETRIES = 2;
const INVALID_JSON_MESSAGE = `Your previous response was invalid JSON. Please respond with valid JSON only, matching this schema: ${AGENT_OUTPUT_SCHEMA_PROMPT}`;

function parseJson(raw: string): unknown {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(stripped) as unknown;
}

const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);

/**
 * Normalizes common LLM output quirks before Zod validation:
 * - Coerces numeric `id` to string
 * - Lowercases `severity` enum values
 * - Coerces string `confidence` to number
 */
function normalizeLlmOutput(parsed: unknown): unknown {
  if (typeof parsed !== 'object' || parsed === null) return parsed;
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.findings)) return parsed;

  obj.findings = obj.findings.map((finding: unknown) => {
    if (typeof finding !== 'object' || finding === null) return finding;
    const f = finding as Record<string, unknown>;

    if (typeof f.id === 'number') {
      f.id = String(f.id);
    }

    if (typeof f.severity === 'string' && !VALID_SEVERITIES.has(f.severity)) {
      f.severity = f.severity.toLowerCase();
    }

    if (f.confidence === null) {
      delete f.confidence;
    } else if (typeof f.confidence === 'string') {
      const num = parseFloat(f.confidence);
      if (!isNaN(num)) {
        f.confidence = num;
      } else {
        delete f.confidence;
      }
    }

    return f;
  });

  return obj;
}

export function parseAndValidate(
  raw: string,
): { success: true; data: AgentOutput } | { success: false; error: string } {
  try {
    const parsed = parseJson(raw);
    const normalized = normalizeLlmOutput(parsed);
    const result = agentOutputSchema.safeParse(normalized);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error.message };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: message };
  }
}

export interface CallWithValidationRetryOptions {
  client: OpenAI;
  model: string;
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  agentName: string;
}

export interface CallWithValidationRetryResult {
  output: AgentOutput;
  rawContent: string;
  tokensUsed?: number;
}

/**
 * Calls OpenAI chat completion, parses and validates the response with Zod.
 * On validation failure, retries up to MAX_RETRIES (2) times with an "invalid JSON" message.
 * After retries are exhausted, throws so the pipeline can mark the step as failed in the trace.
 * Returns output, raw content, and token usage for trace recording.
 */
export async function callWithValidationRetry(
  options: CallWithValidationRetryOptions,
): Promise<CallWithValidationRetryResult> {
  const { client, model, messages, agentName } = options;
  let currentMessages = [...messages];
  let lastError = '';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let completion: OpenAI.Chat.ChatCompletion;
    try {
      completion = await client.chat.completions.create({
        model,
        messages: currentMessages,
      });
    } catch (err) {
      // Handle OpenAI API errors
      if (err instanceof OpenAI.APIError) {
        if (err.status === 429) {
          throw new HttpException(
            `OpenAI API quota exceeded. ${err.message || 'Please check your OpenAI plan and billing details.'}`,
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        if (err.status === 401) {
          throw new HttpException(
            `OpenAI API authentication failed: ${err.message || 'Invalid API key'}`,
            HttpStatus.UNAUTHORIZED,
          );
        }
        if (err.status === 500 || err.status === 503) {
          throw new HttpException(
            `OpenAI API service unavailable: ${err.message || 'Please try again later'}`,
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
        // Other OpenAI API errors
        throw new HttpException(
          `OpenAI API error (${err.status}): ${err.message || 'Unknown error'}`,
          HttpStatus.BAD_GATEWAY,
        );
      }
      // Re-throw non-OpenAI errors
      throw err;
    }

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      throw new Error(`${agentName} Agent returned empty response from OpenAI`);
    }

    const validated = parseAndValidate(raw);
    if (validated.success) {
      const tokensUsed = completion.usage?.total_tokens;
      return {
        output: validated.data,
        rawContent: raw,
        tokensUsed,
      };
    }

    lastError = validated.error;
    if (attempt < MAX_RETRIES) {
      currentMessages = [
        ...currentMessages,
        { role: 'user' as const, content: INVALID_JSON_MESSAGE },
      ];
    }
  }

  throw new Error(
    `${agentName} Agent returned invalid JSON after ${MAX_RETRIES + 1} attempts: ${lastError}`,
  );
}
