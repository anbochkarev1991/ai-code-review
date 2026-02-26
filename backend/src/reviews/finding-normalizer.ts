import { Injectable } from '@nestjs/common';
import type { Finding, FindingSeverity } from 'shared';

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const SEVERITY_DOWNGRADE: Record<FindingSeverity, FindingSeverity> = {
  critical: 'high',
  high: 'medium',
  medium: 'low',
  low: 'low',
};

const UNCERTAINTY_PHRASES = [
  'might',
  'possibly',
  'perhaps',
  'could potentially',
  'may or may not',
  'not entirely sure',
  'uncertain',
  'unclear whether',
  'hard to tell',
];

/**
 * Finding normalizer — handles deduplication, confidence adjustment, and severity normalization.
 *
 * Responsibilities:
 * 1. Cross-agent deduplication (same file + line + category → merge)
 * 2. Confidence downgrade when finding references code outside diff
 * 3. Severity downgrade when agent uses uncertainty language
 * 4. strictMode filtering (suppress findings with confidence < 0.6)
 *
 * Scaling note: O(n²) deduplication is acceptable for typical review sizes (<100 findings).
 * For 100 PR/min at scale, findings per PR rarely exceed 50 — this is not a bottleneck.
 * If finding counts grow, switch to hash-based grouping by (file, line_bucket, category).
 */
@Injectable()
export class FindingNormalizer {
  /**
   * Full normalization pipeline: deduplicate → adjust confidence → adjust severity → filter.
   */
  normalize(findings: Finding[], strictMode = false): Finding[] {
    let result = this.deduplicateFindings(findings);
    result = result.map((f) => this.applyConfidenceDowngrade(f));
    result = result.map((f) => this.applyUncertaintyDowngrade(f));
    result = this.sortFindings(result);

    if (strictMode) {
      result = result.filter((f) => (f.confidence ?? 0.5) >= 0.6);
    }

    return result;
  }

  /**
   * Enhanced deduplication: if 2+ agents flag the same file + nearby line + same category,
   * merge into a single finding keeping the higher severity and higher confidence.
   */
  private deduplicateFindings(findings: Finding[]): Finding[] {
    const unique: Finding[] = [];

    for (const finding of findings) {
      const existingIndex = unique.findIndex((existing) =>
        this.isSimilar(existing, finding),
      );

      if (existingIndex === -1) {
        unique.push(finding);
      } else {
        const existing = unique[existingIndex];
        if (this.shouldReplace(existing, finding)) {
          unique[existingIndex] = {
            ...finding,
            agent_name: this.mergeAgentNames(existing.agent_name, finding.agent_name),
          };
        } else {
          unique[existingIndex] = {
            ...existing,
            agent_name: this.mergeAgentNames(existing.agent_name, finding.agent_name),
          };
        }
      }
    }

    return unique;
  }

  private mergeAgentNames(a?: string, b?: string): string {
    if (!a && !b) return 'Unknown';
    if (!a) return b!;
    if (!b) return a;
    if (a === b) return a;
    return `${a}, ${b}`;
  }

  private isSimilar(a: Finding, b: Finding): boolean {
    if (a.file && b.file && a.file !== b.file) return false;

    if (a.category && b.category && a.category === b.category) {
      if (a.line && b.line && Math.abs(a.line - b.line) <= 3) return true;
    }

    if (a.line && b.line && Math.abs(a.line - b.line) > 5) return false;

    const msgA = a.message.toLowerCase();
    const msgB = b.message.toLowerCase();

    if (msgA === msgB) return true;

    const shorter = msgA.length < msgB.length ? msgA : msgB;
    const longer = msgA.length >= msgB.length ? msgA : msgB;
    if (longer.includes(shorter) && shorter.length > 20) return true;

    const wordsA = new Set(msgA.split(/\s+/).filter((w) => w.length > 3));
    const wordsB = new Set(msgB.split(/\s+/).filter((w) => w.length > 3));
    if (wordsA.size === 0 || wordsB.size === 0) return false;

    const intersection = [...wordsA].filter((w) => wordsB.has(w));
    const union = new Set([...wordsA, ...wordsB]);
    const jaccard = intersection.length / union.size;

    return jaccard > 0.6;
  }

  private shouldReplace(existing: Finding, candidate: Finding): boolean {
    const existingSev = SEVERITY_ORDER[existing.severity] ?? 0;
    const candidateSev = SEVERITY_ORDER[candidate.severity] ?? 0;

    if (candidateSev > existingSev) return true;
    if (candidateSev < existingSev) return false;

    return (candidate.confidence ?? 0) > (existing.confidence ?? 0);
  }

  /**
   * If a finding's message references files or code not present in the diff
   * (detected heuristically), reduce confidence to < 0.5.
   */
  private applyConfidenceDowngrade(finding: Finding): Finding {
    const message = finding.message.toLowerCase();
    const outsideDiffIndicators = [
      'outside the diff',
      'not shown in the diff',
      'in other files',
      'elsewhere in the codebase',
      'cannot see the full',
      'not visible in the changes',
      'assuming the',
      'based on convention',
    ];

    const referencesOutside = outsideDiffIndicators.some((phrase) =>
      message.includes(phrase),
    );

    if (referencesOutside && (finding.confidence ?? 0.5) >= 0.5) {
      return { ...finding, confidence: 0.4 };
    }

    return finding;
  }

  /**
   * If agent uses uncertainty phrases ("might", "possibly"), downgrade severity
   * by one level unless confidence is high (>= 0.8), indicating strong signal
   * despite hedging language.
   */
  private applyUncertaintyDowngrade(finding: Finding): Finding {
    const message = finding.message.toLowerCase();
    const confidence = finding.confidence ?? 0.5;

    if (confidence >= 0.8) return finding;

    const hasUncertainty = UNCERTAINTY_PHRASES.some((phrase) =>
      message.includes(phrase),
    );

    if (hasUncertainty) {
      return {
        ...finding,
        severity: SEVERITY_DOWNGRADE[finding.severity],
      };
    }

    return finding;
  }

  private sortFindings(findings: Finding[]): Finding[] {
    return [...findings].sort((a, b) => {
      const sevDiff =
        (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0);
      if (sevDiff !== 0) return sevDiff;
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    });
  }
}
