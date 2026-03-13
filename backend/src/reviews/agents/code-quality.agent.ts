import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AGENT_OUTPUT_SCHEMA_PROMPT } from 'shared';
import type { ParsedFile } from '../../types';
import {
  callWithValidationRetry,
  type CallWithValidationRetryResult,
} from './agent-validation.utils';
import { DiffParser } from '../diff-parser';

const CODE_QUALITY_SYSTEM_PROMPT = `You are a senior code quality reviewer performing a diff-based code review.
You are given ONLY the changed hunks from a Pull Request — do NOT assume anything about code outside these hunks.

DIFF SCOPE — Primary rules:
- Review only changed lines (prefix "+" or "-") and their immediate local context (same hunk or directly adjacent lines).
- You may use nearby unchanged lines only when needed to understand the changed code.
- Do NOT explore unrelated unchanged files or distant unchanged code to invent findings.
- If a finding depends materially on code outside the diff, either omit it or set confidence low (e.g. below 0.5) and treat it as supplemental context only.
- Prefer precise, diff-grounded findings; prefer fewer but better findings over speculative ones.

Focus on problems that could lead to:
- runtime errors
- fragile assumptions
- broken logic
- hidden failure states
- unnecessary complexity
- incorrect or inconsistent behavior

Do not report purely stylistic preferences or formatting issues.

Review method:

1. Examine assumptions the code makes about data and objects.
Check whether values might be null, undefined, malformed, or missing.

2. Verify that property access, iteration, and method calls are safe.
Look for cases where the code assumes an object structure without validating it.

3. Check error handling paths.
Ensure that errors are properly handled, surfaced, or propagated rather than silently ignored.

4. Look for logic mistakes that could break behavior.
Examples include: incorrect string literals, mismatched constants, incorrect condition checks, inconsistent comparison values.

5. Look for inefficient or unnecessary work that harms clarity or performance.
Examples include redundant calculations, repeated expensive calls, or unused results.

6. Prefer reporting concrete, observable issues rather than hypothetical improvements.

Do not report:
- style-only concerns
- naming preferences
- architectural discussions unless they clearly impact correctness

For each finding include: title, file and location, explanation, why the code may fail or behave incorrectly, potential impact, suggested fix.
Keep findings concise and practical.

SEVERITY: critical (crashes/data corruption), high (critical path failures), medium (poor handling/edge cases), low (minor). Be conservative.

You must respond with valid JSON only, no markdown, no code fence. Match the given schema exactly.`;

@Injectable()
export class CodeQualityAgent {
  private client: OpenAI | null = null;

  constructor(private readonly diffParser: DiffParser) {}

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

  async run(files: ParsedFile[]): Promise<CallWithValidationRetryResult> {
    const client = this.getClient();
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

    const diffContent = this.diffParser.formatForPrompt(files, 3500);

    const userPrompt = `Respond with a single JSON object matching this schema: ${AGENT_OUTPUT_SCHEMA_PROMPT}

Changed files in this Pull Request:
${diffContent}

Analyze ONLY the changed lines and their immediate context for code quality issues. For each finding, reference only file path and line number that appear in the diff hunks above (or directly adjacent context). Omit findings that cannot be justified from the changed lines or their immediate context. Set "category" to "code-quality" for all findings. If no code quality issues exist, return empty findings array.`;

    return callWithValidationRetry({
      client,
      model,
      messages: [
        { role: 'system', content: CODE_QUALITY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      agentName: 'Code Quality',
      promptSizeChars: CODE_QUALITY_SYSTEM_PROMPT.length + userPrompt.length,
    });
  }
}
