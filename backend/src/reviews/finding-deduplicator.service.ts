import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import type {
  Finding,
  FindingSeverity,
  AffectedLocation,
  ConsensusLevel,
} from 'shared';

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const MULTI_AGENT_BOOST = 0.05;
const MIN_FINDINGS_FOR_LLM = 4;
const DEDUP_TIMEOUT_MS = 5_000;

const DEDUP_SYSTEM_PROMPT = `You are a senior engineer deduplicating code review findings from multiple specialized agents (Code Quality, Architecture, Performance, Security).

Your task: Group findings that share the SAME ROOT CAUSE. Do NOT invent new groups — only merge when there is a clear shared underlying problem.

Rules:
- Findings about different symptoms of the same bug should be grouped together (e.g. "missing validation in auth" and "missing validation in billing" → same root cause: "Missing input validation").
- Findings that refer to completely different issues must NOT be grouped.
- Each finding ID must appear in exactly one place: either in one group's finding_ids, or in ungrouped_ids.
- Return valid JSON only.`;

interface LlmGroup {
  root_cause: string;
  finding_ids: string[];
}

interface LlmDedupResponse {
  groups?: LlmGroup[];
  ungrouped_ids?: string[];
}

function parseLlmResponse(content: string): LlmDedupResponse | null {
  try {
    const stripped = content
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    const parsed: unknown = JSON.parse(stripped);
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    const groupsRaw: unknown[] = Array.isArray(o.groups) ? o.groups : [];
    const ungrouped_ids = Array.isArray(o.ungrouped_ids) ? o.ungrouped_ids : [];
    return {
      groups: groupsRaw.filter((item): item is LlmGroup => {
        if (item === null || typeof item !== 'object') return false;
        const g = item as Record<string, unknown>;
        return typeof g.root_cause === 'string' && Array.isArray(g.finding_ids);
      }),
      ungrouped_ids: ungrouped_ids.filter(
        (id): id is string => typeof id === 'string',
      ),
    };
  } catch {
    return null;
  }
}

@Injectable()
export class FindingDeduplicatorService {
  private readonly logger = new Logger(FindingDeduplicatorService.name);
  private client: OpenAI | null = null;

  private getClient(): OpenAI | null {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        this.logger.warn(
          'OPENAI_API_KEY not set — skipping LLM finding deduplication',
        );
        return null;
      }
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  async deduplicate(findings: Finding[]): Promise<Finding[]> {
    if (findings.length < MIN_FINDINGS_FOR_LLM) {
      return findings;
    }

    const client = this.getClient();
    if (!client) return findings;

    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    const userPrompt = this.buildUserPrompt(findings);

    try {
      const completionPromise = client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: DEDUP_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('LLM deduplication timed out')),
          DEDUP_TIMEOUT_MS,
        ),
      );

      const completion = await Promise.race([
        completionPromise,
        timeoutPromise,
      ]);

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) {
        this.logger.warn('LLM deduplicator returned empty response');
        return findings;
      }

      const parsed = parseLlmResponse(content);
      if (!parsed) {
        this.logger.warn('LLM deduplicator returned invalid JSON');
        return findings;
      }

      return this.applyGrouping(findings, parsed);
    } catch (err) {
      this.logger.warn(
        `LLM deduplication failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return findings;
    }
  }

  private buildUserPrompt(findings: Finding[]): string {
    const lines = findings.map((f) => {
      const loc = f.file
        ? ` (${f.file}${f.line != null ? `:${f.line}` : ''})`
        : '';
      const msg = (f.message ?? '').slice(0, 120);
      return `${f.id} | ${f.severity} | ${f.category} | ${f.title}${loc}\n   ${msg}`;
    });

    return `Group these findings by root cause. Return JSON:
{
  "groups": [
    { "root_cause": "Short root cause label", "finding_ids": ["id1", "id2"] }
  ],
  "ungrouped_ids": ["id3", "id4"]
}

Findings:
${lines.join('\n\n')}

Return valid JSON only.`;
  }

  private applyGrouping(
    findings: Finding[],
    parsed: LlmDedupResponse,
  ): Finding[] {
    const byId = new Map<string, Finding>();
    for (const f of findings) {
      byId.set(f.id, f);
    }

    const groupedIds = new Set<string>();
    const result: Finding[] = [];

    for (const group of parsed.groups ?? []) {
      const groupFindings = group.finding_ids
        .filter((id) => byId.has(id))
        .map((id) => byId.get(id)!);
      for (const id of group.finding_ids) groupedIds.add(id);

      if (groupFindings.length === 0) continue;
      if (groupFindings.length === 1) {
        result.push(groupFindings[0]);
        continue;
      }

      const merged = this.mergeGroup(groupFindings, group.root_cause);
      result.push(merged);
    }

    for (const f of findings) {
      if (!groupedIds.has(f.id)) {
        result.push(f);
      }
    }

    return result;
  }

  private mergeGroup(group: Finding[], rootCause: string): Finding {
    group = [...group].sort(
      (a, b) =>
        (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0),
    );
    const primary = group[0];

    const agents = new Set<string>();
    const categories = new Set<string>();
    let weightedConfidenceSum = 0;
    let weightSum = 0;

    for (const f of group) {
      if (f.agent_name) {
        for (const name of f.agent_name.split(', ')) {
          agents.add(name.trim());
        }
      }
      if (f.merged_agents) {
        for (const name of f.merged_agents) {
          agents.add(name.trim());
        }
      }
      if (f.category) categories.add(f.category);
      if (f.merged_categories) {
        for (const c of f.merged_categories) categories.add(c);
      }

      const weight = SEVERITY_ORDER[f.severity] ?? 1;
      weightedConfidenceSum += f.confidence * weight;
      weightSum += weight;
    }

    let mergedConfidence =
      weightSum > 0 ? weightedConfidenceSum / weightSum : 0.5;
    if (agents.size > 1) {
      mergedConfidence += MULTI_AGENT_BOOST;
    }
    mergedConfidence = Math.round(mergedConfidence * 100) / 100;

    const agentList = [...agents];
    const categoryList = [...categories];
    const consensus: ConsensusLevel =
      agents.size > 1 ? 'multi-agent' : 'single-agent';
    const locations = this.extractLocations(group);

    const bestImpact = group
      .map((f) => f.impact)
      .filter(Boolean)
      .sort((a, b) => (b?.length ?? 0) - (a?.length ?? 0))[0];

    const bestFix = group
      .map((f) => f.suggested_fix)
      .filter(Boolean)
      .sort((a, b) => (b?.length ?? 0) - (a?.length ?? 0))[0];

    const bestMessage = group
      .map((f) => f.message)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)[0];

    return {
      ...primary,
      root_cause: rootCause,
      message: bestMessage ?? primary.message,
      confidence: mergedConfidence,
      impact: bestImpact ?? primary.impact,
      suggested_fix: bestFix ?? primary.suggested_fix,
      agent_name:
        agentList.length > 0 ? agentList.join(', ') : primary.agent_name,
      merged_agents: agentList.length > 1 ? agentList : undefined,
      merged_categories: categoryList.length > 1 ? categoryList : undefined,
      categories: categoryList.length > 0 ? categoryList : undefined,
      consensus_level: consensus,
      affected_locations: locations.length > 0 ? locations : undefined,
    };
  }

  private extractLocations(group: Finding[]): AffectedLocation[] {
    const seen = new Set<string>();
    const locations: AffectedLocation[] = [];

    for (const f of group) {
      if (f.file) {
        const key = `${f.file}:${f.line ?? '?'}`;
        if (!seen.has(key)) {
          seen.add(key);
          locations.push({ file: f.file, line: f.line });
        }
      }
      for (const loc of f.affected_locations ?? []) {
        if (loc.file) {
          const key = `${loc.file}:${loc.line ?? '?'}`;
          if (!seen.has(key)) {
            seen.add(key);
            locations.push({ file: loc.file, line: loc.line });
          }
        }
      }
    }

    return locations;
  }
}
