import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import {
  agentOutputSchema,
  AGENT_OUTPUT_SCHEMA_PROMPT,
  type AgentOutput,
} from 'shared';

const PERFORMANCE_SYSTEM_PROMPT = `You are a performance reviewer. Analyze pull request diffs for performance issues: algorithmic complexity, N+1 queries, unnecessary re-renders, memory leaks, inefficient loops, missing memoization, blocking operations, and scalability concerns.

You must respond with valid JSON only, no markdown, no code fence. Match the given schema exactly.`;

@Injectable()
export class PerformanceAgent {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required for Performance Agent');
      }
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  /**
   * Runs the Performance Agent on a PR diff.
   * Returns structured findings and summary matching the agent output schema.
   */
  async run(prDiff: string): Promise<AgentOutput> {
    const client = this.getClient();
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

    const userPrompt = `Schema (respond with a single JSON object only): ${AGENT_OUTPUT_SCHEMA_PROMPT}

PR diff:
\`\`\`diff
${prDiff}
\`\`\`

Analyze the diff for performance issues and return one JSON object.`;

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: PERFORMANCE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      throw new Error('Empty response from OpenAI');
    }

    const parsed = this.parseJson(raw);
    const result = agentOutputSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Performance Agent returned invalid JSON: ${result.error.message}`,
      );
    }

    return result.data;
  }

  private parseJson(raw: string): unknown {
    const stripped = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');
    return JSON.parse(stripped) as unknown;
  }
}
