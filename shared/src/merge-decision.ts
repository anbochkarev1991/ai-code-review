/**
 * Merge decision rules — single source of truth.
 *
 * Both backend (risk engine) and frontend (UI display) import from here.
 * Rules are strict, deterministic, and documented for audit purposes.
 */
import type { MergeRecommendation, MergeExplanation } from './review';

export interface MergeDecisionInput {
  critical_count: number;
  high_count: number;
  risk_score: number;
}

export interface MergeDecision {
  recommendation: MergeRecommendation;
  explanation: MergeExplanation;
}

/**
 * Deterministic merge decision function.
 *
 * Priority order (first match wins):
 *   1. Any critical finding → Block merge
 *   2. 3+ high findings → Merge with caution
 *   3. risk_score >= 60 → Merge with caution
 *   4. Otherwise → Safe to merge
 *
 * Risk score must not contradict recommendation:
 * - "Block merge" only when criticals exist (regardless of score)
 * - "Merge with caution" when high count or score warrants it
 * - "Safe to merge" only when neither condition is met
 */
export function decideMerge(input: MergeDecisionInput): MergeDecision {
  const { critical_count, high_count, risk_score } = input;

  if (critical_count > 0) {
    return {
      recommendation: 'Block merge',
      explanation: `Blocked because ${critical_count} critical issue${critical_count === 1 ? '' : 's'} detected.`,
    };
  }

  if (high_count >= 3) {
    return {
      recommendation: 'Merge with caution',
      explanation: `Merge with caution due to ${high_count} high severity findings.`,
    };
  }

  if (risk_score >= 60) {
    return {
      recommendation: 'Merge with caution',
      explanation: `Merge with caution — risk score ${risk_score}/100 exceeds safety threshold.`,
    };
  }

  return {
    recommendation: 'Safe to merge',
    explanation: 'Low risk — safe to merge.',
  };
}
