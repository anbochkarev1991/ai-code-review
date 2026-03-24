"use client";

import type {
  Finding,
  ReviewSummary as ReviewSummaryType,
} from "@/lib/types";
import { MergeDecisionBanner } from "@/app/dashboard/merge-decision-banner";
import { RiskScoreGauge } from "@/app/dashboard/risk-score-gauge";
import { FindingsStats } from "@/app/dashboard/review-summary-shared";

const CATEGORY_LABELS: Record<string, string> = {
  security: "Security",
  "code-quality": "Code quality",
  performance: "Performance",
  architecture: "Architecture",
};

function CategoryImpact({
  contribution,
}: {
  contribution: Record<string, number> | undefined;
}) {
  if (!contribution || Object.keys(contribution).length === 0) return null;

  const entries = Object.entries(contribution)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (entries.length === 0) return null;

  return (
    <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Risk by area (weighted)
      </p>
      <ul className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
        {entries.map(([key, val]) => (
          <li key={key} className="flex justify-between gap-2">
            <span>{CATEGORY_LABELS[key] ?? key}</span>
            <span className="font-mono tabular-nums">{Math.round(val)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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

  return (
    <aside className="flex min-h-0 min-w-0 flex-col md:h-full md:min-h-0 md:flex-1">
      <div className="md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            General findings
          </h3>

          {mergeRec && (
            <MergeDecisionBanner
              recommendation={mergeRec}
              verdict={reviewSummary?.decision_verdict}
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

          {reviewSummary?.risk_breakdown?.category_contribution && (
            <CategoryImpact
              contribution={reviewSummary.risk_breakdown.category_contribution}
            />
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

          {hasSummary && (
            <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Summary
              </p>
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 line-clamp-6">
                {displayText}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
