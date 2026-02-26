import { Injectable } from '@nestjs/common';
import type { Finding, FindingSeverity } from 'shared';

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const MAX_HIGH_PER_CATEGORY = 3;
const LOW_CONFIDENCE_THRESHOLD = 0.75;
const TOTAL_FINDINGS_OVERFLOW = 6;

export interface SeverityNormalizationStats {
  before: Record<FindingSeverity, number>;
  after: Record<FindingSeverity, number>;
  downgradedCount: number;
  mergedRootCauseCount: number;
}

/**
 * Post-processing layer that tames LLM severity inflation.
 *
 * All rules are deterministic — same input always produces the same output.
 * Applied AFTER deduplication and confidence adjustments but BEFORE final sorting.
 */
@Injectable()
export class SeverityNormalizer {
  normalize(findings: Finding[]): Finding[] {
    let result = [...findings];

    result = this.downgradeByLowConfidence(result);
    result = this.capHighPerCategory(result);
    result = this.downgradeOverflowFindings(result);
    result = this.mergeRootCauseFindings(result);

    return result;
  }

  normalizeWithStats(findings: Finding[]): {
    findings: Finding[];
    stats: SeverityNormalizationStats;
  } {
    const before = this.countSeverities(findings);
    const normalized = this.normalize(findings);
    const after = this.countSeverities(normalized);

    const downgradedCount =
      (before.high - after.high) + (before.critical - after.critical);
    const mergedRootCauseCount = findings.length - normalized.length;

    return {
      findings: normalized,
      stats: {
        before,
        after,
        downgradedCount: Math.max(0, downgradedCount),
        mergedRootCauseCount: Math.max(0, mergedRootCauseCount),
      },
    };
  }

  /**
   * Rule 1: If confidence < 0.75 and severity is HIGH → downgrade to MEDIUM.
   */
  private downgradeByLowConfidence(findings: Finding[]): Finding[] {
    return findings.map((f) => {
      if (f.severity === 'high' && f.confidence < LOW_CONFIDENCE_THRESHOLD) {
        return { ...f, severity: 'medium' as FindingSeverity };
      }
      return f;
    });
  }

  /**
   * Rule 2: Max 3 HIGH findings per category.
   * Keeps the 3 highest-confidence HIGHs per category, downgrades the rest.
   */
  private capHighPerCategory(findings: Finding[]): Finding[] {
    const highByCategory = new Map<string, number>();
    const indexed = findings.map((f, i) => ({ finding: f, index: i }));

    const highFindings = indexed
      .filter((item) => item.finding.severity === 'high')
      .sort((a, b) => b.finding.confidence - a.finding.confidence);

    const downgradedIndices = new Set<number>();

    for (const item of highFindings) {
      const cat = item.finding.category || 'unknown';
      const count = highByCategory.get(cat) ?? 0;
      if (count >= MAX_HIGH_PER_CATEGORY) {
        downgradedIndices.add(item.index);
      } else {
        highByCategory.set(cat, count + 1);
      }
    }

    return findings.map((f, i) => {
      if (downgradedIndices.has(i)) {
        return { ...f, severity: 'medium' as FindingSeverity };
      }
      return f;
    });
  }

  /**
   * Rule 3: If total findings > 6, downgrade lowest-confidence HIGH findings to MEDIUM.
   *
   * Strategy: sort HIGH findings by confidence ascending, downgrade from bottom
   * until HIGH count ≤ half of total (but at least cap at 3).
   */
  private downgradeOverflowFindings(findings: Finding[]): Finding[] {
    if (findings.length <= TOTAL_FINDINGS_OVERFLOW) return findings;

    const maxHighAllowed = Math.min(
      3,
      Math.ceil(findings.length / 2),
    );

    const highIndices = findings
      .map((f, i) => ({ confidence: f.confidence, index: i }))
      .filter((_, i) => findings[i].severity === 'high')
      .sort((a, b) => a.confidence - b.confidence);

    const excessCount = highIndices.length - maxHighAllowed;
    if (excessCount <= 0) return findings;

    const toDowngrade = new Set(
      highIndices.slice(0, excessCount).map((h) => h.index),
    );

    return findings.map((f, i) => {
      if (toDowngrade.has(i)) {
        return { ...f, severity: 'medium' as FindingSeverity };
      }
      return f;
    });
  }

  /**
   * Rule 4: If same root cause produces multiple HIGH issues, merge them.
   *
   * Root cause grouping: same file + same category + overlapping title words.
   * Keeps the finding with highest severity (then confidence), discards duplicates.
   */
  private mergeRootCauseFindings(findings: Finding[]): Finding[] {
    const groups: Finding[][] = [];

    for (const finding of findings) {
      if (finding.severity !== 'high' && finding.severity !== 'critical') {
        groups.push([finding]);
        continue;
      }

      let merged = false;
      for (const group of groups) {
        const primary = group[0];
        if (
          primary.severity !== 'high' &&
          primary.severity !== 'critical'
        ) {
          continue;
        }
        if (this.isSameRootCause(primary, finding)) {
          group.push(finding);
          merged = true;
          break;
        }
      }
      if (!merged) {
        groups.push([finding]);
      }
    }

    return groups.map((group) => this.mergeRootCauseGroup(group));
  }

  private isSameRootCause(a: Finding, b: Finding): boolean {
    if (!a.file || !b.file || a.file !== b.file) return false;
    if (a.category !== b.category) return false;

    const wordsA = this.significantWords(a.title);
    const wordsB = this.significantWords(b.title);
    if (wordsA.size === 0 || wordsB.size === 0) return false;

    const intersection = [...wordsA].filter((w) => wordsB.has(w));
    const union = new Set([...wordsA, ...wordsB]);
    return intersection.length / union.size > 0.4;
  }

  private significantWords(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3),
    );
  }

  private mergeRootCauseGroup(group: Finding[]): Finding {
    if (group.length === 1) return group[0];

    group.sort((a, b) => {
      const sevDiff =
        (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0);
      if (sevDiff !== 0) return sevDiff;
      return b.confidence - a.confidence;
    });

    const primary = group[0];
    const agents = new Set<string>();
    for (const f of group) {
      if (f.agent_name) {
        for (const name of f.agent_name.split(', ')) {
          agents.add(name.trim());
        }
      }
    }

    const bestConfidence = Math.max(...group.map((f) => f.confidence));

    const bestImpact = group
      .map((f) => f.impact)
      .filter(Boolean)
      .sort((a, b) => (b?.length ?? 0) - (a?.length ?? 0))[0];

    const bestFix = group
      .map((f) => f.suggested_fix)
      .filter(Boolean)
      .sort((a, b) => (b?.length ?? 0) - (a?.length ?? 0))[0];

    const agentList = [...agents];

    return {
      ...primary,
      confidence: bestConfidence,
      impact: bestImpact ?? primary.impact,
      suggested_fix: bestFix ?? primary.suggested_fix,
      agent_name: agentList.length > 0 ? agentList.join(', ') : primary.agent_name,
      merged_agents: agentList.length > 1 ? agentList : primary.merged_agents,
    };
  }

  private countSeverities(findings: Finding[]): Record<FindingSeverity, number> {
    const counts: Record<FindingSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const f of findings) {
      counts[f.severity]++;
    }
    return counts;
  }
}
