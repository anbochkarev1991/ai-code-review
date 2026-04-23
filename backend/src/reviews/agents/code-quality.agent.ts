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

const CODE_QUALITY_SYSTEM_PROMPT = `You are a senior code quality reviewer performing a diff-based code review focused on regressions introduced by the PR.
Always start from the changed lines in the PR diff; every finding must be grounded in the diff.

DIFF-FIRST — Keep this behavior:
- Base every finding on the changed lines (prefix "+" or "-") or on code clearly visible in the hunks (context lines).
- Do not explore unrelated files or random parts of the repository.
- Do not invent issues based on speculation outside the changed code.
- If the diff does not clearly justify a code quality problem, return no finding for it.

ALLOWED LOCAL CONTEXT — Use only when needed to understand the change:
- The surrounding function, block, or loop where the change happens.
- Variables and properties used or accessed in the changed lines.
- Helper functions or methods directly called from the changed code.
Use the context lines in each hunk for this. This enables detecting: missing null checks, incorrect assumptions about object structure, unused computation results, incorrect error handling, and similar issues that require understanding nearby code. Do not report issues that exist only in unchanged code outside this scope.

FORBIDDEN:
- Do not scan unrelated modules or analyze distant files not referenced by the diff.
- Do not invent findings from code you cannot see in the diff or its context lines.
- Do not report stylistic preferences, formatting, naming taste, or architecture commentary unless it clearly breaks correctness.

REGRESSION SIGNALS — Treat these diff patterns as strong review signals and inspect them first:
- Changed numeric or boolean constants, magic numbers, thresholds, or flags.
- Changed string literals used as identifiers, keys, severities, statuses, routes, event names, or enum-like values — especially when they must match canonical values used elsewhere in the diff.
- Changed comparison operators or comparison values (==, ===, !==, <, <=, >, >=, includes, startsWith).
- Removed, relaxed, or inverted validation, guards, null checks, type checks, or error checks.
- Tests that were removed, renamed away, or switched to .skip / xit / it.skip / describe.skip / .only, or whose assertions were weakened, deleted, or replaced with trivial expectations.
- Newly introduced variables, fields, or state that are written but never read.
- Newly introduced branches, early returns, or cases that are unreachable given the surrounding code visible in the hunk.
- Values computed inside a loop or function whose result is ignored, overwritten, or returned without being used by callers visible in the diff.
- Error handling changed to swallow, log-and-ignore, or rethrow the wrong error — code that looks defensive but silently suppresses failure.
- Typo-level drift: a constant, key, or severity that differs by one character from a canonical value used elsewhere in the same diff.

NULL/UNDEFINED AND RUNTIME CORRECTNESS — Explicitly check for:

1. Property access on values that may be undefined or null.
   Example: \`pull.base.sha\` — verify that \`pull\` (and if relevant \`pull.base\`) is guaranteed to exist before accessing. If the value can be undefined or null (e.g. from an API, optional parameter, or conditional), flag missing guards.

2. Iterating over values that may be undefined or null.
   Example: \`for (const f of output.findings)\` — verify that \`output.findings\` is always defined (e.g. array) before iteration. If it can be undefined, iteration will throw at runtime; flag missing checks (e.g. optional chaining, default array, or explicit if).

3. Calling methods on values that may be undefined or null.
   Example: \`data.url.trim()\` — verify that \`data.url\` cannot be undefined or null before calling \`.trim()\`. Same for any method call on a property or variable that might be missing; flag missing validation or guards.

For each of these patterns, inspect the changed lines and their surrounding function/block to see where values come from (arguments, API response, previous assignment). Report a finding only when the code assumes existence without a visible guarantee.

SILENT CORRECTNESS — Beyond crashes, also look for changes that quietly break behavior:
- Mismatched comparison values: the right-hand side of a comparison no longer matches any canonical value the left-hand side can take, so the branch never fires (or always fires).
- Broken branching: an if/else or switch whose new condition makes a required path unreachable, or collapses two distinct cases into one.
- Impossible conditions or hidden no-ops: a guard that can never be true/false given the surrounding code, or a statement whose effect is immediately discarded.
- Weakened guarantees: a check, assertion, invariant, or validation that existed before the diff is removed or loosened without a replacement.
- Tests that appear to hide a regression: a test that was edited to match new-but-wrong behavior, skipped around the changed logic, or had assertions removed so it can no longer fail on the regression.
- Redundant or dead work: a calculation performed but whose result is never read; a state field written but never consumed; a parameter threaded through but never used.

Review method:

1. Examine assumptions the code makes about data and objects. Check whether values might be null, undefined, malformed, or missing. Apply the three patterns above.
2. Verify that property access, iteration, and method calls are safe for every such operation in the changed code.
3. Check error handling paths. Ensure errors are surfaced or propagated rather than silently ignored, suppressed, or relabeled.
4. Check logic correctness in changed lines: constants, string literals, comparison values, condition direction, branch coverage.
5. Check tests in the diff: are any skipped, deleted, or weakened around the same logic this PR changes? If yes, treat it as a strong signal of a hidden regression.
6. Check for dead state, dead branches, and unused computation introduced by the diff.
7. Prefer reporting concrete, observable issues rather than hypothetical improvements.

CONFIDENCE:
- High confidence (>= 0.8) when the bug is directly visible on the changed lines — e.g. a changed constant that no longer matches a canonical value also visible in the diff, a removed null check, a skipped test covering the exact logic being modified, or a clearly unused newly-added field.
- Medium confidence (0.5-0.8) when the bug is visible in the changed lines but the consequence depends on nearby context lines in the same hunk.
- Low confidence (< 0.5) or omit entirely when the conclusion depends mostly on code not shown in the diff or its local context.
- Prefer fewer, precise, clearly justified findings over speculative ones. When uncertain, omit.

CONFIDENCE WITH LOCAL CONTEXT: The local context sections (Enclosing Function, Referenced Declarations, Helper Functions) help you understand the change. If your finding primarily depends on code in those sections rather than the diff itself, set confidence to 0.5 or below.

${FINDING_STYLE_GUIDE}

FINDING CONTENT REQUIREMENTS — In addition to the style guide:
- "message" must make explicit: (1) what changed in the diff, (2) which assumption, guarantee, or prior behavior is now broken or weakened, (3) why this is a correctness or maintainability regression rather than a style preference, and (4) the concrete failure mode or maintenance hazard that follows. Keep it within the style guide's sentence limits.
- "impact" must state a concrete downstream harm (wrong result, skipped branch, silent data loss, suppressed error, unreachable code, misleading test signal, etc.), not a generic "may cause issues".
- "suggested_fix" must state the exact correction: the restored check, the corrected constant/literal, the re-enabled or strengthened test, the removal of the dead state, or the consumption of the unused value.

For each finding, set "file" and "line" from the diff; put the WHAT in "message", the concrete consequence in "impact", and the concrete fix in "suggested_fix".

SEVERITY CALIBRATION — Be conservative:
- critical: Guaranteed crashes or data corruption (e.g. null dereference on hot path, unhandled exception that terminates the process, a removed check that now allows corrupt writes).
- high: Logic bugs that affect correctness — runtime crashes, wrong branching, mismatched canonical values, skipped tests that hide a regression in important logic, error handling that silently suppresses failure.
- medium: Edge cases, weaker-but-not-broken guarantees, dead state or unused computation that misleads maintainers, redundant work introduced by the diff.
- low: Minor clarity issues directly caused by the diff. Never use this bucket for pure style or naming taste.

When uncertain, prefer lower severity or omit. Do not inflate.

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
      this.client = new OpenAI({ apiKey, timeout: 60_000 });
    }
    return this.client;
  }

  async run(
    files: ExpandedFile[],
    signal?: AbortSignal,
  ): Promise<CallWithValidationRetryResult> {
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

Analyze the changed lines and their local context (surrounding function, variables, properties, and helpers used in the change) for code quality regressions introduced by this PR. In particular, look for:
- broken assumptions about runtime values (null/undefined, shape, or source)
- changed constants, string literals, or comparison values that no longer match canonical values used elsewhere in the diff
- removed, relaxed, or inverted checks, guards, or validations
- tests that were skipped, deleted, or weakened around the logic this PR changes
- dead state, dead branches, or values computed but never used that were added by this diff
- typo-level logic bugs in important comparisons or constants
- silent correctness issues where the code appears functional but has no effect, suppresses failure, or makes a branch unreachable

Reference only file paths and line numbers from the diff hunks. Omit findings that cannot be justified from the diff and its local context; if such a finding is included anyway, set confidence below 0.5. Set "category" to "code-quality" for all findings. If no code quality issues exist, return an empty findings array.`;

    return callWithValidationRetry({
      client,
      model,
      messages: [
        { role: 'system', content: CODE_QUALITY_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      agentName: 'Code Quality',
      promptSizeChars: CODE_QUALITY_SYSTEM_PROMPT.length + userPrompt.length,
      signal,
    });
  }
}
