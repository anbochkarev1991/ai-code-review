/**
 * Risk one-liner — aligned with merge decision (same source: decideMerge).
 */
import { decideMerge } from './merge-decision';

export interface SeverityCounts {
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  risk_score: number;
}

/**
 * Short line for summaries; matches merge_explanation from decideMerge for the same inputs.
 */
export function riskSummaryFromCounts(counts: SeverityCounts): string {
  return decideMerge({
    critical_count: counts.critical_count,
    high_count: counts.high_count,
    medium_count: counts.medium_count,
    low_count: counts.low_count,
    risk_score: counts.risk_score,
  }).explanation;
}
