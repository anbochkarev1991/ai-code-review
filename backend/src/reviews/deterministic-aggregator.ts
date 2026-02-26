import { Injectable } from '@nestjs/common';
import type { AgentOutput, Finding, FindingSeverity } from 'shared';
import type { ReviewSummary } from '../types';

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const SEVERITY_WEIGHT: Record<FindingSeverity, number> = {
  critical: 25,
  high: 10,
  medium: 3,
  low: 1,
};

const AGENT_NAMES = ['Code Quality', 'Architecture', 'Performance', 'Security'] as const;

interface AggregatedResult {
  findings: Finding[];
  review_summary: ReviewSummary;
}

/**
 * Deterministic aggregator that merges findings from domain agents
 * without making LLM calls. Replaces the previous LLM-based AggregatorAgent.
 */
@Injectable()
export class DeterministicAggregator {
  aggregate(agentOutputs: AgentOutput[]): AggregatedResult {
    const allFindings = this.mergeFindings(agentOutputs);
    const deduplicated = this.deduplicateFindings(allFindings);
    const sorted = this.sortFindings(deduplicated);
    const reviewSummary = this.buildSummary(sorted, agentOutputs);

    return { findings: sorted, review_summary: reviewSummary };
  }

  private mergeFindings(agentOutputs: AgentOutput[]): Finding[] {
    const merged: Finding[] = [];

    for (let i = 0; i < agentOutputs.length; i++) {
      const agentName = AGENT_NAMES[i] ?? `Agent ${i}`;
      const output = agentOutputs[i];

      for (const finding of output.findings) {
        merged.push({
          ...finding,
          agent_name: finding.agent_name ?? agentName,
        });
      }
    }

    return merged;
  }

  /**
   * Deduplicates findings by (file + line + message similarity).
   * When two findings match, keeps the one with higher severity,
   * or higher confidence if severity is equal.
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
          unique[existingIndex] = finding;
        }
      }
    }

    return unique;
  }

  private isSimilar(a: Finding, b: Finding): boolean {
    if (a.file && b.file && a.file !== b.file) return false;
    if (a.line && b.line && Math.abs(a.line - b.line) > 3) return false;

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

  private sortFindings(findings: Finding[]): Finding[] {
    return [...findings].sort((a, b) => {
      const sevDiff =
        (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0);
      if (sevDiff !== 0) return sevDiff;
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    });
  }

  private buildSummary(
    findings: Finding[],
    agentOutputs: AgentOutput[],
  ): ReviewSummary {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of findings) {
      counts[f.severity]++;
    }

    const riskScore = this.calculateRiskScore(findings);

    const agentSummaries = agentOutputs
      .map((o, i) => {
        const name = AGENT_NAMES[i] ?? `Agent ${i}`;
        return o.summary ? `${name}: ${o.summary}` : null;
      })
      .filter(Boolean);

    let text: string;
    if (findings.length === 0) {
      text =
        'No issues found in this Pull Request. The changes appear clean across all review dimensions.';
    } else {
      const parts: string[] = [];
      parts.push(
        `Found ${findings.length} issue${findings.length === 1 ? '' : 's'} across the changed files.`,
      );

      if (counts.critical > 0) {
        parts.push(
          `${counts.critical} critical issue${counts.critical === 1 ? '' : 's'} require${counts.critical === 1 ? 's' : ''} immediate attention.`,
        );
      }
      if (counts.high > 0) {
        parts.push(
          `${counts.high} high-severity finding${counts.high === 1 ? '' : 's'} should be addressed before merging.`,
        );
      }

      parts.push(`Overall risk score: ${riskScore}/100.`);

      if (agentSummaries.length > 0) {
        parts.push(agentSummaries.join(' '));
      }

      text = parts.join(' ');
    }

    return {
      total_findings: findings.length,
      critical_count: counts.critical,
      high_count: counts.high,
      medium_count: counts.medium,
      low_count: counts.low,
      risk_score: riskScore,
      text,
    };
  }

  /**
   * Calculates risk score (0-100) weighted by severity and confidence.
   * Formula: sum(severity_weight * confidence) for each finding, clamped to 100.
   */
  private calculateRiskScore(findings: Finding[]): number {
    if (findings.length === 0) return 0;

    const rawScore = findings.reduce((sum, f) => {
      const weight = SEVERITY_WEIGHT[f.severity] ?? 1;
      const confidence = f.confidence ?? 0.5;
      return sum + weight * confidence;
    }, 0);

    return Math.min(100, Math.round(rawScore));
  }
}
