import { Injectable } from '@nestjs/common';
import type {
  Finding,
  FindingSeverity,
  RiskLevel,
  RiskBreakdown,
} from 'shared';
import { decideMerge, type MergeDecision } from 'shared';

const SEVERITY_WEIGHT: Record<FindingSeverity, number> = {
  critical: 5,
  high: 3,
  medium: 2,
  low: 1,
};

const CATEGORY_IMPACT_WEIGHT: Record<string, number> = {
  security: 1.5,
  architecture: 1.2,
  performance: 1.1,
  'code-quality': 1.0,
};

const RISK_FLOOR_CRITICAL = 70;
const RISK_FLOOR_HIGH_3PLUS = 60;
const RISK_FLOOR_BLOCK_MERGE = 50;
const MULTI_CATEGORY_BOOST_PER = 2;

/**
 * Risk engine — deterministic scoring with floor enforcement and breakdown transparency.
 *
 * Guarantees:
 * - calculateRiskScore is pure: same findings → same integer score
 * - Floors enforce semantic alignment between severity and score
 * - Risk breakdown provides full auditability of the computation
 */
@Injectable()
export class RiskEngine {
  calculateRiskScore(findings: Finding[]): number {
    return this.calculateRiskBreakdown(findings).final_score;
  }

  calculateRiskBreakdown(findings: Finding[]): RiskBreakdown {
    if (findings.length === 0) {
      return {
        raw_score: 0,
        severity_contribution: { critical: 0, high: 0, medium: 0, low: 0 },
        category_contribution: {},
        multi_category_boost: 0,
        final_score: 0,
      };
    }

    const severityContribution: Record<FindingSeverity, number> = {
      critical: 0, high: 0, medium: 0, low: 0,
    };
    const categoryContribution: Record<string, number> = {};

    let rawScore = 0;
    for (const f of findings) {
      const severityW = SEVERITY_WEIGHT[f.severity] ?? 1;
      const confidence = this.clampConfidence(f.confidence);
      const categoryW = CATEGORY_IMPACT_WEIGHT[f.category] ?? 1.0;
      const contribution = severityW * confidence * categoryW;

      rawScore += contribution;
      severityContribution[f.severity] += contribution;
      categoryContribution[f.category] = (categoryContribution[f.category] ?? 0) + contribution;
    }

    const uniqueCategories = new Set(findings.map(f => f.category));
    const multiCategoryBoost = uniqueCategories.size > 1
      ? (uniqueCategories.size - 1) * MULTI_CATEGORY_BOOST_PER
      : 0;

    let score = Math.trunc(rawScore + multiCategoryBoost);

    let floorApplied: string | undefined;
    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const highCount = findings.filter(f => f.severity === 'high').length;

    if (criticalCount > 0 && score < RISK_FLOOR_CRITICAL) {
      score = RISK_FLOOR_CRITICAL;
      floorApplied = `Floor ${RISK_FLOOR_CRITICAL} applied: critical finding present.`;
    } else if (highCount >= 3 && score < RISK_FLOOR_HIGH_3PLUS) {
      score = RISK_FLOOR_HIGH_3PLUS;
      floorApplied = `Floor ${RISK_FLOOR_HIGH_3PLUS} applied: ${highCount} high severity findings.`;
    }

    score = Math.min(100, score);

    if (this.wouldBlockMerge(criticalCount) && score < RISK_FLOOR_BLOCK_MERGE) {
      score = RISK_FLOOR_BLOCK_MERGE;
      floorApplied = `Floor ${RISK_FLOOR_BLOCK_MERGE} applied: merge-blocking condition met.`;
    }

    return {
      raw_score: Math.trunc(rawScore),
      severity_contribution: severityContribution,
      category_contribution: categoryContribution,
      floor_applied: floorApplied,
      multi_category_boost: multiCategoryBoost,
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

  private wouldBlockMerge(criticalCount: number): boolean {
    return criticalCount > 0;
  }

  private clampConfidence(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
