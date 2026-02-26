import { Injectable } from '@nestjs/common';
import type { AgentOutput, Finding, ParsedFile } from 'shared';
import type { ReviewSummary } from '../types';
import { RiskEngine } from './risk-engine';
import { FindingNormalizer } from './finding-normalizer';

const AGENT_NAMES = ['Code Quality', 'Architecture', 'Performance', 'Security'] as const;

interface AggregatedResult {
  findings: Finding[];
  review_summary: ReviewSummary;
}

@Injectable()
export class DeterministicAggregator {
  constructor(
    private readonly riskEngine: RiskEngine,
    private readonly findingNormalizer: FindingNormalizer,
  ) {}

  aggregate(
    agentOutputs: AgentOutput[],
    diffFiles?: ParsedFile[],
    strictMode = false,
  ): AggregatedResult {
    const allFindings = this.mergeFindings(agentOutputs);
    const normalized = this.findingNormalizer.normalize(
      allFindings,
      diffFiles,
      strictMode,
    );
    const reviewSummary = this.buildSummary(normalized, agentOutputs);

    return { findings: normalized, review_summary: reviewSummary };
  }

  private mergeFindings(agentOutputs: AgentOutput[]): Finding[] {
    const merged: Finding[] = [];

    for (let i = 0; i < agentOutputs.length; i++) {
      const agentName = AGENT_NAMES[i] ?? `Agent ${i}`;
      const output = agentOutputs[i];

      for (const finding of output.findings) {
        merged.push({
          ...finding,
          confidence: finding.confidence ?? 0.5,
          agent_name: finding.agent_name ?? agentName,
        });
      }
    }

    return merged;
  }

  private buildSummary(
    findings: Finding[],
    agentOutputs: AgentOutput[],
  ): ReviewSummary {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of findings) {
      counts[f.severity]++;
    }

    const riskBreakdown = this.riskEngine.calculateRiskBreakdown(findings);
    const riskScore = riskBreakdown.final_score;
    const riskLevel = this.riskEngine.deriveRiskLevel(riskScore);
    const mergeDecision = this.riskEngine.deriveMergeDecision(
      riskScore,
      counts.critical,
      counts.high,
    );

    const primaryRiskCategory = this.derivePrimaryRiskCategory(findings);
    const mostSevereIssue = this.deriveMostSevereIssue(findings);

    const agentSummaries = agentOutputs
      .map((o, i) => {
        const name = AGENT_NAMES[i] ?? `Agent ${i}`;
        return o.summary ? `${name}: ${o.summary}` : null;
      })
      .filter(Boolean);

    const text = this.generateSummaryText({
      findings,
      counts,
      riskScore,
      riskLevel,
      mergeRecommendation: mergeDecision.recommendation,
      mergeExplanation: mergeDecision.explanation,
      primaryRiskCategory,
      mostSevereIssue,
      agentSummaries: agentSummaries as string[],
      floorApplied: riskBreakdown.floor_applied,
    });

    return {
      total_findings: findings.length,
      critical_count: counts.critical,
      high_count: counts.high,
      medium_count: counts.medium,
      low_count: counts.low,
      risk_score: riskScore,
      risk_level: riskLevel,
      risk_breakdown: riskBreakdown,
      merge_recommendation: mergeDecision.recommendation,
      merge_explanation: mergeDecision.explanation,
      primary_risk_category: primaryRiskCategory,
      most_severe_issue: mostSevereIssue,
      text,
    };
  }

  private derivePrimaryRiskCategory(findings: Finding[]): string | undefined {
    if (findings.length === 0) return undefined;

    const categoryScores: Record<string, number> = {};
    const severityWeight: Record<string, number> = {
      critical: 5, high: 3, medium: 2, low: 1,
    };

    for (const f of findings) {
      const cat = f.category || 'unknown';
      categoryScores[cat] = (categoryScores[cat] ?? 0) + (severityWeight[f.severity] ?? 1);
    }

    let maxCat = '';
    let maxScore = 0;
    for (const [cat, score] of Object.entries(categoryScores)) {
      if (score > maxScore) {
        maxCat = cat;
        maxScore = score;
      }
    }

    return maxCat || undefined;
  }

  private deriveMostSevereIssue(findings: Finding[]): string | undefined {
    if (findings.length === 0) return undefined;
    return findings[0].title;
  }

  private generateSummaryText(params: {
    findings: Finding[];
    counts: Record<string, number>;
    riskScore: number;
    riskLevel: string;
    mergeRecommendation: string;
    mergeExplanation: string;
    primaryRiskCategory?: string;
    mostSevereIssue?: string;
    agentSummaries: string[];
    floorApplied?: string;
  }): string {
    const {
      findings, counts, riskScore, riskLevel,
      mergeRecommendation, mergeExplanation,
      primaryRiskCategory, mostSevereIssue, agentSummaries,
      floorApplied,
    } = params;

    if (findings.length === 0) {
      return 'No issues found in this Pull Request. The changes appear clean across all review dimensions. Recommendation: Safe to merge.';
    }

    const parts: string[] = [];

    parts.push(
      `Found ${findings.length} issue${findings.length === 1 ? '' : 's'} across the changed files.`,
    );

    if (mostSevereIssue) {
      parts.push(`Most severe: ${mostSevereIssue}.`);
    }

    if (primaryRiskCategory) {
      parts.push(`Primary risk category: ${primaryRiskCategory}.`);
    }

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

    parts.push(`Risk: ${riskScore}/100 (${riskLevel}).`);

    if (floorApplied) {
      parts.push(floorApplied);
    }

    parts.push(mergeExplanation);

    if (agentSummaries.length > 0) {
      parts.push(agentSummaries.join(' '));
    }

    return parts.join(' ');
  }
}
