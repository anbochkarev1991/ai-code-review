import { Injectable } from '@nestjs/common';
import type {
  Finding,
  ReviewDecisionVerdict,
  RiskLevel,
  RiskBreakdown,
} from 'shared';
import {
  calculateRiskBreakdown as sharedCalculateRiskBreakdown,
  decideMerge,
  deriveRiskLevelFromVerdict,
  type MergeDecision,
} from 'shared';

/**
 * Thin Nest wrapper around shared risk + merge helpers (single algorithm in `shared`).
 */
@Injectable()
export class RiskEngine {
  calculateRiskScore(findings: Finding[]): number {
    return this.calculateRiskBreakdown(findings).final_score;
  }

  calculateRiskBreakdown(findings: Finding[]): RiskBreakdown {
    return sharedCalculateRiskBreakdown(findings);
  }

  deriveRiskLevel(
    verdict: ReviewDecisionVerdict,
    hasCriticalFinding: boolean,
  ): RiskLevel {
    return deriveRiskLevelFromVerdict(verdict, hasCriticalFinding);
  }

  deriveMergeDecision(
    riskScore: number,
    criticalCount: number,
    highCount: number,
    mediumCount = 0,
    lowCount = 0,
  ): MergeDecision {
    return decideMerge({
      critical_count: criticalCount,
      high_count: highCount,
      medium_count: mediumCount,
      low_count: lowCount,
      risk_score: riskScore,
    });
  }
}
