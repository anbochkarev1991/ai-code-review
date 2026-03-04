import { Injectable } from '@nestjs/common';
import type {
  Finding,
  FindingSeverity,
  RiskLevel,
  RiskBreakdown,
} from 'shared';
import { decideMerge, type MergeDecision } from 'shared';

/**
 * Weighted severity model:
 * critical = 50, high = 15, medium = 5, low = 1
 *
 * Diminishing return formula:
 *   score = 100 * (1 - e^(-sum(weights) / 100))
 *
 * If critical exists → minimum score = 70
 * Result clamped to [0, 100] and returned as integer.
 */

const SEVERITY_WEIGHT: Record<FindingSeverity, number> = {
  critical: 50,
  high: 15,
  medium: 5,
  low: 1,
};

const RISK_FLOOR_CRITICAL = 70;

@Injectable()
export class RiskEngine {
  calculateRiskScore(findings: Finding[]): number {
    return this.calculateRiskBreakdown(findings).final_score;
  }

  calculateRiskBreakdown(findings: Finding[]): RiskBreakdown {
    if (findings.length === 0) {
      return {
        raw_weighted_sum: 0,
        severity_contribution: { critical: 0, high: 0, medium: 0, low: 0 },
        category_contribution: {},
        diminishing_return_score: 0,
        final_score: 0,
      };
    }

    const severityContribution: Record<FindingSeverity, number> = {
      critical: 0, high: 0, medium: 0, low: 0,
    };
    const categoryContribution: Record<string, number> = {};

    let rawWeightedSum = 0;
    for (const f of findings) {
      const weight = SEVERITY_WEIGHT[f.severity] ?? 1;
      rawWeightedSum += weight;
      severityContribution[f.severity] += weight;
      categoryContribution[f.category] = (categoryContribution[f.category] ?? 0) + weight;
    }

    const diminishingScore = 100 * (1 - Math.exp(-rawWeightedSum / 100));

    let score = Math.round(diminishingScore);

    let floorApplied: string | undefined;
    const hasCritical = findings.some(f => f.severity === 'critical');

    if (hasCritical && score < RISK_FLOOR_CRITICAL) {
      score = RISK_FLOOR_CRITICAL;
      floorApplied = `Floor ${RISK_FLOOR_CRITICAL} applied: critical finding present.`;
    }

    score = Math.max(0, Math.min(100, score));

    return {
      raw_weighted_sum: rawWeightedSum,
      severity_contribution: severityContribution,
      category_contribution: categoryContribution,
      floor_applied: floorApplied,
      diminishing_return_score: Math.round(diminishingScore),
      final_score: score,
    };
  }

  deriveRiskLevel(riskScore: number): RiskLevel {
    if (riskScore >= 81) return 'Critical';
    if (riskScore >= 61) return 'High';
    if (riskScore >= 31) return 'Moderate';
    return 'Low risk';
  }

  deriveMergeDecision(
    riskScore: number,
    criticalCount: number,
    highCount: number,
  ): MergeDecision {
    return decideMerge({
      critical_count: criticalCount,
      high_count: highCount,
      risk_score: riskScore,
    });
  }
}
