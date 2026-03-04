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
    const systemicPatterns = this.detectSystemicPatterns(findings);
    const multiAgentConfirmedCount = findings.filter(
      (f) => f.consensus_level === 'multi-agent',
    ).length;

    const text = this.generateIntelligentSummary({
      findings,
      counts,
      riskScore,
      riskLevel,
      mergeRecommendation: mergeDecision.recommendation,
      primaryRiskCategory,
      mostSevereIssue,
      systemicPatterns,
      multiAgentConfirmedCount,
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
      systemic_patterns: systemicPatterns.length > 0 ? systemicPatterns : undefined,
      multi_agent_confirmed_count: multiAgentConfirmedCount > 0 ? multiAgentConfirmedCount : undefined,
      text,
    };
  }

  private derivePrimaryRiskCategory(findings: Finding[]): string | undefined {
    if (findings.length === 0) return undefined;

    const categoryScores: Record<string, number> = {};
    const severityWeight: Record<string, number> = {
      critical: 50, high: 15, medium: 5, low: 1,
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

  /**
   * Detects systemic patterns across findings.
   * A pattern is "systemic" if 3+ findings share the same category,
   * or if the same issue type appears across 2+ files.
   */
  private detectSystemicPatterns(findings: Finding[]): string[] {
    const patterns: string[] = [];

    const categoryCount: Record<string, number> = {};
    for (const f of findings) {
      const cat = f.category || 'unknown';
      categoryCount[cat] = (categoryCount[cat] ?? 0) + 1;
    }

    for (const [cat, count] of Object.entries(categoryCount)) {
      if (count >= 3) {
        patterns.push(`Recurring ${cat} issues (${count} findings)`);
      }
    }

    const titleWords = new Map<string, Set<string>>();
    for (const f of findings) {
      if (!f.file) continue;
      const words = f.title.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
      for (const word of words) {
        if (!titleWords.has(word)) titleWords.set(word, new Set());
        titleWords.get(word)!.add(f.file);
      }
    }

    for (const [word, files] of titleWords) {
      if (files.size >= 2) {
        const keywords = ['injection', 'error', 'handling', 'validation', 'missing', 'unsafe', 'async', 'memory', 'leak'];
        if (keywords.includes(word)) {
          patterns.push(`Cross-file "${word}" pattern across ${files.size} files`);
        }
      }
    }

    return [...new Set(patterns)].slice(0, 3);
  }

  /**
   * Generates a deterministic, intelligent summary paragraph.
   *
   * Constraints:
   * - Maximum 4 sentences
   * - Mentions the most severe category
   * - Mentions systemic patterns if detected
   * - References multi-agent consensus if present
   */
  private generateIntelligentSummary(params: {
    findings: Finding[];
    counts: Record<string, number>;
    riskScore: number;
    riskLevel: string;
    mergeRecommendation: string;
    primaryRiskCategory?: string;
    mostSevereIssue?: string;
    systemicPatterns: string[];
    multiAgentConfirmedCount: number;
  }): string {
    const {
      findings, counts, riskScore, riskLevel,
      mergeRecommendation, primaryRiskCategory, mostSevereIssue,
      systemicPatterns, multiAgentConfirmedCount,
    } = params;

    if (findings.length === 0) {
      return 'No issues found in this Pull Request. The changes appear clean across all review dimensions. Recommendation: Safe to merge.';
    }

    const sentences: string[] = [];

    if (counts.critical > 0 && primaryRiskCategory) {
      sentences.push(
        `This PR introduces ${counts.critical} critical ${primaryRiskCategory} concern${counts.critical === 1 ? '' : 's'} requiring immediate attention.`,
      );
    } else if (counts.high > 0 && primaryRiskCategory) {
      sentences.push(
        `This PR raises ${primaryRiskCategory} concerns with ${counts.high} high-severity finding${counts.high === 1 ? '' : 's'} identified across the changed files.`,
      );
    } else {
      sentences.push(
        `Found ${findings.length} issue${findings.length === 1 ? '' : 's'} across the changed files (risk: ${riskScore}/100, ${riskLevel}).`,
      );
    }

    if (systemicPatterns.length > 0) {
      const patternDesc = systemicPatterns.length === 1
        ? systemicPatterns[0].toLowerCase()
        : `${systemicPatterns.length} systemic patterns detected`;
      sentences.push(
        `Analysis reveals ${patternDesc}, suggesting structural gaps rather than isolated incidents.`,
      );
    }

    if (multiAgentConfirmedCount > 0) {
      sentences.push(
        `${multiAgentConfirmedCount} finding${multiAgentConfirmedCount === 1 ? ' was' : 's were'} independently confirmed by multiple agents, increasing confidence in their accuracy.`,
      );
    }

    if (sentences.length < 4) {
      if (mergeRecommendation === 'Merge blocked') {
        sentences.push('Recommendation: Block merge until critical issues are resolved.');
      } else if (mergeRecommendation === 'Merge with caution') {
        sentences.push('Recommendation: Proceed with caution and address high-severity findings before production deployment.');
      } else {
        sentences.push('Recommendation: Safe to merge.');
      }
    }

    return sentences.slice(0, 4).join(' ');
  }
}
