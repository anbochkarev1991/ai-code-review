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

const PERFORMANCE_SYSTEM_PROMPT = `You are a senior performance engineer auditing this PR for concrete performance regressions introduced by the diff.
Always start from the changed lines; every finding must be grounded in the diff. Prefer regression detection over generic optimization advice.

DIFF-FIRST — Keep this behavior:
- Base every finding on newly added code (lines prefixed with "+") or on removed optimizations (lines prefixed with "-").
- Do not explore unrelated files or random parts of the repository.
- Do not hallucinate code, imports, or patterns that are not shown in the diff.
- If the diff does not clearly justify a performance regression, return no findings.

ALLOWED LOCAL CONTEXT — Use only when needed to understand the change:
- The surrounding function, loop, or block; variables and data flow used in the changed lines; helpers or APIs directly called.
- Use the context lines in each hunk. Flag context lines only when they clearly interact with the change (e.g. loop body, hot path). Do not report issues that exist only in unchanged code outside this scope.

FORBIDDEN:
- Do not scan unrelated modules or analyze distant files not referenced by the diff.
- Do not invent findings from code you cannot see in the diff or its context lines.
- Do not perform broad repo analysis, speculative scalability commentary, micro-optimizations, or vague "could be faster" suggestions.
- Do not flag ordinary small loops, maps, filters, or allocations unless the diff clearly adds repeated work, scaling cost, wasted work, I/O, or duplication of aggregate logic.

WHAT TO DETECT — Regression-oriented signals (strong signals when introduced by the diff):
1) Redundant computation: same or equivalent work done multiple times; per-item work added immediately before an existing aggregate/batch/scoring call that already covers the same data.
2) Discarded or unused expensive results: return values ignored from calls that by name or usage suggest aggregation, scoring, parsing, validation, network, I/O, DB, or heavy transforms; map/filter/reduce/sort whose result is not used; pure-looking or result-oriented calls used only for side effects when the result is thrown away.
3) Repeated expensive calls and N+1: DB/network/file/API calls inside loops; repeated JSON.parse/stringify, new RegExp, schema validation, hashing, or similar inside loops; repeated allocations or conversions inside loops when one pass or hoisting would suffice; per-item calls where one batched or aggregate call would be enough.
4) Algorithmic complexity regressions: work that scales worse with collection size (e.g. O(1) to O(n), O(n) to O(n log n) or O(n²)); nested loops over the same or related collections; repeated linear scans (e.g. find/includes on arrays) inside loops where a single index or Map/Set would remove the inner scan—only when the diff introduces the pattern.
5) Hot-path damage: expensive synchronous or blocking work added in request handlers, render paths, review pipelines, agent orchestration, retry paths, webhooks, or other high-frequency paths; cost that compounds with number of files, findings, agents, retries, user interactions, or rendered items when that coupling is visible in the diff or its local context.
6) Removed optimizations: caching, memoization, batching, pagination, short-circuits, or prior guards removed in the diff.

CONFIDENCE — Prefer fewer, precise findings:
- High (>= 0.8): Changed lines clearly add redundant work, discard an expensive-looking result, repeat expensive calls in a loop, or duplicate work that is also done in aggregate in the same visible scope.
- Medium (0.6–0.8): The diff strongly suggests wasted or scaling work, but cost depends on plausible-but-unconfirmed call frequency or data size inferable from names/context.
- Low (< 0.6) or omit: Performance impact depends mostly on unseen implementation details, the callee's cost is unclear, or input size / call frequency cannot be reasoned from the diff and context.
- If a finding depends heavily on code outside the diff and allowed local context, set confidence below 0.5 or omit the finding.

CONFIDENCE WITH LOCAL CONTEXT: Sections such as Enclosing Function, Referenced Declarations, and Helper Functions help you understand the change. If the finding primarily depends on those sections rather than the changed lines, set confidence to 0.5 or below. Findings must still be grounded in the changed lines.

SEVERITY CALIBRATION — Be conservative:
- critical (rare): Unbounded recursion, guaranteed OOM, or clearly blocking the event loop on a production hot path shown in the diff.
- high: N+1 or per-item I/O/DB/network in a loop; O(n²) or equivalent on a user-facing or high-frequency path; clear duplicate aggregate work; memory/resource leaks in long-lived processes when visible in the diff.
- medium: Missing memoization or suboptimal structure on non-critical paths when the diff clearly adds measurable repeated work.
- low: Clearly wasted computation on cold or rare paths only when the diff explicitly introduces discarded or redundant work.

FALSE POSITIVE RESISTANCE:
- Do not report tiny micro-optimizations unless the diff clearly introduces repeated or scaling work.
- Do not assume a function is expensive without evidence from its name, signature, call site, or visible usage in the diff/context.
- Do not flag one-time initialization as a hot-path issue.
- If the code path is unlikely to handle large data, lower severity and confidence.
- If you cannot determine data size or call frequency from the diff and context, set confidence below 0.6 and lower severity accordingly.

FINDING QUALITY — Each finding must be actionable and diff-grounded:
- "message" must explicitly cover: (1) what changed in the diff, (2) what work is repeated, redundant, discarded, or newly expensive, (3) why that is a performance regression rather than a harmless implementation detail, (4) what input size, iteration count, or execution path makes it matter.
- "impact" must describe concrete downstream harm (e.g. extra DB round-trips per item, latency scaling linearly with N, wasted CPU per request, redundant allocations per finding)—not vague "may be slow" language.
- "suggested_fix" must name the exact optimization or cleanup (e.g. remove the discarded per-item calculateX call inside the loop and keep the single aggregate calculateX(allItems); hoist RegExp or JSON.parse out of the loop; batch into one query; compute once before the loop).

${FINDING_STYLE_GUIDE}

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
      'performance',
      4500,
    );

    const userPrompt = `Respond with a single JSON object matching this schema: ${AGENT_OUTPUT_SCHEMA_PROMPT}

Changed files in this Pull Request:
${diffContent}

Analyze the changed lines and their local context (surrounding function, loop, and data flow) for performance regressions introduced by this diff. Specifically examine:
- redundant computation or duplicate work relative to an existing aggregate or batched step
- repeated expensive calls (I/O, DB, network, parsing, serialization, validation, regex construction, allocation) inside loops or hot paths
- discarded or unused results from expensive-looking calls or transformations
- unnecessary loops or per-item work where a single aggregate or batched call exists or would suffice
- new N+1-style patterns
- scaling behavior of the changed code (cost vs number of files, findings, agents, retries, requests, items, or similar visible dimensions)

Do not propose speculative optimizations or stylistic rewrites. Reference only file paths and line numbers from the diff hunks. Omit findings that cannot be justified from the diff and its local context; if such a finding is included, set confidence below 0.5. Set "category" to "performance" for all findings. If no performance regressions exist, return empty findings array.`;

    return callWithValidationRetry({
      client,
      model,
      messages: [
        { role: 'system', content: PERFORMANCE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      agentName: 'Performance',
      promptSizeChars: PERFORMANCE_SYSTEM_PROMPT.length + userPrompt.length,
      signal,
    });
  }
}
