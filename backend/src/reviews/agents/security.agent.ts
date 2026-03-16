import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AGENT_OUTPUT_SCHEMA_PROMPT } from 'shared';
import type { ExpandedFile } from '../../types';
import {
  callWithValidationRetry,
  type CallWithValidationRetryResult,
} from './agent-validation.utils';
import { AgentContextShaper } from '../agent-context-shaper';

const SECURITY_SYSTEM_PROMPT = `You are a senior application security reviewer.

Your task is to detect real security vulnerabilities introduced or exposed by the code changes in this pull request.

Focus only on security issues: open redirects, unsafe redirects, injection vulnerabilities, authentication or authorization bypass, sensitive data exposure, unsafe use of untrusted input. Do not report general code quality issues unless they have clear security impact.

DIFF-FIRST — Keep this behavior:
- Start from the changed hunks (lines with "+" are added, "-" are removed). Every finding must be grounded in the diff.
- Do not explore unrelated files or random parts of the repository.
- Do not invent issues based on speculation outside the changed code.

ALLOWED LOCAL CONTEXT — Use only when needed to understand the change:
- The surrounding function, block, or request handler; variables and inputs used in the changed lines; validation or helpers directly called.
- Use the context lines in each hunk. This enables detecting unsafe redirects, validation gaps, and untrusted data flow. Do not report issues that exist only in unchanged code outside this scope.

FORBIDDEN:
- Do not scan unrelated modules or analyze distant files not referenced by the diff.
- Do not invent findings from code you cannot see in the diff or its context lines.

CONFIDENCE:
- If a finding depends heavily on code outside the diff and the allowed local context, either set confidence below 0.5 or omit the finding.
- Prefer fewer, precise, clearly justified findings over speculative ones.

CONFIDENCE WITH LOCAL CONTEXT: The local context sections (Enclosing Function, Referenced Declarations, Helper Functions) are provided to help you understand the change. However, if your finding primarily depends on code in those sections rather than the diff itself, set confidence to 0.5 or below. Findings must still be grounded in the changed lines.

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

  constructor(private readonly contextShaper: AgentContextShaper) {}

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

  async run(files: ExpandedFile[]): Promise<CallWithValidationRetryResult> {
    const client = this.getClient();
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

    const diffContent = this.contextShaper.formatForAgent(
      files,
      'security',
      4500,
    );

    const userPrompt = `Respond with a single JSON object matching this schema: ${AGENT_OUTPUT_SCHEMA_PROMPT}

Changed files in this Pull Request:
${diffContent}

Analyze the changed lines and their local context (surrounding function, inputs, and validation) for security vulnerabilities. Reference only file paths and line numbers from the diff hunks. Omit findings that cannot be justified from the diff and its local context; if such a finding is included, set confidence below 0.5. Set "category" to "security" for all findings. If no security issues exist, return empty findings array.`;

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
