"use client";

import type {
  Finding,
  ReviewSummary as ReviewSummaryType,
} from "@/lib/types";
import { MergeDecisionBanner } from "@/app/dashboard/merge-decision-banner";
import { RiskScoreGauge } from "@/app/dashboard/risk-score-gauge";
import { FindingsStats } from "@/app/dashboard/review-summary-shared";

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

  const riskSummary = reviewSummary?.risk_summary?.trim();
  const shortRecommendation = riskSummary
    ? riskSummary
    : hasSummary
      ? displayText
      : null;
  const clampBody = !riskSummary && hasSummary;

  return (
    <aside className="flex min-h-0 min-w-0 flex-col rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 md:h-full">
      <div className="p-5 md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto">
        <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          General findings
        </h3>

        {mergeRec && (
          <MergeDecisionBanner
            recommendation={mergeRec}
            explanation={reviewSummary?.merge_explanation}
            primaryRiskCategory={reviewSummary?.primary_risk_category}
            className="mt-4"
          />
        )}

        {reviewSummary && (
          <div className="mt-4 flex justify-center">
            <RiskScoreGauge
              score={reviewSummary.risk_score}
              riskLevel={reviewSummary.risk_level}
            />
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
    </aside>
  );
}
