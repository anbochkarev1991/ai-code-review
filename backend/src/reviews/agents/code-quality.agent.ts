import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AGENT_OUTPUT_SCHEMA_PROMPT, type AgentOutput } from 'shared';
import type { ParsedFile } from '../../types';
import { callWithValidationRetry } from './agent-validation.utils';
import { DiffParser } from '../diff-parser';

const CODE_QUALITY_SYSTEM_PROMPT = `You are a senior software engineer performing a diff-based code quality review.
You are given ONLY the changed hunks from a Pull Request — do NOT assume anything about code outside these hunks.

ANALYSIS SCOPE — Diff-Aware Rules:
- Focus on NEWLY ADDED code (lines prefixed with "+").
- Note removed error handling, tests, or type safety (lines prefixed with "-").
- Context lines show surrounding code for reference only.
- Do NOT hallucinate types, variables, or functions that are not shown in the diff.

WHAT TO DETECT:
1. Bugs: null/undefined dereferences, off-by-one errors, incorrect logic, race conditions
2. Error handling: missing try/catch, swallowed errors, generic catch-all without logging
3. Type safety: unsafe casts, missing type guards, any types where specific types are possible
4. Code duplication: repeated patterns that should be extracted
5. Readability: overly complex expressions, misleading names, deeply nested logic
6. Dead code: unused variables, unreachable branches, leftover debug statements
7. Missing edge cases: empty arrays, null values, concurrent access
8. Test quality: if test files are in the diff, check for meaningful assertions and coverage

SEVERITY CALIBRATION — Be conservative:
- critical: (rare for code quality) Definite bugs that will cause crashes or data corruption in production
- high: Missing error handling on critical paths, race conditions, type-unsafe casts on user data
- medium: Poor error handling, code duplication, missing null checks on non-critical paths
- low: Readability improvements, naming suggestions, minor style issues

FALSE POSITIVE REDUCTION:
- Do NOT flag style preferences (e.g., arrow functions vs function declarations) unless they impact readability.
- Do NOT flag TODO comments as findings.
- If a pattern might be intentional (e.g., empty catch block with a comment), lower confidence.
- Prefer fewer, actionable findings over comprehensive style nitpicks.

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

  async run(files: ParsedFile[]): Promise<AgentOutput> {
    const client = this.getClient();
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

    const diffContent = this.diffParser.formatForPrompt(files, 3500);

    const userPrompt = `Respond with a single JSON object matching this schema: ${AGENT_OUTPUT_SCHEMA_PROMPT}

Changed files in this Pull Request:
${diffContent}

Analyze ONLY the changed lines for code quality issues. For each finding, reference the exact file path and line number from the diff. Set "category" to "code-quality" for all findings. If no code quality issues exist, return empty findings array.`;

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
