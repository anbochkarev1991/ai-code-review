"use client";

import type { AiReviewSummary } from "@/lib/types";

interface AiReviewSummaryBlockProps {
  aiReviewSummary: AiReviewSummary;
}

export function AiReviewSummaryBlock({ aiReviewSummary }: AiReviewSummaryBlockProps) {
  const { overall_assessment, primary_risk, key_concerns, recommendation } = aiReviewSummary;

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
      <div className="px-4 py-3 flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          AI Review Summary
        </h3>
        <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          {overall_assessment}
        </p>
        {primary_risk && (
          <div>
            <span className="inline-flex rounded px-2 py-0.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
              Primary risk: {primary_risk}
            </span>
          </div>
        )}
        {key_concerns.length > 0 && (
          <div>
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Key concerns:
            </span>
            <ul className="mt-1 list-disc list-inside text-sm text-zinc-700 dark:text-zinc-300 space-y-0.5">
              {key_concerns.map((concern, i) => (
                <li key={i}>{concern}</li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Recommendation:
          </span>
          <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">
            {recommendation}
          </p>
        </div>
      </div>
    </div>
  );
}
