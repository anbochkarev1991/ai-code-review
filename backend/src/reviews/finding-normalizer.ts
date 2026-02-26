import { Injectable } from '@nestjs/common';
import type { Finding, FindingSeverity, ParsedFile } from 'shared';

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

const LINE_PROXIMITY_THRESHOLD = 2;
const JACCARD_SIMILARITY_THRESHOLD = 0.5;

/**
 * Finding normalizer — handles deduplication, confidence clamping,
 * diff enforcement, severity normalization, and quality enforcement.
 *
 * Responsibilities:
 * 1. Confidence clamping (0-1 range, auto-clamp invalid values)
 * 2. Cross-agent deduplication (same file + nearby line + similar message → merge)
 * 3. Diff enforcement (flag findings outside diff, reduce confidence)
 * 4. Confidence-severity coherence (critical + low confidence → downgrade)
 * 5. Uncertainty language detection (hedging → severity downgrade)
 * 6. Quality enforcement (truncate verbose explanations)
 * 7. strictMode filtering (suppress outside_diff findings)
 *
 * Scaling note: O(n²) deduplication is acceptable for typical review sizes (<100 findings).
 */
@Injectable()
export class FindingNormalizer {
  /**
   * Full normalization pipeline.
   * Order matters: clamp → diff-check → deduplicate → severity rules → quality → sort → filter.
   */
  normalize(
    findings: Finding[],
    diffFiles?: ParsedFile[],
    strictMode = false,
  ): Finding[] {
    let result = findings.map((f) => this.clampConfidence(f));
    result = diffFiles
      ? result.map((f) => this.enforceDiffBoundary(f, diffFiles))
      : result;
    result = this.deduplicateFindings(result);
    result = result.map((f) => this.applyConfidenceSeverityCoherence(f));
    result = result.map((f) => this.applyUncertaintyDowngrade(f));
    result = result.map((f) => this.enforceQuality(f));
    result = this.sortFindings(result);

    if (strictMode) {
      result = result.filter((f) => !f.outside_diff);
      result = result.filter((f) => (f.confidence ?? 0.5) >= 0.6);
    }

    return result;
  }

  /** Clamp confidence to [0, 1]. Invalid or missing values default to 0.5. */
  private clampConfidence(finding: Finding): Finding {
    const raw = finding.confidence;
    if (raw === undefined || raw === null || isNaN(raw)) {
      return { ...finding, confidence: 0.5 };
    }
    const clamped = Math.max(0, Math.min(1, raw));
    if (clamped !== raw) {
      return { ...finding, confidence: clamped };
    }
    return finding;
  }

  /**
   * Cross-agent deduplication with intelligent merging.
   *
   * Two findings are considered duplicates when they share:
   * - Same file
   * - Same line (±LINE_PROXIMITY_THRESHOLD lines tolerance)
   * - Similar explanation (Jaccard similarity > threshold)
   *
   * Merged finding:
   * - Uses highest severity
   * - Recalculates confidence as weighted average (severity-weighted)
   * - Combines categories into merged_categories array
   * - Lists all originating agents in merged_agents
   */
  private deduplicateFindings(findings: Finding[]): Finding[] {
    const groups: Finding[][] = [];

    for (const finding of findings) {
      let merged = false;
      for (const group of groups) {
        if (this.isSimilar(group[0], finding)) {
          group.push(finding);
          merged = true;
          break;
        }
      }
      if (!merged) {
        groups.push([finding]);
      }
    }

    return groups.map((group) => this.mergeGroup(group));
  }

  private mergeGroup(group: Finding[]): Finding {
    if (group.length === 1) return group[0];

    group.sort(
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
      if (f.category) categories.add(f.category);

      const weight = SEVERITY_ORDER[f.severity] ?? 1;
      const conf = f.confidence ?? 0.5;
      weightedConfidenceSum += conf * weight;
      weightSum += weight;
    }

    const mergedConfidence =
      weightSum > 0
        ? Math.round((weightedConfidenceSum / weightSum) * 100) / 100
        : 0.5;

    const agentList = [...agents];
    const categoryList = [...categories];

    return {
      ...primary,
      confidence: mergedConfidence,
      agent_name: agentList.join(', '),
      merged_agents: agentList.length > 1 ? agentList : undefined,
      merged_categories: categoryList.length > 1 ? categoryList : undefined,
    };
  }

  private isSimilar(a: Finding, b: Finding): boolean {
    if (!a.file || !b.file || a.file !== b.file) return false;

    if (
      a.line !== undefined &&
      b.line !== undefined &&
      Math.abs(a.line - b.line) > LINE_PROXIMITY_THRESHOLD
    ) {
      return false;
    }

    if (a.line === undefined && b.line === undefined) {
      return this.messageSimilarity(a.message, b.message) > JACCARD_SIMILARITY_THRESHOLD;
    }

    return this.messageSimilarity(a.message, b.message) > JACCARD_SIMILARITY_THRESHOLD;
  }

  private messageSimilarity(msgA: string, msgB: string): number {
    const a = msgA.toLowerCase();
    const b = msgB.toLowerCase();

    if (a === b) return 1.0;

    const shorter = a.length < b.length ? a : b;
    const longer = a.length >= b.length ? a : b;
    if (longer.includes(shorter) && shorter.length > 20) return 0.9;

    const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 3));
    const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 3));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    const intersection = [...wordsA].filter((w) => wordsB.has(w));
    const union = new Set([...wordsA, ...wordsB]);
    return intersection.length / union.size;
  }

  /**
   * Diff boundary enforcement.
   *
   * If a finding references a file not in the diff or a line not covered
   * by any hunk, mark it outside_diff=true and reduce confidence to 0.4.
   */
  private enforceDiffBoundary(
    finding: Finding,
    diffFiles: ParsedFile[],
  ): Finding {
    if (!finding.file) return finding;

    const diffFile = diffFiles.find((df) => df.path === finding.file);
    if (!diffFile) {
      return {
        ...finding,
        outside_diff: true,
        confidence: Math.min(finding.confidence ?? 0.5, 0.4),
      };
    }

    if (finding.line === undefined) return finding;

    const lineInDiff = diffFile.hunks.some(
      (h) => finding.line! >= h.startLine && finding.line! <= h.endLine,
    );

    if (!lineInDiff) {
      return {
        ...finding,
        outside_diff: true,
        confidence: Math.min(finding.confidence ?? 0.5, 0.4),
      };
    }

    return finding;
  }

  /**
   * Confidence-severity coherence (PART 4).
   * If severity is critical but confidence < 0.6, downgrade to high.
   * Prevents overconfident hallucinated critical findings.
   */
  private applyConfidenceSeverityCoherence(finding: Finding): Finding {
    const confidence = finding.confidence ?? 0.5;
    if (finding.severity === 'critical' && confidence < 0.6) {
      return { ...finding, severity: 'high' };
    }
    return finding;
  }

  /**
   * If agent uses uncertainty phrases ("might", "possibly"), downgrade severity
   * by one level unless confidence is high (>= 0.8).
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

  /**
   * Quality enforcement (PART 8).
   * - message (explanation): truncate to 3 sentences max
   * - impact: truncate to 2 sentences max
   * - suggested_fix: no changes (must be actionable — enforced at agent prompt level)
   */
  private enforceQuality(finding: Finding): Finding {
    const updates: Partial<Finding> = {};

    if (finding.message) {
      updates.message = this.truncateToSentences(finding.message, 3);
    }
    if (finding.impact) {
      updates.impact = this.truncateToSentences(finding.impact, 2);
    }

    if (Object.keys(updates).length === 0) return finding;
    return { ...finding, ...updates };
  }

  private truncateToSentences(text: string, maxSentences: number): string {
    const sentences = text.match(/[^.!?]+[.!?]+/g);
    if (!sentences || sentences.length <= maxSentences) return text;
    return sentences.slice(0, maxSentences).join('').trim();
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
