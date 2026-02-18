import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AGENT_OUTPUT_SCHEMA_PROMPT, type AgentOutput } from 'shared';
import { callWithValidationRetry } from './agent-validation.utils';

const CODE_QUALITY_SYSTEM_PROMPT = `You are a code quality reviewer. Analyze pull request diffs for style issues, readability, maintainability, potential bugs, and adherence to best practices.

You must respond with valid JSON only, no markdown, no code fence. Match the given schema exactly.`;

@Injectable()
export class CodeQualityAgent {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required for Code Quality Agent');
      }
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  /**
   * Runs the Code Quality Agent on a PR diff.
   * Returns structured findings and summary matching the agent output schema.
   * On validation failure, retries up to 2 times with "invalid JSON" message before throwing.
   */
  async run(prDiff: string): Promise<AgentOutput> {
    const client = this.getClient();
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

    const userPrompt = `Schema (respond with a single JSON object only): ${AGENT_OUTPUT_SCHEMA_PROMPT}

PR diff:
\`\`\`diff
${prDiff}
\`\`\`

Analyze the diff for code quality issues and return one JSON object.`;

    const result = await callWithValidationRetry({
      client,
      model,
      messages: [
        { role: 'system', content: CODE_QUALITY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      agentName: 'Code Quality',
    });
    return result.output;
  }
}
