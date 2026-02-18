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

export function parseAndValidate(
  raw: string,
): { success: true; data: AgentOutput } | { success: false; error: string } {
  try {
    const parsed = parseJson(raw);
    const result = agentOutputSchema.safeParse(parsed);
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
    const completion = await client.chat.completions.create({
      model,
      messages: currentMessages,
    });

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
