import { Injectable } from '@nestjs/common';
import type { Finding, FindingSeverity } from 'shared';

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const SEVERITY_UPGRADE: Record<FindingSeverity, FindingSeverity> = {
  low: 'medium',
  medium: 'high',
  high: 'critical',
  critical: 'critical',
};

const MAX_HIGH_PER_REVIEW = 3;
const LOW_CONFIDENCE_THRESHOLD = 0.75;
const CRITICAL_CONFIDENCE_THRESHOLD = 0.75;
const MULTI_AGENT_BOOST_CONFIDENCE_MIN = 0.8;
const TOTAL_FINDINGS_OVERFLOW = 5;

export interface SeverityNormalizationStats {
  before: Record<FindingSeverity, number>;
  after: Record<FindingSeverity, number>;
  downgradedCount: number;
  upgradedCount: number;
  mergedRootCauseCount: number;
}

/**
 * Post-processing layer that tames LLM severity inflation and boosts multi-agent consensus.
 *
 * Rules (applied in order):
 * 0. If severity CRITICAL and confidence < 0.75 → downgrade to HIGH
 * 1. If confidence < 0.75 and severity HIGH → downgrade to MEDIUM
 * 2. If consensus_level = multi-agent and confidence >= 0.8 → boost severity by one level (MEDIUM → HIGH)
 * 3. Cap max HIGH findings per category at 3
 * 4. If total > 5 findings, downgrade lowest-confidence HIGHs to MEDIUM (max 3 HIGH unless multi-agent agreed)
 * 5. Merge root cause findings (same file + category + overlapping title words)
 *
 * All rules are deterministic.
 */
@Injectable()
export class SeverityNormalizer {
  normalize(findings: Finding[]): Finding[] {
    let result = [...findings];

    result = this.downgradeCriticalByLowConfidence(result);
    result = this.downgradeByLowConfidence(result);
    result = this.boostMultiAgentConsensus(result);
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

    let result = [...findings];
    result = this.downgradeCriticalByLowConfidence(result);
    result = this.downgradeByLowConfidence(result);
    const afterDowngrade = this.countSeverities(result);
    result = this.boostMultiAgentConsensus(result);
    const afterBoost = this.countSeverities(result);
    result = this.capHighPerCategory(result);
    result = this.downgradeOverflowFindings(result);
    result = this.mergeRootCauseFindings(result);

    const after = this.countSeverities(result);

    const downgradedCount =
      Math.max(
        0,
        before.high -
          afterDowngrade.high +
          (before.critical - afterDowngrade.critical),
      ) + Math.max(0, afterBoost.high - after.high);
    const upgradedCount = Math.max(0, afterBoost.high - afterDowngrade.high);
    const mergedRootCauseCount = Math.max(0, findings.length - result.length);

    return {
      findings: result,
      stats: {
        before,
        after,
        downgradedCount,
        upgradedCount,
        mergedRootCauseCount,
      },
    };
  }

  /**
   * Rule 0: If severity is CRITICAL and confidence < 0.75 → downgrade to HIGH.
   */
  private downgradeCriticalByLowConfidence(findings: Finding[]): Finding[] {
    return findings.map((f) => {
      if (
        f.severity === 'critical' &&
        f.confidence < CRITICAL_CONFIDENCE_THRESHOLD
      ) {
        return { ...f, severity: 'high' as FindingSeverity };
      }
      return f;
    });
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
   * Rule 2: If consensus_level = multi-agent and confidence >= 0.8, boost severity by one level.
   * (MEDIUM → HIGH, LOW → MEDIUM, etc.) Gated to avoid inflating speculative agreement.
   */
  private boostMultiAgentConsensus(findings: Finding[]): Finding[] {
    return findings.map((f) => {
      if (
        f.consensus_level === 'multi-agent' &&
        f.confidence >= MULTI_AGENT_BOOST_CONFIDENCE_MIN &&
        f.severity !== 'critical'
      ) {
        return { ...f, severity: SEVERITY_UPGRADE[f.severity] };
      }
      return f;
    });
  }

  /**
   * Rule 3: Max 3 HIGH findings per category.
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
      if (count >= MAX_HIGH_PER_REVIEW) {
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
   * Rule 4: If total findings > 5, enforce max 3 HIGH unless multi-agent agreed.
   * Multi-agent consensus findings are exempt from overflow downgrade.
   */
  private downgradeOverflowFindings(findings: Finding[]): Finding[] {
    if (findings.length <= TOTAL_FINDINGS_OVERFLOW) return findings;

    const multiAgentHighCount = findings.filter(
      (f) => f.severity === 'high' && f.consensus_level === 'multi-agent',
    ).length;

    const maxHighAllowed = Math.max(MAX_HIGH_PER_REVIEW, multiAgentHighCount);

    const highIndices = findings
      .map((f, i) => ({
        confidence: f.confidence,
        index: i,
        isMultiAgent: f.consensus_level === 'multi-agent',
      }))
      .filter((item, i) => findings[i].severity === 'high')
      .sort((a, b) => {
        if (a.isMultiAgent !== b.isMultiAgent) return a.isMultiAgent ? 1 : -1;
        return a.confidence - b.confidence;
      });

    const excessCount = highIndices.length - maxHighAllowed;
    if (excessCount <= 0) return findings;

    const singleAgentHighs = highIndices.filter((h) => !h.isMultiAgent);
    const toDowngrade = new Set(
      singleAgentHighs.slice(0, excessCount).map((h) => h.index),
    );

    return findings.map((f, i) => {
      if (toDowngrade.has(i)) {
        return { ...f, severity: 'medium' as FindingSeverity };
      }
      return f;
    });
  }

  /**
   * Rule 5: Merge root cause findings (same file + category + overlapping title).
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
        if (primary.severity !== 'high' && primary.severity !== 'critical') {
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
    const consensus: Finding['consensus_level'] =
      agentList.length > 1 ? 'multi-agent' : primary.consensus_level;

    return {
      ...primary,
      confidence: bestConfidence,
      impact: bestImpact ?? primary.impact,
      suggested_fix: bestFix ?? primary.suggested_fix,
      agent_name:
        agentList.length > 0 ? agentList.join(', ') : primary.agent_name,
      merged_agents: agentList.length > 1 ? agentList : primary.merged_agents,
      consensus_level: consensus,
    };
  }

  private countSeverities(
    findings: Finding[],
  ): Record<FindingSeverity, number> {
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
