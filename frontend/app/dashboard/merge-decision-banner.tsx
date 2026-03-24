"use client";

import type { MergeRecommendation } from "@/lib/types";
import { getMergeRecommendationStyle } from "@/app/dashboard/review-summary-shared";

export interface MergeDecisionBannerProps {
  recommendation: MergeRecommendation;
  explanation?: string;
  primaryRiskCategory?: string;
  className?: string;
}

export function MergeDecisionBanner({
  recommendation,
  explanation,
  primaryRiskCategory,
  className,
}: MergeDecisionBannerProps) {
  if (!recommendation) {
    return null;
  }

  const style = getMergeRecommendationStyle(recommendation);

  return (
    <div
      className={`flex flex-col gap-1 rounded-lg px-3 py-2.5 ${style.bg} ${className ?? ""}`}
    >
      <div className="flex items-start gap-2">
        <svg
          className={`h-4 w-4 shrink-0 mt-0.5 ${style.text}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={style.icon}
          />
        </svg>
        <div className="min-w-0 flex-1">
          <span className={`text-sm font-semibold ${style.text}`}>
            {recommendation}
          </span>
          {primaryRiskCategory && (
            <p className={`mt-1 text-xs ${style.text} opacity-80`}>
              Primary risk: {primaryRiskCategory}
            </p>
          )}
          {explanation && (
            <p className={`mt-1 text-xs ${style.text} opacity-85`}>
              {explanation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
