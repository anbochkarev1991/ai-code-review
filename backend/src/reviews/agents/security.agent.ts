import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AGENT_OUTPUT_SCHEMA_PROMPT, type AgentOutput } from 'shared';
import { callWithValidationRetry } from './agent-validation.utils';
// TODO: Remove mock import once correct OpenAI API key is configured
import {
  MOCK_SECURITY_RESPONSE,
  shouldUseMockResponses,
} from './mock-responses';

const SECURITY_SYSTEM_PROMPT = `You are a security reviewer. Analyze pull request diffs for security vulnerabilities: injection (SQL, command, XSS), insecure authentication, exposed secrets, insecure defaults, authorization bypasses, and unsafe data handling.

You must respond with valid JSON only, no markdown, no code fence. Match the given schema exactly.`;

@Injectable()
export class SecurityAgent {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required for Security Agent');
      }
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  /**
   * Runs the Security Agent on a PR diff.
   * Returns structured findings and summary matching the agent output schema.
   * On validation failure, retries up to 2 times with "invalid JSON" message before throwing.
   */
  async run(prDiff: string, repoFullName?: string, prNumber?: number): Promise<AgentOutput> {
    // TODO: Remove mock response check once correct OpenAI API key is configured
    if (shouldUseMockResponses(repoFullName, prNumber)) {
      return MOCK_SECURITY_RESPONSE;
    }

    const client = this.getClient();
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

    const userPrompt = `Schema (respond with a single JSON object only): ${AGENT_OUTPUT_SCHEMA_PROMPT}

PR diff:
\`\`\`diff
${prDiff}
\`\`\`

Analyze the diff for security issues and return one JSON object.`;

    const result = await callWithValidationRetry({
      client,
      model,
      messages: [
        { role: 'system', content: SECURITY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      agentName: 'Security',
    });
    return result.output;
  }
}
