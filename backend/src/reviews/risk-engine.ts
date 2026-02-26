import { Injectable } from '@nestjs/common';
import type {
  Finding,
  FindingSeverity,
  RiskLevel,
} from 'shared';
import { decideMerge, type MergeDecision } from 'shared';

/**
 * Severity weight: how much each severity level contributes to the risk score.
 *
 * Calibrated so that a single critical finding at full confidence scores 7.5
 * (5 × 1.0 × 1.5 for a security issue), while low-confidence medium findings
 * barely move the needle.
 */
const SEVERITY_WEIGHT: Record<FindingSeverity, number> = {
  critical: 5,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Impact multiplier by finding category.
 *
 * Security issues receive the highest multiplier because their blast radius
 * is typically unbounded (data breach, auth bypass). Architecture issues get
 * a smaller boost because their damage accrues over time rather than at deploy.
 */
const CATEGORY_IMPACT_WEIGHT: Record<string, number> = {
  security: 1.5,
  architecture: 1.2,
  performance: 1.1,
  'code-quality': 1.0,
};

/**
 * Risk engine — pure computation module for all risk quantification.
 *
 * Guarantees:
 * - calculateRiskScore is a pure function: same findings → same integer score
 * - No randomness, no floating-point drift (truncated to integer via Math.trunc)
 * - deriveRiskLevel and deriveMergeDecision are deterministic lookups
 * - Merge decision uses shared/merge-decision.ts (single source of truth)
 */
@Injectable()
export class RiskEngine {
  /**
   * Pure risk score computation.
   *
   * Formula:
   *   raw = Σ(severity_weight × confidence × impact_weight) for each finding
   *   risk_score = min(100, trunc(raw))
   *
   * Uses Math.trunc (not Math.round) to avoid rounding-induced drift at boundaries.
   * A finding with confidence=0.999 and another with confidence=1.0 should not
   * produce different integer scores when they shouldn't.
   */
  calculateRiskScore(findings: Finding[]): number {
    if (findings.length === 0) return 0;

    let rawScore = 0;
    for (const f of findings) {
      const severityW = SEVERITY_WEIGHT[f.severity] ?? 1;
      const confidence = this.clampConfidence(f.confidence ?? 0.5);
      const categoryW = CATEGORY_IMPACT_WEIGHT[f.category] ?? 1.0;
      rawScore += severityW * confidence * categoryW;
    }

    return Math.min(100, Math.trunc(rawScore));
  }

  deriveRiskLevel(riskScore: number): RiskLevel {
    if (riskScore >= 81) return 'Critical';
    if (riskScore >= 61) return 'High';
    if (riskScore >= 31) return 'Moderate';
    return 'Low';
  }

  /**
   * Uses the shared decideMerge function — single source of truth for merge rules.
   * Backend and frontend import the same logic.
   */
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

  private clampConfidence(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
