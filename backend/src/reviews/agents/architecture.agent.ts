import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import {
  agentOutputSchema,
  AGENT_OUTPUT_SCHEMA_PROMPT,
  type AgentOutput,
} from 'shared';

const ARCHITECTURE_SYSTEM_PROMPT = `You are an architecture reviewer. Analyze pull request diffs for structural issues: design patterns, layering, boundaries, modularity, coupling, cohesion, separation of concerns, and potential circular dependencies.

You must respond with valid JSON only, no markdown, no code fence. Match the given schema exactly.`;

@Injectable()
export class ArchitectureAgent {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required for Architecture Agent');
      }
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  /**
   * Runs the Architecture Agent on a PR diff.
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

Analyze the diff for architecture and structural issues and return one JSON object.`;

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: ARCHITECTURE_SYSTEM_PROMPT },
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
        `Architecture Agent returned invalid JSON: ${result.error.message}`,
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
