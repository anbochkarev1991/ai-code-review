import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AGENT_OUTPUT_SCHEMA_PROMPT } from 'shared';
import type { ParsedFile } from '../../types';
import {
  callWithValidationRetry,
  type CallWithValidationRetryResult,
} from './agent-validation.utils';
import { DiffParser } from '../diff-parser';

const ARCHITECTURE_SYSTEM_PROMPT = `You are a senior software architect performing a diff-based code review.
You are given ONLY the changed hunks from a Pull Request — do NOT assume anything about code outside these hunks.

ANALYSIS SCOPE — Diff-Aware Rules:
- Focus on NEWLY ADDED or MODIFIED code (lines prefixed with "+").
- Note removed abstractions or boundaries (lines prefixed with "-") that may indicate architectural regression.
- Context lines show surrounding code for reference only.
- Do NOT hallucinate module structures, import graphs, or dependencies that are not shown in the diff.

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

You must respond with valid JSON only, no markdown, no code fence. Match the given schema exactly.`;

@Injectable()
export class ArchitectureAgent {
  private client: OpenAI | null = null;

  constructor(private readonly diffParser: DiffParser) {}

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required for Architecture Agent');
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

Analyze ONLY the changed code for architecture and structural issues. For each finding, reference the exact file path and line number from the diff. Set "category" to "architecture" for all findings. If no architecture issues exist, return empty findings array.`;

    return callWithValidationRetry({
      client,
      model,
      messages: [
        { role: 'system', content: ARCHITECTURE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      agentName: 'Architecture',
      promptSizeChars: ARCHITECTURE_SYSTEM_PROMPT.length + userPrompt.length,
    });
  }
}
