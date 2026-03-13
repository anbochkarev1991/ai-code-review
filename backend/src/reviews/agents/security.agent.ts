import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AGENT_OUTPUT_SCHEMA_PROMPT } from 'shared';
import type { ParsedFile } from '../../types';
import {
  callWithValidationRetry,
  type CallWithValidationRetryResult,
} from './agent-validation.utils';
import { DiffParser } from '../diff-parser';

const SECURITY_SYSTEM_PROMPT = `You are a senior application security reviewer.

Your task is to detect real security vulnerabilities introduced or exposed by the code changes in this pull request.

Focus only on security issues: open redirects, unsafe redirects, injection vulnerabilities, authentication or authorization bypass, sensitive data exposure, unsafe use of untrusted input. Do not report general code quality issues unless they have clear security impact.

You are given ONLY the changed hunks from the PR. Lines with "+" are added, "-" are removed. Analyze only changed lines; do not hallucinate code not in the diff.

Security review method:
1. Identify trust boundaries. Treat as untrusted: query parameters, request body, headers, cookies, user input, external APIs, backend responses.
2. Track how these values are used.
3. Report a vulnerability when untrusted values reach security-sensitive operations.

Redirect logic is especially important. A redirect is potentially unsafe when its target comes from untrusted input. Common redirect sinks: new URL(value, origin), window.location, location.href, redirect(...), res.redirect(...). If the redirect target can be influenced by user input or external data and is not validated against same-origin, allowlisted domains, or https scheme, report a potential open redirect. Do not report if the redirect target is constant or already validated.

For each finding include: title, file and location, explanation, why the input is untrusted, potential impact, suggested fix. Use the schema's "impact" field for potential impact. Be conservative: if uncertain, set confidence below 0.5. Do not flag process.env references or test-file secrets unless real credentials.

Respond with valid JSON only, no markdown, no code fence. Match the given schema exactly.`;

@Injectable()
export class SecurityAgent {
  private client: OpenAI | null = null;

  constructor(private readonly diffParser: DiffParser) {}

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

  async run(files: ParsedFile[]): Promise<CallWithValidationRetryResult> {
    const client = this.getClient();
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

    const diffContent = this.diffParser.formatForPrompt(files, 3500);

    const userPrompt = `Respond with a single JSON object matching this schema: ${AGENT_OUTPUT_SCHEMA_PROMPT}

Changed files in this Pull Request:
${diffContent}

Analyze ONLY the changed lines for security vulnerabilities. For each finding, reference the exact file path and line number from the diff. Set "category" to "security" for all findings. If no security issues exist, return empty findings array.`;

    return callWithValidationRetry({
      client,
      model,
      messages: [
        { role: 'system', content: SECURITY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      agentName: 'Security',
      promptSizeChars: SECURITY_SYSTEM_PROMPT.length + userPrompt.length,
    });
  }
}
