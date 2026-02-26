import { Injectable } from '@nestjs/common';
import type { Finding, FindingSeverity, ParsedFile, DiffContext } from 'shared';

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

const LINE_PROXIMITY_THRESHOLD = 3;
const JACCARD_SIMILARITY_THRESHOLD = 0.5;
const TITLE_SIMILARITY_THRESHOLD = 0.4;

const BASE_CONFIDENCE_CAP = 0.85;
const MULTI_AGENT_BOOST = 0.05;
const OUTSIDE_DIFF_MULTIPLIER = 0.6;
const CONFIDENCE_MIN = 0.3;
const CONFIDENCE_MAX = 0.95;
const DIFF_CONTEXT_LINES = 3;

@Injectable()
export class FindingNormalizer {
  normalize(
    findings: Finding[],
    diffFiles?: ParsedFile[],
    strictMode = false,
  ): Finding[] {
    let result = findings.map((f) => this.clampConfidence(f));

    result = result.map((f) => this.capBaseConfidence(f));

    result = diffFiles
      ? result.map((f) => this.enforceDiffBoundary(f, diffFiles))
      : result;

    result = this.deduplicateFindings(result);

    result = result.map((f) => this.applyConfidenceSeverityCoherence(f));
    result = result.map((f) => this.applyUncertaintyDowngrade(f));
    result = result.map((f) => this.enforceQuality(f));

    result = result.map((f) => this.finalConfidenceClamp(f));

    if (diffFiles) {
      result = result.map((f) => this.attachDiffContext(f, diffFiles));
    }

    result = this.sortFindings(result);

    if (strictMode) {
      result = result.filter((f) => !f.outside_diff);
      result = result.filter((f) => f.confidence >= 0.6);
    }

    return result;
  }

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

  /** Per-agent confidence cap at 0.85 before any boosting */
  private capBaseConfidence(finding: Finding): Finding {
    if (finding.confidence > BASE_CONFIDENCE_CAP) {
      return { ...finding, confidence: BASE_CONFIDENCE_CAP };
    }
    return finding;
  }

  /** Final clamp to [0.3, 0.95] */
  private finalConfidenceClamp(finding: Finding): Finding {
    const clamped = Math.max(CONFIDENCE_MIN, Math.min(CONFIDENCE_MAX, finding.confidence));
    if (clamped !== finding.confidence) {
      return { ...finding, confidence: Math.round(clamped * 100) / 100 };
    }
    return finding;
  }

  /**
   * Deduplication with three matching signals:
   * 1. Same file
   * 2. Line delta <= 3
   * 3. Title similarity OR message similarity above threshold
   */
  private deduplicateFindings(findings: Finding[]): Finding[] {
    const groups: Finding[][] = [];

    for (const finding of findings) {
      let merged = false;
      for (const group of groups) {
        if (this.isDuplicate(group[0], finding)) {
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

  private isDuplicate(a: Finding, b: Finding): boolean {
    if (!a.file || !b.file || a.file !== b.file) return false;

    if (
      a.line !== undefined &&
      b.line !== undefined &&
      Math.abs(a.line - b.line) > LINE_PROXIMITY_THRESHOLD
    ) {
      return false;
    }

    const titleSim = this.textSimilarity(a.title, b.title);
    if (titleSim > TITLE_SIMILARITY_THRESHOLD) return true;

    return this.textSimilarity(a.message, b.message) > JACCARD_SIMILARITY_THRESHOLD;
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
      weightedConfidenceSum += f.confidence * weight;
      weightSum += weight;
    }

    let mergedConfidence =
      weightSum > 0
        ? weightedConfidenceSum / weightSum
        : 0.5;

    if (agents.size > 1) {
      mergedConfidence += MULTI_AGENT_BOOST;
    }

    mergedConfidence = Math.round(mergedConfidence * 100) / 100;

    const agentList = [...agents];
    const categoryList = [...categories];

    const bestImpact = group
      .map(f => f.impact)
      .filter(Boolean)
      .sort((a, b) => (b?.length ?? 0) - (a?.length ?? 0))[0];

    const bestFix = group
      .map(f => f.suggested_fix)
      .filter(Boolean)
      .sort((a, b) => (b?.length ?? 0) - (a?.length ?? 0))[0];

    return {
      ...primary,
      confidence: mergedConfidence,
      impact: bestImpact ?? primary.impact,
      suggested_fix: bestFix ?? primary.suggested_fix,
      agent_name: agentList.join(', '),
      merged_agents: agentList.length > 1 ? agentList : undefined,
      merged_categories: categoryList.length > 1 ? categoryList : undefined,
    };
  }

  private textSimilarity(textA: string, textB: string): number {
    const a = textA.toLowerCase();
    const b = textB.toLowerCase();

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
        confidence: finding.confidence * OUTSIDE_DIFF_MULTIPLIER,
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
        confidence: finding.confidence * OUTSIDE_DIFF_MULTIPLIER,
      };
    }

    return finding;
  }

  private applyConfidenceSeverityCoherence(finding: Finding): Finding {
    if (finding.severity === 'critical' && finding.confidence < 0.6) {
      return { ...finding, severity: 'high' };
    }
    return finding;
  }

  private applyUncertaintyDowngrade(finding: Finding): Finding {
    const message = finding.message.toLowerCase();

    if (finding.confidence >= 0.8) return finding;

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

  /** Attach surrounding diff context to a finding for inline code preview */
  private attachDiffContext(finding: Finding, diffFiles: ParsedFile[]): Finding {
    if (!finding.file || finding.line === undefined) return finding;

    const diffFile = diffFiles.find((df) => df.path === finding.file);
    if (!diffFile) return finding;

    for (const hunk of diffFile.hunks) {
      if (finding.line >= hunk.startLine && finding.line <= hunk.endLine) {
        const hunkLines = hunk.content.split('\n');
        const lineOffset = finding.line - hunk.startLine;

        const snippetStart = Math.max(0, lineOffset - DIFF_CONTEXT_LINES);
        const snippetEnd = Math.min(hunkLines.length, lineOffset + DIFF_CONTEXT_LINES + 1);

        const contextBefore = hunkLines.slice(snippetStart, lineOffset).join('\n');
        const snippet = hunkLines[lineOffset] ?? '';
        const contextAfter = hunkLines.slice(lineOffset + 1, snippetEnd).join('\n');

        const diffContext: DiffContext = {
          snippet,
          diff_context_before: contextBefore,
          diff_context_after: contextAfter,
        };

        return { ...finding, diff_context: diffContext };
      }
    }

    return finding;
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
      return b.confidence - a.confidence;
    });
  }
}
