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
      return "Blocked";
    case "warning":
      return "Warning";
    case "safe":
      return "Safe";
    default:
      return null;
  }
}

export interface MergeDecisionBannerProps {
  recommendation: MergeRecommendation;
  verdict?: ReviewDecisionVerdict;
  explanation?: string;
  primaryRiskCategory?: string;
  className?: string;
}

export function MergeDecisionBanner({
  recommendation,
  verdict,
  explanation,
  primaryRiskCategory,
  className,
}: MergeDecisionBannerProps) {
  if (!recommendation) {
    return null;
  }

  const style = getMergeRecommendationStyle(recommendation);
  const vLabel = verdictLabel(verdict);

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border border-black/5 px-3 py-3 shadow-sm dark:border-white/10 ${style.bg} ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {vLabel && (
          <span
            className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${verdictBadgeClass(verdict)}`}
          >
            {vLabel}
          </span>
        )}
        <span className={`text-sm font-semibold ${style.text}`}>{recommendation}</span>
      </div>
      {primaryRiskCategory && (
        <p className={`text-xs ${style.text} opacity-80`}>Primary risk: {primaryRiskCategory}</p>
      )}
      {explanation && (
        <p className={`text-sm leading-snug ${style.text} opacity-95`}>{explanation}</p>
      )}
    </div>
  );
}
