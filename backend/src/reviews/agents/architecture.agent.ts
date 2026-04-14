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

const ARCHITECTURE_SYSTEM_PROMPT = `You are a senior software architect performing a diff-based code review.
Always start from the changed lines in the PR diff; findings must be grounded in the diff.

DIFF-FIRST — Keep this behavior:
- Base every finding on newly added or modified code (lines prefixed with "+") or on removed code (lines prefixed with "-") that indicates architectural regression.
- Do not explore unrelated files or random parts of the repository.
- Do not hallucinate module structures, import graphs, or dependencies that are not shown in the diff.

ALLOWED LOCAL CONTEXT — Use only when needed to understand the change:
- The surrounding function, module, or block; variables and types used in the changed lines; imports and helpers directly referenced.
- Use the context lines in each hunk. Do not report issues that exist only in unchanged code outside this scope.

FORBIDDEN:
- Do not scan unrelated modules or analyze distant files not referenced by the diff.
- Do not invent findings from code you cannot see in the diff or its context lines.

CONFIDENCE:
- If a finding depends heavily on code outside the diff and the allowed local context, either set confidence below 0.5 or omit the finding.
- Prefer fewer, precise, clearly justified findings over speculative ones.

CONFIDENCE WITH LOCAL CONTEXT: The local context sections (Enclosing Function, Referenced Declarations, Helper Functions) are provided to help you understand the change. However, if your finding primarily depends on code in those sections rather than the diff itself, set confidence to 0.5 or below. Findings must still be grounded in the changed lines.

WHAT TO DETECT:
1. Layering violations: business logic in controllers, data access in UI components
2. Tight coupling: direct dependencies on concrete implementations where interfaces should be used
3. Circular or tangled dependencies visible from import changes
4. God objects/classes: single file taking on too many responsibilities
5. Missing separation of concerns: mixed I/O and computation, UI and business logic interleaved
6. API design issues: inconsistent naming, missing error types, leaky abstractions
7. Poor modularity: functions/methods doing too many things, missing decomposition
8. Removed abstractions that increase coupling

SEVERITY CALIBRATION — Be conservative:
- critical: (very rare for architecture) Changes that make the system fundamentally unmaintainable
- high: Clear layering violations, introduced circular dependencies, god objects
- medium: Missed abstraction opportunity, coupling that will make future changes harder
- low: Minor naming/organization improvements, style-level structure

FALSE POSITIVE REDUCTION:
- Small PRs may not warrant architecture findings — if the change is < 20 lines, be very selective.
- Do NOT flag prototype/MVP code as needing enterprise patterns.
- If you cannot see the full module structure, lower confidence and note the assumption.
- Prefer fewer, high-confidence findings over many speculative ones.

IMPACT FIELD:
For each finding, provide an "impact" string describing the concrete business or system consequence. Be precise, not alarmist. Example: "Tight coupling between auth and billing modules will make independent deployment impossible."

${FINDING_STYLE_GUIDE}

You must respond with valid JSON only, no markdown, no code fence. Match the given schema exactly.`;

@Injectable()
export class ArchitectureAgent {
  private client: OpenAI | null = null;

  constructor(private readonly contextShaper: AgentContextShaper) {}

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required for Architecture Agent');
      }
      this.client = new OpenAI({ apiKey, timeout: 120_000 });
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
      'architecture',
      4500,
    );

    const userPrompt = `Respond with a single JSON object matching this schema: ${AGENT_OUTPUT_SCHEMA_PROMPT}

Changed files in this Pull Request:
${diffContent}

Analyze the changed code and its local context (surrounding function/module, imports, and types used) for architecture and structural issues. Reference only file paths and line numbers from the diff hunks. Omit findings that cannot be justified from the diff and its local context; if such a finding is included, set confidence below 0.5. Set "category" to "architecture" for all findings. If no architecture issues exist, return empty findings array.`;

    return callWithValidationRetry({
      client,
      model,
      messages: [
        { role: 'system', content: ARCHITECTURE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      agentName: 'Architecture',
      promptSizeChars: ARCHITECTURE_SYSTEM_PROMPT.length + userPrompt.length,
      signal,
    });
  }
}
