import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import type { AiReviewSummary, Finding, ReviewSummary } from 'shared';

function parseAiSummary(parsed: unknown): AiReviewSummary | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  const overall_assessment = o.overall_assessment;
  const key_concerns = o.key_concerns;
  const recommendation = o.recommendation;
  const primary_risk = o.primary_risk;
  if (
    typeof overall_assessment !== 'string' ||
    !Array.isArray(key_concerns) ||
    !key_concerns.every((c) => typeof c === 'string') ||
    typeof recommendation !== 'string'
  ) {
    return null;
  }
  const result: AiReviewSummary = {
    overall_assessment,
    key_concerns: key_concerns,
    recommendation,
  };
  if (typeof primary_risk === 'string' && primary_risk.trim()) {
    result.primary_risk = primary_risk.trim();
  }
  return result;
}

const AI_SUMMARY_SYSTEM_PROMPT = `You are a senior engineer summarizing code review results for a colleague. Produce a technical, concise, high-signal executive overview readable in under 10 seconds.

## Required structure (return valid JSON)

1. overall_assessment: 1–2 concise sentences describing the PR state clearly. Answer: What are the main risks? Is this PR mostly safe, risky, or blocked?

2. primary_risk: Single short label for the main concern category. Examples: "Security", "Reliability", "Architecture", "Maintainability", "Performance", "Code Quality".

3. key_concerns: 4–5 items max. Put more severe or impactful concerns first. Merge overlapping concerns. Each item may optionally start with [CRITICAL], [HIGH], [MEDIUM], or [LOW] when severity matters.

4. recommendation: One concise action-oriented sentence (e.g. "Remove exposed credentials and strengthen webhook validation before merging.").

## Forbidden
- Fluffy wording or generic filler (e.g. "improve code quality")
- Repetitive issue restatements
- Marketing or dramatic language
- Vague statements

## Themes to mention when relevant
Error handling gaps, validation issues, architectural coupling, security-sensitive behavior.`;

@Injectable()
export class AiSummaryGeneratorService {
  private readonly logger = new Logger(AiSummaryGeneratorService.name);
  private client: OpenAI | null = null;

  private getClient(): OpenAI | null {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        this.logger.warn(
          'OPENAI_API_KEY not set — skipping AI summary generation',
        );
        return null;
      }
      this.client = new OpenAI({ apiKey });
    }
    return this.client;
  }

  async generate(
    findings: Finding[],
    reviewSummary: ReviewSummary,
  ): Promise<AiReviewSummary | undefined> {
    const client = this.getClient();
    if (!client) return undefined;

    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    const userPrompt = this.buildUserPrompt(findings, reviewSummary);

    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: AI_SUMMARY_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) {
        this.logger.warn('OpenAI returned empty response for AI summary');
        return undefined;
      }

      const parsed: unknown = JSON.parse(content);
      const summary = parseAiSummary(parsed);
      if (!summary) {
        this.logger.warn('AI summary schema validation failed');
        return undefined;
      }
      if (summary.key_concerns.length > 5) {
        summary.key_concerns = summary.key_concerns.slice(0, 5);
      }
      if (!summary.primary_risk && reviewSummary.primary_risk_category) {
        summary.primary_risk = reviewSummary.primary_risk_category;
      }
      return summary;
    } catch (err) {
      this.logger.warn(
        `AI summary generation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return undefined;
    }
  }

  private buildUserPrompt(
    findings: Finding[],
    reviewSummary: ReviewSummary,
  ): string {
    const severityCounts = [
      `Critical: ${reviewSummary.critical_count}`,
      `High: ${reviewSummary.high_count}`,
      `Medium: ${reviewSummary.medium_count}`,
      `Low: ${reviewSummary.low_count}`,
    ].join(', ');

    const parts: string[] = [
      'Generate an AI Review Summary from the following code review data.',
      '',
      '## Risk & merge',
      `Risk score: ${reviewSummary.risk_score}/100`,
      `Risk level: ${reviewSummary.risk_level}`,
      `Merge recommendation: ${reviewSummary.merge_recommendation}`,
      `Severity counts: ${severityCounts}`,
      reviewSummary.merge_explanation
        ? `Merge explanation: ${reviewSummary.merge_explanation}`
        : '',
      reviewSummary.primary_risk_category
        ? `Primary risk category: ${reviewSummary.primary_risk_category}`
        : '',
      '',
    ];

    if (
      reviewSummary.systemic_patterns &&
      reviewSummary.systemic_patterns.length > 0
    ) {
      parts.push('## Systemic patterns detected', '');
      for (const p of reviewSummary.systemic_patterns) {
        parts.push(`- ${p}`);
      }
      parts.push('');
    }

    parts.push('## Findings', '');
    if (findings.length === 0) {
      parts.push('No findings.');
    } else {
      for (let i = 0; i < findings.length; i++) {
        const f = findings[i];
        const loc =
          f.file || f.affected_locations?.[0]?.file
            ? ` (${f.file ?? f.affected_locations?.[0]?.file}${f.line != null ? `:${f.line}` : ''})`
            : '';
        parts.push(
          `${i + 1}. [${f.severity}] ${f.title} — ${f.category}${loc}`,
          `   ${f.message}`,
          '',
        );
      }
    }

    parts.push(
      '',
      'Return JSON: { "overall_assessment": "...", "primary_risk": "Label", "key_concerns": [...], "recommendation": "..." }',
    );

    return parts.join('\n');
  }
}
