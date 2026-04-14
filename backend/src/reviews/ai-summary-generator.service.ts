import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import type { AiReviewSummary, Finding, ReviewSummary } from 'shared';

type ParsedConcern = { severity: string; title: string; explanation?: string };

/** Word numbers 1–20 that might appear in LLM prose instead of digits. */
const WORD_NUMBER_TO_VALUE: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

const WORD_NUMBER_PATTERN = Object.keys(WORD_NUMBER_TO_VALUE).join('|');

/**
 * Single source for the opening severity sentence in AI overall_assessment.
 * Uses structured counts from the review (must match findings after normalization).
 */
export function buildFactualSeverityPrefix(
  reviewSummary: ReviewSummary,
): string {
  const {
    critical_count: c,
    high_count: h,
    medium_count: m,
    low_count: l,
  } = reviewSummary;
  const total = c + h + m + l;
  if (total === 0) {
    return 'No issues found.';
  }

  const segments: string[] = [];
  const push = (n: number, label: string) => {
    if (n <= 0) return;
    const noun = n === 1 ? 'issue' : 'issues';
    segments.push(`${n} ${label}-severity ${noun}`);
  };
  push(c, 'critical');
  push(h, 'high');
  push(m, 'medium');
  push(l, 'low');

  if (segments.length === 1) {
    return `This PR contains ${segments[0]}.`;
  }
  if (segments.length === 2) {
    return `This PR contains ${segments[0]} and ${segments[1]}.`;
  }
  const last = segments.pop()!;
  return `This PR contains ${segments.join(', ')}, and ${last}.`;
}

/**
 * Returns true if a sentence appears to claim numeric severity counts that are unsafe
 * (vague quantifiers) or disagree with structured findings.
 */
function substringContradictsSeverityCount(
  slice: string,
  expected: Record<'critical' | 'high' | 'medium' | 'low', number>,
): boolean {
  const hasSeverityTalk =
    /\b(critical|high|medium|low)[- ]severity\b/i.test(slice) ||
    /\b(critical|high|medium|low)\s+(?:issue|issues|finding|findings)\b/i.test(
      slice,
    );
  if (!hasSeverityTalk) return false;

  if (/\b(several|multiple|a few)\b/i.test(slice)) return true;

  let claimed: number | null = null;
  const digit = slice.match(/\b(\d{1,2})\b/);
  if (digit) claimed = parseInt(digit[1], 10);

  const lower = slice.toLowerCase();
  const wordMatch = lower.match(
    new RegExp(`\\b(${WORD_NUMBER_PATTERN})\\b`, 'i'),
  );
  if (wordMatch && WORD_NUMBER_TO_VALUE[wordMatch[1].toLowerCase()] != null) {
    claimed = WORD_NUMBER_TO_VALUE[wordMatch[1].toLowerCase()]!;
  }

  if (claimed == null) return false;

  if (
    /\bcritical(?:[- ]severity|\s+(?:issue|issues|finding|findings))\b/i.test(
      slice,
    )
  ) {
    return claimed !== expected.critical;
  }
  if (
    /\bhigh(?:[- ]severity|\s+(?:issue|issues|finding|findings))\b/i.test(slice)
  ) {
    return claimed !== expected.high;
  }
  if (
    /\bmedium(?:[- ]severity|\s+(?:issue|issues|finding|findings))\b/i.test(
      slice,
    )
  ) {
    return claimed !== expected.medium;
  }
  if (
    /\blow(?:[- ]severity|\s+(?:issue|issues|finding|findings))\b/i.test(slice)
  ) {
    return claimed !== expected.low;
  }

  return false;
}

/**
 * Removes sentences that claim numeric (or vague multi) severity counts, which must
 * come only from buildFactualSeverityPrefix.
 */
export function stripSeverityCountClaims(
  text: string,
  expectedCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  },
): string {
  const parts = text.split(/(?<=[.!?])\s+/).filter((p) => p.trim().length > 0);
  const kept = parts.filter((sentence) => {
    if (substringContradictsSeverityCount(sentence, expectedCounts)) {
      return false;
    }
    return true;
  });
  return kept.join(' ').replace(/\s+/g, ' ').trim();
}

function parseConcern(raw: string): ParsedConcern {
  const match = raw.match(/^\[(CRITICAL|HIGH|MEDIUM|LOW)\]\s*(.*)/s);
  if (match) {
    const rest = (match[2] ?? '').trim();
    const newlineIdx = rest.indexOf('\n');
    if (newlineIdx >= 0) {
      return {
        severity: match[1],
        title: rest.slice(0, newlineIdx).trim(),
        explanation: rest.slice(newlineIdx + 1).trim() || undefined,
      };
    }
    return { severity: match[1], title: rest || raw, explanation: undefined };
  }
  return { severity: 'MEDIUM', title: raw.trim(), explanation: undefined };
}

function normalizeForSimilarity(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b(in|the|a|an)\s+/g, '')
    .replace(/\b(method|function|checkout|getUsage|handler|etc)\.?/gi, '')
    .replace(/\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function concernSimilarity(a: ParsedConcern, b: ParsedConcern): number {
  if (a.severity !== b.severity) return 0;
  const na = normalizeForSimilarity(a.title);
  const nb = normalizeForSimilarity(b.title);
  if (na === nb) return 1;
  const wordsA = new Set(na.split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(nb.split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = [...wordsA].filter((w) => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.length / union.size;
}

const CONCERN_SIMILARITY_THRESHOLD = 0.6;

function mergeSimilarConcerns(concerns: string[]): string[] {
  const parsed = concerns.map(parseConcern);
  const merged: ParsedConcern[] = [];
  const used = new Set<number>();

  for (let i = 0; i < parsed.length; i++) {
    if (used.has(i)) continue;
    const primary = parsed[i];
    const group: ParsedConcern[] = [primary];

    for (let j = i + 1; j < parsed.length; j++) {
      if (used.has(j)) continue;
      if (
        concernSimilarity(primary, parsed[j]) >= CONCERN_SIMILARITY_THRESHOLD
      ) {
        group.push(parsed[j]);
        used.add(j);
      }
    }

    if (group.length === 1) {
      merged.push(primary);
    } else {
      const count = group.length;
      const locationsSuffix = count > 1 ? ` (${count} locations)` : '';
      const explanations = group
        .map((c) => c.explanation)
        .filter(Boolean) as string[];
      const combinedExplanation =
        explanations.length > 0
          ? [...new Set(explanations)].slice(0, 2).join('; ')
          : undefined;
      merged.push({
        severity: primary.severity,
        title:
          primary.title.replace(/\s*\(\d+\s*locations?\)\s*$/i, '').trim() +
          locationsSuffix,
        explanation: combinedExplanation,
      });
    }
  }

  return merged.map((c) => {
    let out = `[${c.severity}] ${c.title}`;
    if (c.explanation) out += `\n${c.explanation}`;
    return out;
  });
}

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

   **Important:** Do NOT state specific counts of critical/high/medium/low findings or issues (no numbers, no words like "three" or "multiple" tied to severity levels). The system prepends exact severity counts automatically.

2. primary_risk: Single short label for the main concern category. Examples: "Security", "Reliability", "Architecture", "Maintainability", "Performance", "Code Quality".

3. key_concerns: 3–5 items max. Put more severe or impactful concerns first.

   **Purpose:** Summarize patterns across findings—do NOT repeat finding titles or wording. Write like an experienced engineer quickly describing the main risks.

   **Rules:**
   - One short line per concern. Summarize the underlying issue pattern, not each finding verbatim.
   - Use accurate wording. Do not exaggerate: if the secret comes from env vars, do not say "hardcoded"; if validation is weak, say "weak validation" not "missing validation."
   - Merge similar issues into a single pattern. Do not list "Missing X in A" and "Missing X in B" separately—write one: "Missing X in [category/area]."
   - Do not speculate beyond the available code context.

   **Format:** "[SEVERITY] Short pattern title" (e.g. "[HIGH] Missing null checks for authentication headers").

   **Good vs bad examples:**
   - Bad: "Hardcoded Stripe Webhook Secret Handling" → Good: "Weak validation of Stripe webhook secret"
   - Bad: "Missing null checks for token in checkout" + "Missing null checks for token in getUsage" (two items) → Good: "Missing null checks for authentication headers" (one item)

4. recommendation: One concise action-oriented sentence (e.g. "Remove exposed credentials and strengthen webhook validation before merging.").

## Forbidden
- Fluffy wording or generic filler (e.g. "improve code quality")
- Repeating finding titles or wording verbatim—summarize patterns instead
- Exaggeration or inaccurate wording (e.g. "hardcoded secret" when the code uses env vars)
- Marketing or dramatic language
- Vague statements
- Separate concerns that differ only by method/file name—merge into one pattern
- Stating how many critical/high/medium/low findings or issues exist (counts are injected separately; do not approximate)

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
      this.client = new OpenAI({ apiKey, timeout: 120_000 });
    }
    return this.client;
  }

  async generate(
    findings: Finding[],
    reviewSummary: ReviewSummary,
  ): Promise<AiReviewSummary | undefined> {
    const factualPrefix = buildFactualSeverityPrefix(reviewSummary);
    const expectedCounts = {
      critical: reviewSummary.critical_count,
      high: reviewSummary.high_count,
      medium: reviewSummary.medium_count,
      low: reviewSummary.low_count,
    };

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
      summary.key_concerns = mergeSimilarConcerns(summary.key_concerns);
      if (summary.key_concerns.length > 5) {
        summary.key_concerns = summary.key_concerns.slice(0, 5);
      }
      if (!summary.primary_risk && reviewSummary.primary_risk_category) {
        summary.primary_risk = reviewSummary.primary_risk_category;
      }

      const cleanedAssessment = stripSeverityCountClaims(
        summary.overall_assessment,
        expectedCounts,
      );
      summary.overall_assessment = cleanedAssessment
        ? `${factualPrefix} ${cleanedAssessment}`
        : factualPrefix;

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
      'For overall_assessment: describe risks qualitatively only — no counts of findings by severity (the client will show exact counts).',
      '',
      'For key_concerns: Infer accurate descriptions from each finding\'s message (not just the title). Do not mischaracterize—e.g. if a finding says the value comes from env vars, do not label it as "hardcoded."',
      '',
      'Return JSON: { "overall_assessment": "...", "primary_risk": "Label", "key_concerns": [...], "recommendation": "..." }',
    );

    return parts.join('\n');
  }
}
