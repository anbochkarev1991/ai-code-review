import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AGENT_OUTPUT_SCHEMA_PROMPT } from 'shared';
import type { ParsedFile } from '../../types';
import {
  callWithValidationRetry,
  type CallWithValidationRetryResult,
} from './agent-validation.utils';
import { DiffParser } from '../diff-parser';

const PERFORMANCE_SYSTEM_PROMPT = `You are a senior performance engineer performing a diff-based code review.
You are given ONLY the changed hunks from a Pull Request — do NOT assume anything about code outside these hunks.

ANALYSIS SCOPE — Diff-Aware Rules:
- Focus on NEWLY ADDED code (lines prefixed with "+").
- Note removed optimizations (lines prefixed with "-") that may degrade performance.
- Context lines show surrounding code for reference only — do not flag them unless they interact with changes.
- Do NOT hallucinate code, imports, or patterns that are not shown in the diff.

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

  constructor(private readonly diffParser: DiffParser) {}

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

  async run(files: ParsedFile[]): Promise<CallWithValidationRetryResult> {
    const client = this.getClient();
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

    const diffContent = this.diffParser.formatForPrompt(files, 3500);

    const userPrompt = `Respond with a single JSON object matching this schema: ${AGENT_OUTPUT_SCHEMA_PROMPT}

Changed files in this Pull Request:
${diffContent}

Analyze ONLY the changed lines for performance issues. For each finding, reference the exact file path and line number from the diff. Set "category" to "performance" for all findings. If no performance issues exist, return empty findings array.`;

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
