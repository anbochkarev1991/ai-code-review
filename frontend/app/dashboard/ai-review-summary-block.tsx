"use client";

import type { AiReviewSummary } from "@/lib/types";

interface AiReviewSummaryBlockProps {
  aiReviewSummary: AiReviewSummary;
}

/** Matches severity badge style used in findings cards (review-findings-list). */
function getSeverityBadgeClass(severityLabel: string): string {
  switch (severityLabel.toUpperCase()) {
    case "CRITICAL":
      return "bg-red-600 text-white dark:bg-red-500";
    case "HIGH":
      return "bg-orange-600 text-white dark:bg-orange-500";
    case "MEDIUM":
      return "bg-yellow-500 text-white dark:bg-yellow-400";
    case "LOW":
      return "bg-blue-600 text-white dark:bg-blue-500";
    default:
      return "bg-zinc-600 text-white dark:bg-zinc-500";
  }
}

function parseConcern(concern: string): {
  severity?: string;
  title: string;
  explanation?: string;
} {
  const match = concern.match(/^\[(CRITICAL|HIGH|MEDIUM|LOW)\]\s*([\s\S]*)/);
  if (match) {
    const rest = (match[2] ?? "").trim();
    const newlineIdx = rest.indexOf("\n");
    if (newlineIdx >= 0) {
      const title = rest.slice(0, newlineIdx).trim();
      const explanation = rest.slice(newlineIdx + 1).trim();
      return { severity: match[1], title: title || rest, explanation: explanation || undefined };
    }
    return { severity: match[1], title: rest || concern };
  }
  return { title: concern.trim() };
}

export function AiReviewSummaryBlock({ aiReviewSummary }: AiReviewSummaryBlockProps) {
  const { overall_assessment, primary_risk, key_concerns, recommendation } = aiReviewSummary;

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
      <div className="px-4 py-5 flex flex-col gap-6">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          AI Review Summary
        </h3>

        <section className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Overall Assessment
          </span>
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {overall_assessment}
          </p>
        </section>

        {primary_risk && (
          <section className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Primary Risk
            </span>
            <span className="inline-flex items-center self-start rounded px-2.5 py-1 text-xs font-semibold whitespace-nowrap bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
              {primary_risk}
            </span>
          </section>
        )}

        {key_concerns.length > 0 && (
          <section className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Key Concerns
            </span>
            <ul className="flex flex-col gap-3">
              {key_concerns.map((concern, i) => {
                const { severity, title, explanation } = parseConcern(concern);
                return (
                  <li
                    key={i}
                    className="flex flex-col gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30 px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {severity && (
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap shrink-0 ${getSeverityBadgeClass(severity)}`}
                        >
                          {severity}
                        </span>
                      )}
                      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {title}
                      </span>
                    </div>
                    {explanation && (
                      <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 pl-0">
                        {explanation}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Recommendation
          </span>
          <p className="text-sm font-medium leading-relaxed text-zinc-800 dark:text-zinc-200 rounded-md px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
            {recommendation}
          </p>
        </section>
      </div>
    </div>
  );
}
