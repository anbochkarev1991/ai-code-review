/**
 * Merge decision rules — single source of truth.
 *
 * Both backend (risk engine) and frontend (UI display) import from here.
 * Rules are strict, deterministic, and documented for audit purposes.
 */
import type {
  Finding,
  MergeRecommendation,
  MergeExplanation,
  ReviewDecisionVerdict,
  RiskBreakdown,
  RiskLevel,
} from './review';
import {
  calculateRiskBreakdown,
  deriveRiskLevelFromVerdict,
} from './risk-breakdown';

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

/** Unified decision + counts + risk inputs derived from findings (single entry point). */
export interface ReviewDecision {
  decision: ReviewDecisionVerdict;
  recommendation: MergeRecommendation;
  explanation: string;
  primaryRisk: string | undefined;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  riskBreakdown: RiskBreakdown;
  riskScore: number;
  riskLevel: RiskLevel;
}

const CATEGORY_SEVERITY_WEIGHT: Record<string, number> = {
  critical: 50,
  high: 15,
  medium: 5,
  low: 1,
};

function countSeverities(findings: Finding[]): ReviewDecision['severityCounts'] {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    switch (f.severity) {
      case 'critical':
        counts.critical++;
        break;
      case 'high':
        counts.high++;
        break;
      case 'medium':
        counts.medium++;
        break;
      case 'low':
        counts.low++;
        break;
      default:
        break;
    }
  }
  return counts;
}

/** Category with highest weighted severity mass (same weight model as risk breakdown). */
export function derivePrimaryRiskCategoryFromFindings(
  findings: Finding[],
): string | undefined {
  if (findings.length === 0) return undefined;

  const categoryScores: Record<string, number> = {};

  for (const f of findings) {
    const cat = f.category || 'unknown';
    const w = CATEGORY_SEVERITY_WEIGHT[f.severity] ?? 1;
    categoryScores[cat] = (categoryScores[cat] ?? 0) + w;
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

/**
 * Single source for merge verdict + explanation + severity aggregation + primary risk + risk score.
 * Prefer this over ad‑hoc counting + decideMerge at call sites.
 */
export function getReviewDecision(findings: Finding[]): ReviewDecision {
  const severityCounts = countSeverities(findings);
  const riskBreakdown = calculateRiskBreakdown(findings);
  const riskScore = riskBreakdown.final_score;

  const merge = decideMerge({
    critical_count: severityCounts.critical,
    high_count: severityCounts.high,
    medium_count: severityCounts.medium,
    low_count: severityCounts.low,
    risk_score: riskScore,
  });

  const riskLevel = deriveRiskLevelFromVerdict(
    merge.verdict,
    severityCounts.critical > 0,
  );

  return {
    decision: merge.verdict,
    recommendation: merge.recommendation,
    explanation: merge.explanation,
    primaryRisk: derivePrimaryRiskCategoryFromFindings(findings),
    severityCounts,
    riskBreakdown,
    riskScore,
    riskLevel,
  };
}

/**
 * Deterministic merge decision function.
 *
 * Priority (first match wins):
 *   1. Any critical finding → blocked
 *   2. Any high finding → blocked
 *   3. risk_score >= 60 → warning (edge-case guard)
 *   4. Any medium finding → warning
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
      verdict: 'blocked',
      recommendation: 'Merge blocked',
      explanation: `Blocked due to ${high_count} high severity issue${high_count === 1 ? '' : 's'}.`,
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
      recommendation: 'Merge with caution',
      explanation: `Merge with caution due to ${medium_count} medium severity issue${medium_count === 1 ? '' : 's'}.`,
    };
  }

  return {
    verdict: 'safe',
    recommendation: 'Safe to merge',
    explanation: 'Safe to merge — no significant issues found',
  };
}
