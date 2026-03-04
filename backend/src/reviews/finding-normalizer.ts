import { Injectable } from '@nestjs/common';
import type {
  Finding,
  FindingSeverity,
  ParsedFile,
  DiffContext,
  AffectedLocation,
  ConsensusLevel,
  FalsePositiveRisk,
} from 'shared';

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

    result = this.consolidateFindings(result);

    result = result.map((f) => this.applyConfidenceSeverityCoherence(f));
    result = result.map((f) => this.applyUncertaintyDowngrade(f));
    result = result.map((f) => this.enforceQuality(f));

    result = result.map((f) => this.assignFalsePositiveRisk(f));

    result = result.map((f) => this.finalConfidenceClamp(f));

    if (diffFiles) {
      result = result.map((f) => this.attachDiffContext(f, diffFiles));
    }

    result = this.sortFindings(result);

    if (strictMode) {
      result = result.filter((f) => !f.outside_diff);
      result = result.filter((f) => f.confidence >= 0.6);
    }

    result = this.deduplicateIds(result);

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

  private capBaseConfidence(finding: Finding): Finding {
    if (finding.confidence > BASE_CONFIDENCE_CAP) {
      return { ...finding, confidence: BASE_CONFIDENCE_CAP };
    }
    return finding;
  }

  private finalConfidenceClamp(finding: Finding): Finding {
    const clamped = Math.max(CONFIDENCE_MIN, Math.min(CONFIDENCE_MAX, finding.confidence));
    if (clamped !== finding.confidence) {
      return { ...finding, confidence: Math.round(clamped * 100) / 100 };
    }
    return finding;
  }

  /**
   * Smart consolidation: merges findings that reference the same file,
   * share similar explanation/fix, and are within 3 lines of each other.
   *
   * Produces consolidated findings with:
   * - affected_locations: all unique file+line pairs
   * - categories: all unique categories
   * - consensus_level: multi-agent if >1 distinct agent contributed
   */
  private consolidateFindings(findings: Finding[]): Finding[] {
    const groups: Finding[][] = [];

    for (const finding of findings) {
      let merged = false;
      for (const group of groups) {
        if (this.shouldConsolidate(group[0], finding)) {
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

  /**
   * Two findings should consolidate when they share:
   * 1. Same file
   * 2. Lines within proximity threshold
   * 3. Similar title OR similar message OR similar suggested_fix
   */
  private shouldConsolidate(a: Finding, b: Finding): boolean {
    if (!a.file || !b.file || a.file !== b.file) return false;

    if (
      a.line !== undefined &&
      b.line !== undefined &&
      Math.abs(a.line - b.line) > LINE_PROXIMITY_THRESHOLD
    ) {
      return false;
    }

    if (this.textSimilarity(a.title, b.title) > TITLE_SIMILARITY_THRESHOLD) return true;
    if (this.textSimilarity(a.message, b.message) > JACCARD_SIMILARITY_THRESHOLD) return true;

    if (a.suggested_fix && b.suggested_fix) {
      if (this.textSimilarity(a.suggested_fix, b.suggested_fix) > JACCARD_SIMILARITY_THRESHOLD) {
        return true;
      }
    }

    return false;
  }

  private mergeGroup(group: Finding[]): Finding {
    if (group.length === 1) {
      const single = group[0];
      const agents = this.extractAgents(single);
      const consensus: ConsensusLevel = agents.size > 1 ? 'multi-agent' : 'single-agent';
      const categories = new Set<string>();
      if (single.category) categories.add(single.category);
      const locations = this.extractLocations(group);

      return {
        ...single,
        consensus_level: consensus,
        categories: categories.size > 0 ? [...categories] : undefined,
        affected_locations: locations.length > 0 ? locations : undefined,
      };
    }

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
    const consensus: ConsensusLevel = agents.size > 1 ? 'multi-agent' : 'single-agent';
    const locations = this.extractLocations(group);

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
      categories: categoryList.length > 0 ? categoryList : undefined,
      consensus_level: consensus,
      affected_locations: locations.length > 0 ? locations : undefined,
    };
  }

  private extractAgents(finding: Finding): Set<string> {
    const agents = new Set<string>();
    if (finding.agent_name) {
      for (const name of finding.agent_name.split(', ')) {
        agents.add(name.trim());
      }
    }
    if (finding.merged_agents) {
      for (const name of finding.merged_agents) {
        agents.add(name.trim());
      }
    }
    return agents;
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
    }
    return locations;
  }

  private assignFalsePositiveRisk(finding: Finding): Finding {
    let risk: FalsePositiveRisk;

    if (finding.consensus_level === 'multi-agent') {
      risk = 'low';
    } else if (finding.outside_diff) {
      risk = 'high';
    } else if (finding.consensus_level === 'single-agent' && finding.confidence < 0.7) {
      risk = 'high';
    } else {
      risk = 'medium';
    }

    return { ...finding, false_positive_risk: risk };
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

      const consensusDiff =
        (a.consensus_level === 'multi-agent' ? 0 : 1) -
        (b.consensus_level === 'multi-agent' ? 0 : 1);
      if (consensusDiff !== 0) return consensusDiff;

      return b.confidence - a.confidence;
    });
  }

  /**
   * Re-assigns IDs to guarantee uniqueness. LLM-generated IDs (e.g. "sec-1")
   * can collide across agents or diff chunks.
   */
  private deduplicateIds(findings: Finding[]): Finding[] {
    const seen = new Set<string>();
    return findings.map((f, index) => {
      if (seen.has(f.id)) {
        const prefix = f.category ?? 'f';
        return { ...f, id: `${prefix}-${index + 1}` };
      }
      seen.add(f.id);
      return f;
    });
  }
}
