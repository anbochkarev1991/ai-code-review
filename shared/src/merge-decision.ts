/**
 * Merge decision rules — single source of truth.
 *
 * Both backend (risk engine) and frontend (UI display) import from here.
 * Rules are strict, deterministic, and documented for audit purposes.
 */
import type {
  MergeRecommendation,
  MergeExplanation,
  ReviewDecisionVerdict,
} from './review';

export interface MergeDecisionInput {
  critical_count: number;
  high_count: number;
  /** Defaults to 0 when omitted (backward compat). */
  medium_count?: number;
  low_count?: number;
  risk_score: number;
}

export interface MergeDecision {
  recommendation: MergeRecommendation;
  explanation: MergeExplanation;
  verdict: ReviewDecisionVerdict;
}

/**
 * Deterministic merge decision function.
 *
 * Priority (first match wins):
 *   1. Any critical finding → blocked
 *   2. Any high finding → cannot be "safe"; merge with caution
 *   3. risk_score >= 60 → merge with caution
 *   4. Any medium finding (no high/critical above) → safe with warnings
 *   5. Otherwise → safe to merge
 *
 * risk_summary and merge_explanation should both use this same explanation.
 */
export function decideMerge(input: MergeDecisionInput): MergeDecision {
  const critical_count = input.critical_count;
  const high_count = input.high_count;
  const medium_count = input.medium_count ?? 0;
  const risk_score = input.risk_score;

  if (critical_count > 0) {
    return {
      verdict: 'blocked',
      recommendation: 'Merge blocked',
      explanation: `Blocked due to ${critical_count} critical severity issue${critical_count === 1 ? '' : 's'}.`,
    };
  }

  if (high_count > 0) {
    return {
      verdict: 'warning',
      recommendation: 'Merge with caution',
      explanation: `Merge with caution: ${high_count} high severity issue${high_count === 1 ? '' : 's'} — not safe to merge without review.`,
    };
  }

  if (risk_score >= 60) {
    return {
      verdict: 'warning',
      recommendation: 'Merge with caution',
      explanation: `Merge with caution — risk score ${risk_score}/100 is at or above the threshold (60).`,
    };
  }

  if (medium_count > 0) {
    return {
      verdict: 'warning',
      recommendation: 'Safe to merge with warnings',
      explanation: `Safe to merge with warnings: ${medium_count} medium severity issue${medium_count === 1 ? '' : 's'}.`,
    };
  }

  return {
    verdict: 'safe',
    recommendation: 'Safe to merge',
    explanation: 'No significant issues; safe to merge.',
  };
}
