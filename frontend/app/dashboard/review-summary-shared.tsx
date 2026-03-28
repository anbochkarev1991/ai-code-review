"use client";

import type {
  Finding,
  FindingSeverity,
  MergeRecommendation,
  ReviewDecisionVerdict,
  RiskLevel,
} from "@/lib/types";

const MAX_DECISION_BULLETS = 3;

/** Labels aligned with sidebar `CategoryImpact` for readable breakdown lines. */
const CATEGORY_DISPLAY: Record<string, string> = {
  security: "security",
  "code-quality": "code quality",
  performance: "performance",
  architecture: "architecture",
};

function formatCategoryPhrase(raw: string): string {
  const key = raw.toLowerCase();
  if (CATEGORY_DISPLAY[key]) return CATEGORY_DISPLAY[key];
  return raw.replace(/-/g, " ").toLowerCase();
}

function issueWord(n: number): string {
  return n === 1 ? "issue" : "issues";
}

/** Count findings at given severities where consensus is multi-agent. */
function multiAgentCountForSeverities(
  findings: Finding[],
  severities: Set<FindingSeverity>,
): number {
  let n = 0;
  for (const f of findings) {
    if (severities.has(f.severity) && f.consensus_level === "multi-agent") {
      n++;
    }
  }
  return n;
}

function appendMultiAgentSuffix(
  blockingCount: number,
  multiInBlocking: number,
): string {
  if (multiInBlocking <= 0) return "";
  if (blockingCount === 1 && multiInBlocking === 1) {
    return " (multi-agent confirmed)";
  }
  return ` (${multiInBlocking} multi-agent confirmed)`;
}

export interface DecisionBreakdownInput {
  verdict: ReviewDecisionVerdict | undefined;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  risk_score: number;
  primary_risk_category?: string;
  findings: Finding[];
}

/**
 * Deterministic 2–3 bullets for merge banner. Uses same counts as merge decision; no LLM text.
 */
export function buildDecisionBreakdown(input: DecisionBreakdownInput): string[] {
  const {
    verdict,
    critical_count,
    high_count,
    medium_count,
    low_count,
    risk_score,
    primary_risk_category,
    findings,
  } = input;

  if (verdict === "safe" || verdict === undefined) {
    return [];
  }

  const items: string[] = [];
  const blockedBySeverity = critical_count > 0 || high_count > 0;

  if (verdict === "blocked" && blockedBySeverity) {
    if (critical_count > 0) {
      const multi = multiAgentCountForSeverities(findings, new Set(["critical"]));
      items.push(
        `${critical_count} critical severity ${issueWord(critical_count)}${appendMultiAgentSuffix(
          critical_count,
          multi,
        )}`,
      );
    } else if (high_count > 0) {
      const multi = multiAgentCountForSeverities(findings, new Set(["high"]));
      items.push(
        `${high_count} high severity ${issueWord(high_count)}${appendMultiAgentSuffix(
          high_count,
          multi,
        )}`,
      );
    }

    if (primary_risk_category && items.length < MAX_DECISION_BULLETS) {
      items.push(`affects ${formatCategoryPhrase(primary_risk_category)} logic`);
    }

    if (items.length < MAX_DECISION_BULLETS) {
      const extraParts: string[] = [];
      if (medium_count > 0) {
        extraParts.push(
          `${medium_count} medium severity ${issueWord(medium_count)}`,
        );
      }
      if (low_count > 0) {
        extraParts.push(`${low_count} low severity ${issueWord(low_count)}`);
      }
      if (extraParts.length === 1) {
        items.push(`additional ${extraParts[0]}`);
      } else if (extraParts.length === 2) {
        items.push(`additional ${extraParts[0]} and ${extraParts[1]}`);
      }
    }

    return items.slice(0, MAX_DECISION_BULLETS);
  }

  if (verdict === "warning") {
    const riskScorePrimary =
      critical_count === 0 &&
      high_count === 0 &&
      risk_score >= 60;

    if (riskScorePrimary) {
      items.push(`risk score ${risk_score}/100 at or above threshold (60)`);
    } else if (medium_count > 0) {
      const multi = multiAgentCountForSeverities(findings, new Set(["medium"]));
      items.push(
        `${medium_count} medium severity ${issueWord(medium_count)}${appendMultiAgentSuffix(
          medium_count,
          multi,
        )}`,
      );
    }

    if (items.length < MAX_DECISION_BULLETS && primary_risk_category) {
      items.push(`affects ${formatCategoryPhrase(primary_risk_category)} logic`);
    }

    if (items.length < MAX_DECISION_BULLETS && riskScorePrimary && medium_count > 0) {
      items.push(
        `additional ${medium_count} medium severity ${issueWord(medium_count)}`,
      );
    }

    if (items.length < MAX_DECISION_BULLETS && !riskScorePrimary && low_count > 0) {
      items.push(`additional ${low_count} low severity ${issueWord(low_count)}`);
    }

    if (
      items.length < MAX_DECISION_BULLETS &&
      riskScorePrimary &&
      medium_count === 0 &&
      low_count > 0
    ) {
      items.push(`additional ${low_count} low severity ${issueWord(low_count)}`);
    }

    return items.slice(0, MAX_DECISION_BULLETS);
  }

  return [];
}

export interface SeverityCountSnapshot {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

/** Renders server-derived severity counts (same source as merge decision). */
export function FindingsStats({
  counts,
  multiAgentCount,
}: {
  counts: SeverityCountSnapshot;
  multiAgentCount?: number;
}) {
  const total =
    counts.critical + counts.high + counts.medium + counts.low;

  if (total === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {counts.critical > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-600 dark:bg-red-500" />
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {counts.critical}
          </span>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">Critical</span>
        </div>
      )}
      {counts.high > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-orange-600 dark:bg-orange-500" />
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {counts.high}
          </span>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">High</span>
        </div>
      )}
      {counts.medium > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-yellow-500 dark:bg-yellow-400" />
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {counts.medium}
          </span>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">Medium</span>
        </div>
      )}
      {counts.low > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-zinc-500 dark:bg-zinc-400" />
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {counts.low}
          </span>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">Low</span>
        </div>
      )}
      {multiAgentCount !== undefined && multiAgentCount > 0 && (
        <div className="flex w-full flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {multiAgentCount}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400">Multi-agent overlap</span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 pl-4">
            {multiAgentCount} finding{multiAgentCount === 1 ? "" : "s"} confirmed by multiple agents — different review
            perspectives reached the same conclusion independently.
          </p>
        </div>
      )}
    </div>
  );
}

export function getRiskLevelColor(level: RiskLevel): string {
  switch (level) {
    case "Critical":
      return "text-red-600 dark:text-red-400";
    case "High":
      return "text-orange-600 dark:text-orange-400";
    case "Moderate":
      return "text-yellow-600 dark:text-yellow-400";
    case "Low risk":
      return "text-green-600 dark:text-green-400";
    default:
      return "text-zinc-600 dark:text-zinc-400";
  }
}

export function getRiskScoreColor(score: number): string {
  if (score >= 81) return "text-red-600 dark:text-red-400";
  if (score >= 61) return "text-orange-600 dark:text-orange-400";
  if (score >= 31) return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

/** Visual gauge theme: 0–30 green, 31–70 yellow, 71–100 red (distinct from getRiskScoreColor thresholds). */
export interface RiskScoreTheme {
  stroke: string;
  track: string;
  text: string;
  label: string;
}

export function getRiskScoreTheme(score: number): RiskScoreTheme {
  const clamped = Math.max(0, Math.min(100, score));
  if (clamped <= 30) {
    return {
      stroke: "stroke-green-600 dark:stroke-green-400",
      track: "stroke-zinc-200 dark:stroke-zinc-700",
      text: "text-green-700 dark:text-green-300",
      label: "text-green-700 dark:text-green-400",
    };
  }
  if (clamped <= 70) {
    return {
      stroke: "stroke-amber-500 dark:stroke-amber-400",
      track: "stroke-zinc-200 dark:stroke-zinc-700",
      text: "text-amber-800 dark:text-amber-200",
      label: "text-amber-800 dark:text-amber-300",
    };
  }
  return {
    stroke: "stroke-red-600 dark:stroke-red-500",
    track: "stroke-zinc-200 dark:stroke-zinc-700",
    text: "text-red-700 dark:text-red-300",
    label: "text-red-700 dark:text-red-400",
  };
}

export function getMergeRecommendationStyle(rec: MergeRecommendation): {
  bg: string;
  text: string;
  icon: string;
} {
  switch (rec) {
    case "Merge blocked":
      return {
        bg: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-800 dark:text-red-300",
        icon: "M6 18L18 6M6 6l12 12",
      };
    case "Merge with caution":
      return {
        bg: "bg-amber-100 dark:bg-amber-900/30",
        text: "text-amber-900 dark:text-amber-200",
        icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z",
      };
    case "Safe to merge":
      return {
        bg: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-800 dark:text-green-300",
        icon: "M5 13l4 4L19 7",
      };
    default:
      return {
        bg: "bg-zinc-100 dark:bg-zinc-800",
        text: "text-zinc-800 dark:text-zinc-300",
        icon: "M5 13l4 4L19 7",
      };
  }
}
