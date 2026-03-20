"use client";

import type {
  Finding,
  ReviewSummary as ReviewSummaryType,
} from "@/lib/types";
import {
  FindingsStats,
  getMergeRecommendationStyle,
  getRiskLevelColor,
  getRiskScoreColor,
} from "@/app/dashboard/review-summary-shared";

interface ReviewSummarySidebarProps {
  summary: string;
  findings?: Finding[];
  reviewSummary?: ReviewSummaryType;
}

export function ReviewSummarySidebar({
  summary,
  findings = [],
  reviewSummary,
}: ReviewSummarySidebarProps) {
  const displayText = reviewSummary?.text ?? summary;
  const hasSummary = displayText.trim() !== "";
  const mergeRec = reviewSummary?.merge_recommendation;
  const mergeStyle = mergeRec ? getMergeRecommendationStyle(mergeRec) : null;

  const riskSummary = reviewSummary?.risk_summary?.trim();
  const shortRecommendation = riskSummary
    ? riskSummary
    : hasSummary
      ? displayText
      : null;
  const clampBody = !riskSummary && hasSummary;

  return (
    <aside className="order-1 w-full md:order-2 md:w-[300px] md:shrink-0">
      <div className="md:sticky md:top-6">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Summary
          </h3>

          {mergeRec && mergeStyle && (
            <div className={`mt-4 flex flex-col gap-1 rounded-lg px-3 py-2.5 ${mergeStyle.bg}`}>
              <div className="flex items-start gap-2">
                <svg
                  className={`h-4 w-4 shrink-0 mt-0.5 ${mergeStyle.text}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={mergeStyle.icon}
                  />
                </svg>
                <div className="min-w-0 flex-1">
                  <span className={`text-sm font-semibold ${mergeStyle.text}`}>
                    {mergeRec}
                  </span>
                  {reviewSummary?.primary_risk_category && (
                    <p className={`mt-1 text-xs ${mergeStyle.text} opacity-80`}>
                      Primary risk: {reviewSummary.primary_risk_category}
                    </p>
                  )}
                  {reviewSummary?.merge_explanation && (
                    <p className={`mt-1 text-xs ${mergeStyle.text} opacity-85`}>
                      {reviewSummary.merge_explanation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {reviewSummary && (
            <div className="mt-4 flex flex-wrap items-baseline gap-2">
              <span
                className={`text-2xl font-bold tabular-nums ${getRiskScoreColor(reviewSummary.risk_score)}`}
              >
                {reviewSummary.risk_score}/100
              </span>
              {reviewSummary.risk_level && (
                <span
                  className={`text-sm font-medium ${getRiskLevelColor(reviewSummary.risk_level)}`}
                >
                  {reviewSummary.risk_level}
                </span>
              )}
            </div>
          )}

          {findings.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Findings by severity
              </p>
              <FindingsStats
                findings={findings}
                multiAgentCount={reviewSummary?.multi_agent_confirmed_count}
              />
            </div>
          )}

          {shortRecommendation && (
            <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Recommendation
              </p>
              <p
                className={`text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 ${clampBody ? "line-clamp-4" : ""}`}
              >
                {shortRecommendation}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
