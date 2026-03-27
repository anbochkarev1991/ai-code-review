import { Injectable } from '@nestjs/common';
import type { AgentOutput, Finding, ParsedFile } from 'shared';
import { getReviewDecision, riskSummaryFromCounts } from 'shared';
import type { ReviewSummary } from '../types';
import { FindingDeduplicatorService } from './finding-deduplicator.service';
import { FindingNormalizer } from './finding-normalizer';
import {
  buildReviewSummaryParagraph,
  detectSystemicPatterns,
} from './review-summary-text';

const AGENT_NAMES = [
  'Code Quality',
  'Architecture',
  'Performance',
  'Security',
] as const;

interface AggregatedResult {
  findings: Finding[];
  review_summary: ReviewSummary;
}

@Injectable()
export class DeterministicAggregator {
  constructor(
    private readonly findingNormalizer: FindingNormalizer,
    private readonly findingDeduplicator: FindingDeduplicatorService,
  ) {}

  async aggregate(
    agentOutputs: AgentOutput[],
    diffFiles?: ParsedFile[],
    strictMode = false,
  ): Promise<AggregatedResult> {
    const allFindings = this.mergeFindings(agentOutputs);
    const normalized = this.findingNormalizer.normalize(
      allFindings,
      diffFiles,
      strictMode,
    );
    const deduplicated = await this.findingDeduplicator.deduplicate(normalized);
    const reviewSummary = this.buildSummary(deduplicated);

    return { findings: deduplicated, review_summary: reviewSummary };
  }

  private mergeFindings(agentOutputs: AgentOutput[]): Finding[] {
    const merged: Finding[] = [];

    for (let i = 0; i < agentOutputs.length; i++) {
      const agentName = AGENT_NAMES[i] ?? `Agent ${i}`;
      const output = agentOutputs[i];

      for (const finding of output.findings) {
        merged.push({
          ...finding,
          confidence: finding.confidence ?? 0.7,
          agent_name: finding.agent_name ?? agentName,
        });
      }
    }

    return merged;
  }

  private buildSummary(findings: Finding[]): ReviewSummary {
    const rd = getReviewDecision(findings);

    const systemicPatterns = detectSystemicPatterns(findings);
    const multiAgentConfirmedCount = findings.filter(
      (f) => f.consensus_level === 'multi-agent',
    ).length;

    const text = buildReviewSummaryParagraph({
      findings,
      counts: rd.severityCounts,
      riskScore: rd.riskScore,
      riskLevel: rd.riskLevel,
      mergeRecommendation: rd.recommendation,
      primaryRiskCategory: rd.primaryRisk,
      systemicPatterns,
      multiAgentConfirmedCount,
    });

    const risk_summary = riskSummaryFromCounts({
      critical_count: rd.severityCounts.critical,
      high_count: rd.severityCounts.high,
      medium_count: rd.severityCounts.medium,
      low_count: rd.severityCounts.low,
      risk_score: rd.riskScore,
    });

    return {
      total_findings: findings.length,
      critical_count: rd.severityCounts.critical,
      high_count: rd.severityCounts.high,
      medium_count: rd.severityCounts.medium,
      low_count: rd.severityCounts.low,
      risk_score: rd.riskScore,
      risk_level: rd.riskLevel,
      risk_breakdown: rd.riskBreakdown,
      merge_recommendation: rd.recommendation,
      merge_explanation: rd.explanation,
      decision_verdict: rd.decision,
      primary_risk_category: rd.primaryRisk,
      most_severe_issue:
        findings.length > 0 ? findings[0].title : undefined,
      systemic_patterns:
        systemicPatterns.length > 0 ? systemicPatterns : undefined,
      multi_agent_confirmed_count:
        multiAgentConfirmedCount > 0 ? multiAgentConfirmedCount : undefined,
      text,
      risk_summary,
    };
  }
}
