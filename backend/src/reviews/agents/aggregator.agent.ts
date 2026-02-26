import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { AGENT_OUTPUT_SCHEMA_PROMPT, type AgentOutput } from 'shared';
import { callWithValidationRetry } from './agent-validation.utils';
// TODO: Remove mock import once correct OpenAI API key is configured
import {
  MOCK_AGGREGATOR_RESPONSE,
  shouldUseMockResponses,
} from './mock-responses';

const AGGREGATOR_SYSTEM_PROMPT = `You are an aggregator that merges code review findings from four specialized agents: Code Quality, Architecture, Performance, and Security.

Your task:
1. Merge all findings from the four agent outputs into a single list.
2. Remove duplicates: findings with similar message, file, and line should be merged (keep the highest severity).
3. Prioritize by severity: critical > high > medium > low.
4. Preserve agent attribution: When merging findings, set agent_name to the source agent name (Code Quality, Architecture, Performance, or Security) so users know which agent identified each finding.
5. Produce one concise summary that synthesizes the key findings across all categories.

You must respond with valid JSON only, no markdown, no code fence. Match the given schema exactly.`;

@Injectable()
export class AggregatorAgent {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required for Aggregator Agent');
      }
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  /**
   * Runs the Aggregator Agent on outputs from the four domain agents.
   * Merges, deduplicates, and prioritizes findings; produces a single summary.
   * Returns AgentOutput matching the same schema.
   * On validation failure, retries up to 2 times with "invalid JSON" message before throwing.
   */
  async run(agentOutputs: AgentOutput[], repoFullName?: string, prNumber?: number): Promise<AgentOutput> {
    if (agentOutputs.length !== 4) {
      throw new Error(
        `Aggregator expects exactly 4 agent outputs, got ${agentOutputs.length}`,
      );
    }

    // TODO: Remove mock response check once correct OpenAI API key is configured
    if (shouldUseMockResponses(repoFullName, prNumber)) {
      return MOCK_AGGREGATOR_RESPONSE;
    }

    const client = this.getClient();
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

    const outputsJson = JSON.stringify(
      agentOutputs.map((o, i) => ({
        agent: ['Code Quality', 'Architecture', 'Performance', 'Security'][i],
        ...o,
      })),
      null,
      2,
    );

    const userPrompt = `Schema (respond with a single JSON object only): ${AGENT_OUTPUT_SCHEMA_PROMPT}

Four agent outputs to merge:
\`\`\`json
${outputsJson}
\`\`\`

Merge findings, remove duplicates (by similar message/file/line), assign priority (critical/high/medium/low), and preserve agent attribution (set agent_name to the source agent: Code Quality, Architecture, Performance, or Security). Produce a single summary. Return one JSON object.`;

    const result = await callWithValidationRetry({
      client,
      model,
      messages: [
        { role: 'system', content: AGGREGATOR_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      agentName: 'Aggregator',
    });
    return result.output;
  }
}
