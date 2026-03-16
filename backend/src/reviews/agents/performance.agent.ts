import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AGENT_OUTPUT_SCHEMA_PROMPT } from 'shared';
import type { ExpandedFile } from '../../types';
import {
  callWithValidationRetry,
  type CallWithValidationRetryResult,
} from './agent-validation.utils';
import { AgentContextShaper } from '../agent-context-shaper';

const PERFORMANCE_SYSTEM_PROMPT = `You are a senior performance engineer performing a diff-based code review.
Always start from the changed lines in the PR diff; findings must be grounded in the diff.

DIFF-FIRST — Keep this behavior:
- Base every finding on newly added code (lines prefixed with "+") or on removed optimizations (lines prefixed with "-").
- Do not explore unrelated files or random parts of the repository.
- Do not hallucinate code, imports, or patterns that are not shown in the diff.

ALLOWED LOCAL CONTEXT — Use only when needed to understand the change:
- The surrounding function, loop, or block; variables and data flow used in the changed lines; helpers or APIs directly called.
- Use the context lines in each hunk. Flag context lines only when they clearly interact with the change (e.g. loop body, hot path). Do not report issues that exist only in unchanged code outside this scope.

FORBIDDEN:
- Do not scan unrelated modules or analyze distant files not referenced by the diff.
- Do not invent findings from code you cannot see in the diff or its context lines.

CONFIDENCE:
- If a finding depends heavily on code outside the diff and the allowed local context, either set confidence below 0.5 or omit the finding.
- Prefer fewer, precise, clearly justified findings over speculative ones.

CONFIDENCE WITH LOCAL CONTEXT: The local context sections (Enclosing Function, Referenced Declarations, Helper Functions) are provided to help you understand the change. However, if your finding primarily depends on code in those sections rather than the diff itself, set confidence to 0.5 or below. Findings must still be grounded in the changed lines.

WHAT TO DETECT:
1. Algorithmic complexity: O(n²) loops, nested iterations over large collections
2. N+1 query patterns: database calls inside loops, missing batch operations
3. Memory leaks: unclosed resources, growing caches without bounds, event listener leaks
4. Unnecessary re-renders: missing memoization (React.memo, useMemo, useCallback), unstable references
5. Blocking operations: synchronous I/O on hot paths, CPU-heavy work on main thread
6. Missing pagination or unbounded queries
7. Inefficient data structures: repeated array lookups where Map/Set would be O(1)
8. Removed caching, memoization, or optimization that was previously present

SEVERITY CALIBRATION — Be conservative:
- critical: (rare for performance) Unbounded recursion, guaranteed OOM, blocking event loop in production
- high: N+1 queries, O(n²) on user-facing hot paths, memory leaks in long-lived processes
- medium: Missing memoization causing unnecessary re-renders, suboptimal algorithm on non-critical path
- low: Minor optimization opportunities, style preferences for perf

FALSE POSITIVE REDUCTION:
- If the code path is unlikely to handle large data, lower severity and confidence.
- Do NOT flag one-time initialization code as a hot-path performance issue.
- If you cannot determine data size or call frequency, set confidence below 0.6.

IMPACT FIELD:
For each finding, provide an "impact" string describing the concrete business or system consequence. Be precise, not alarmist. Example: "N+1 query pattern will cause O(n) database calls, degrading response time linearly with collection size."

You must respond with valid JSON only, no markdown, no code fence. Match the given schema exactly.`;

@Injectable()
export class PerformanceAgent {
  private client: OpenAI | null = null;

  constructor(private readonly contextShaper: AgentContextShaper) {}

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required for Performance Agent');
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
      'performance',
      4500,
    );

    const userPrompt = `Respond with a single JSON object matching this schema: ${AGENT_OUTPUT_SCHEMA_PROMPT}

Changed files in this Pull Request:
${diffContent}

Analyze the changed lines and their local context (surrounding function, loop, and data flow) for performance issues. Reference only file paths and line numbers from the diff hunks. Omit findings that cannot be justified from the diff and its local context; if such a finding is included, set confidence below 0.5. Set "category" to "performance" for all findings. If no performance issues exist, return empty findings array.`;

    return callWithValidationRetry({
      client,
      model,
      messages: [
        { role: 'system', content: PERFORMANCE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      agentName: 'Performance',
      promptSizeChars: PERFORMANCE_SYSTEM_PROMPT.length + userPrompt.length,
    });
  }
}
