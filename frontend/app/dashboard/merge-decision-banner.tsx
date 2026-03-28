"use client";

import type { MergeRecommendation, ReviewDecisionVerdict } from "@/lib/types";
import { getMergeRecommendationStyle } from "@/app/dashboard/review-summary-shared";

function verdictBadgeClass(v: ReviewDecisionVerdict | undefined): string {
  switch (v) {
    case "blocked":
      return "bg-red-600 text-white dark:bg-red-500";
    case "warning":
      return "bg-amber-600 text-white dark:bg-amber-500";
    case "safe":
      return "bg-emerald-600 text-white dark:bg-emerald-500";
    default:
      return "bg-zinc-600 text-white dark:bg-zinc-500";
  }
}

function verdictLabel(v: ReviewDecisionVerdict | undefined): string | null {
  switch (v) {
    case "blocked":
      return "Blocked from merge";
    case "warning":
      return "Merge with caution";
    case "safe":
      return "Safe to merge";
    default:
      return null;
  }
}

/** User-facing headline; aligns API `MergeRecommendation` with `decision_verdict` labels. */
function mergeDecisionHeadline(
  verdict: ReviewDecisionVerdict | undefined,
  recommendation: MergeRecommendation,
): string {
  const fromVerdict = verdict ? verdictLabel(verdict) : null;
  if (fromVerdict) return fromVerdict;
  switch (recommendation) {
    case "Merge blocked":
      return "Blocked from merge";
    default:
      return recommendation;
  }
}

export interface MergeDecisionBannerProps {
  recommendation: MergeRecommendation;
  verdict?: ReviewDecisionVerdict;
  explanation?: string;
  primaryRiskCategory?: string;
  /** Deterministic bullets derived from findings; max 3. */
  breakdownItems?: string[];
  className?: string;
}

export function MergeDecisionBanner({
  recommendation,
  verdict,
  explanation,
  primaryRiskCategory,
  breakdownItems,
  className,
}: MergeDecisionBannerProps) {
  if (!recommendation) {
    return null;
  }

  const style = getMergeRecommendationStyle(recommendation);
  const vLabel = verdictLabel(verdict);
  const headline = mergeDecisionHeadline(verdict, recommendation);
  const showBadge = vLabel != null && vLabel !== headline;

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border border-black/5 px-3 py-3 shadow-sm dark:border-white/10 ${style.bg} ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {showBadge && (
          <span
            className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${verdictBadgeClass(verdict)}`}
          >
            {vLabel}
          </span>
        )}
        <span className={`text-sm font-semibold ${style.text}`}>{headline}</span>
      </div>
      {primaryRiskCategory && (
        <p className={`text-xs ${style.text} opacity-80`}>Primary risk: {primaryRiskCategory}</p>
      )}
      {explanation && (
        <p className={`text-sm leading-snug ${style.text} opacity-95`}>{explanation}</p>
      )}
      {breakdownItems &&
        breakdownItems.length > 0 &&
        verdict != null &&
        verdict !== "safe" && (
          <div className="mt-2 border-t border-black/10 pt-2 dark:border-white/10">
            <p
              className={`text-[10px] font-semibold uppercase tracking-wide ${style.text} opacity-70`}
            >
              {verdict === "blocked" ? "Why blocked" : "Why cautioned"}
            </p>
            <ul
              className={`mt-1.5 list-inside list-disc space-y-1 text-xs leading-snug ${style.text} opacity-80`}
            >
              {breakdownItems.slice(0, 3).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}
    </div>
  );
}
