import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AGENT_OUTPUT_SCHEMA_PROMPT } from 'shared';
import type { ExpandedFile } from '../../types';
import {
  callWithValidationRetry,
  type CallWithValidationRetryResult,
} from './agent-validation.utils';
import { AgentContextShaper } from '../agent-context-shaper';
import { FINDING_STYLE_GUIDE } from './finding-style-guide';

const CODE_QUALITY_SYSTEM_PROMPT = `You are a senior code quality reviewer performing a diff-based code review.
Always start from the changed lines in the PR diff; findings must be grounded in the diff.

DIFF-FIRST — Keep this behavior:
- Base every finding on the changed lines (prefix "+" or "-") or on code that is clearly visible in the hunks (context lines).
- Do not explore unrelated files or random parts of the repository.
- Do not invent issues based on speculation outside the changed code.

ALLOWED LOCAL CONTEXT — Use only when needed to understand the change:
- The surrounding function, block, or loop where the change happens.
- Variables and properties used or accessed in the changed lines.
- Helper functions or methods directly called from the changed code.
Use the context lines in each hunk for this. This enables detecting: missing null checks, incorrect assumptions about object structure, unused computation results, incorrect error handling, and similar issues that require understanding nearby code. Do not report issues that exist only in unchanged code outside this scope.

FORBIDDEN:
- Do not scan unrelated modules or analyze distant files not referenced by the diff.
- Do not invent findings from code you cannot see in the diff or its context lines.

CONFIDENCE:
- If a finding depends heavily on code outside the diff and the allowed local context above, either set confidence below 0.5 or omit the finding.
- Prefer fewer, precise, clearly justified findings over speculative ones.

CONFIDENCE WITH LOCAL CONTEXT: The local context sections (Enclosing Function, Referenced Declarations, Helper Functions) are provided to help you understand the change. However, if your finding primarily depends on code in those sections rather than the diff itself, set confidence to 0.5 or below. Findings must still be grounded in the changed lines.

Focus on problems that could lead to:
- runtime errors
- fragile assumptions
- broken logic
- hidden failure states
- unnecessary complexity
- incorrect or inconsistent behavior

Do not report purely stylistic preferences or formatting issues.

NULL/UNDEFINED AND RUNTIME CORRECTNESS — Explicitly check for:

1. Property access on values that may be undefined or null.
   Example: \`pull.base.sha\` — verify that \`pull\` (and if relevant \`pull.base\`) is guaranteed to exist before accessing. If the value can be undefined or null (e.g. from an API, optional parameter, or conditional), flag missing guards.

2. Iterating over values that may be undefined or null.
   Example: \`for (const f of output.findings)\` — verify that \`output.findings\` is always defined (e.g. array) before iteration. If it can be undefined, iteration will throw at runtime; flag missing checks (e.g. optional chaining, default array, or explicit if).

3. Calling methods on values that may be undefined or null.
   Example: \`data.url.trim()\` — verify that \`data.url\` cannot be undefined or null before calling \`.trim()\`. Same for any method call on a property or variable that might be missing; flag missing validation or guards.

For each of these patterns, inspect the changed lines and their surrounding function/block to see where values come from (arguments, API response, previous assignment). Report a finding only when the code assumes existence without a visible guarantee.

Review method:

1. Examine assumptions the code makes about data and objects.
Check whether values might be null, undefined, malformed, or missing. Apply the three patterns above: property access, iteration, and method calls on possibly undefined values.

2. Verify that property access, iteration, and method calls are safe.
For every property access (e.g. \`obj.prop\`), iteration (e.g. \`for...of array\`), or method call (e.g. \`value.method()\`) in the changed code, confirm the base value is guaranteed to exist or is guarded; otherwise report it.

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

${FINDING_STYLE_GUIDE}

For each finding, set "file" and "line" from the diff; put the WHAT in "message", consequence in "impact", and the fix in "suggested_fix".

SEVERITY CALIBRATION — Be conservative:
- critical: Guaranteed crashes or data corruption (e.g. null dereference on hot path, unhandled exception that terminates process)
- high: Logic bugs that affect correctness, runtime crashes (undefined access, wrong branching)
- medium: Edge cases, poor error handling, issues that may cause incorrect behavior under specific conditions
- low: Minor issues, style preferences, clarity improvements

When uncertain, prefer lower severity. Do not inflate.

You must respond with valid JSON only, no markdown, no code fence. Match the given schema exactly.`;

@Injectable()
export class CodeQualityAgent {
  private client: OpenAI | null = null;

  constructor(private readonly contextShaper: AgentContextShaper) {}

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

  async run(files: ExpandedFile[]): Promise<CallWithValidationRetryResult> {
    const client = this.getClient();
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

    const diffContent = this.contextShaper.formatForAgent(
      files,
      'code-quality',
      4500,
    );

    const userPrompt = `Respond with a single JSON object matching this schema: ${AGENT_OUTPUT_SCHEMA_PROMPT}

Changed files in this Pull Request:
${diffContent}

Analyze the changed lines and their local context (surrounding function, variables, properties, and helpers used in the change) for code quality issues. Reference only file paths and line numbers from the diff hunks. Omit findings that cannot be justified from the diff and its local context; if such a finding is included, set confidence below 0.5. Set "category" to "code-quality" for all findings. If no code quality issues exist, return empty findings array.`;

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
