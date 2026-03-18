/**
 * Severity-only risk summary — single short sentence from counts.
 * Factual, no exaggeration; does not mention medium/low in phrasing.
 */
export interface SeverityCounts {
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
}

const SUMMARY_CRITICAL =
  'High risk – contains critical issues affecting core functionality or system behavior.';
const SUMMARY_HIGH_MULTIPLE =
  'Moderate to high risk due to multiple high-severity issues.';
const SUMMARY_HIGH_ONE = 'Moderate risk with one high-severity issue.';
const SUMMARY_LOW = 'Low to moderate risk with no high-severity issues.';

/**
 * Returns a short risk summary based only on severity counts.
 * Order: critical >= 1 wins, then high >= 2, then high === 1, else low.
 */
export function riskSummaryFromCounts(counts: SeverityCounts): string {
  if (counts.critical_count >= 1) return SUMMARY_CRITICAL;
  if (counts.high_count >= 2) return SUMMARY_HIGH_MULTIPLE;
  if (counts.high_count === 1) return SUMMARY_HIGH_ONE;
  return SUMMARY_LOW;
}
