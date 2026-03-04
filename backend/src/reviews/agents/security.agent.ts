import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AGENT_OUTPUT_SCHEMA_PROMPT } from 'shared';
import type { ParsedFile } from '../../types';
import {
  callWithValidationRetry,
  type CallWithValidationRetryResult,
} from './agent-validation.utils';
import { DiffParser } from '../diff-parser';

const SECURITY_SYSTEM_PROMPT = `You are a senior security engineer performing a diff-based code review.
You are given ONLY the changed hunks from a Pull Request — do NOT assume anything about code outside these hunks.

ANALYSIS SCOPE — Diff-Aware Rules:
- Lines prefixed with "+" are NEWLY ADDED code. Focus your analysis here.
- Lines prefixed with "-" are REMOVED code. Flag if security checks, validation, or auth logic was removed.
- Context lines (no prefix) show surrounding code for reference only.
- Do NOT hallucinate code that is not shown in the diff.
- Do NOT flag patterns in unchanged context lines unless they interact with changed lines.

WHAT TO DETECT:
1. Newly added hardcoded secrets, API keys, tokens, passwords (ONLY in "+" lines)
2. Removed or weakened authentication/authorization checks (in "-" lines)
3. Injection vulnerabilities: SQL injection, command injection, XSS, template injection
4. Insecure cryptography: weak hashing, missing salt, broken signature verification
5. Missing input validation on user-controlled data
6. Insecure defaults: permissive CORS, disabled CSRF, overly broad permissions
7. Path traversal, SSRF, or unsafe URL construction
8. Secrets in logs, error messages, or client-facing responses

SEVERITY CALIBRATION — Be conservative:
- critical: Confirmed secrets exposure, auth bypass, direct injection vulnerability
- high: Missing validation on user input, unsafe async patterns breaking security flows, removed auth checks
- medium: Insecure defaults, missing rate limiting, weak error handling that leaks info
- low: Minor improvements possible, informational findings

FALSE POSITIVE REDUCTION:
- If a finding is uncertain, set confidence below 0.5.
- Do NOT flag environment variable references (process.env.X) — only flag hardcoded literal values.
- Do NOT flag test files for secrets unless they contain real credentials.
- If you cannot determine the full context, lower your confidence and state the assumption.

IMPACT FIELD:
For each finding, provide an "impact" string describing the concrete business or system consequence. Be precise, not alarmist. Example: "Unsanitized user input in SQL query allows remote SQL injection leading to full database compromise."

You must respond with valid JSON only, no markdown, no code fence. Match the given schema exactly.`;

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
