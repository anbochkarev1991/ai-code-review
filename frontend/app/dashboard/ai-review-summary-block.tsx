"use client";

import type { AiReviewSummary } from "@/lib/types";

interface AiReviewSummaryBlockProps {
  aiReviewSummary: AiReviewSummary;
}

function parseConcern(concern: string): { severity?: string; text: string } {
  const match = concern.match(/^\[(CRITICAL|HIGH|MEDIUM|LOW)\]\s*(.*)/);
  if (match) {
    const text = (match[2] ?? "").trim();
    return { severity: match[1], text: text || concern };
  }
  return { text: concern };
}

function getSeverityAccent(severity: string): string {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return "border-l-red-500 bg-red-50/50 dark:bg-red-950/20 dark:border-l-red-400";
    case "HIGH":
      return "border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20 dark:border-l-orange-400";
    case "MEDIUM":
      return "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20 dark:border-l-amber-400";
    case "LOW":
      return "border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20 dark:border-l-blue-400";
    default:
      return "border-l-zinc-300 dark:border-l-zinc-600 bg-zinc-50/50 dark:bg-zinc-800/30";
  }
}

export function AiReviewSummaryBlock({ aiReviewSummary }: AiReviewSummaryBlockProps) {
  const { overall_assessment, primary_risk, key_concerns, recommendation } = aiReviewSummary;

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
      <div className="px-4 py-4 flex flex-col gap-5">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          AI Review Summary
        </h3>

        <section className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Overall Assessment
          </span>
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {overall_assessment}
          </p>
        </section>

        {primary_risk && (
          <section className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Primary Risk
            </span>
            <div className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {primary_risk}
              </span>
            </div>
          </section>
        )}

        {key_concerns.length > 0 && (
          <section className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Key Concerns
            </span>
            <ul className="flex flex-col gap-2">
              {key_concerns.map((concern, i) => {
                const { severity, text } = parseConcern(concern);
                const accent = severity ? getSeverityAccent(severity) : "border-l-zinc-300 dark:border-l-zinc-600 bg-zinc-50/50 dark:bg-zinc-800/30";
                return (
                  <li
                    key={i}
                    className={`rounded-md border-l-4 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 ${accent}`}
                  >
                    {severity && (
                      <span className="mr-2 font-semibold text-zinc-600 dark:text-zinc-400">
                        [{severity}]
                      </span>
                    )}
                    {text}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Recommendation
          </span>
          <p className="text-sm font-medium leading-relaxed text-zinc-800 dark:text-zinc-200 rounded-md px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
            {recommendation}
          </p>
        </section>
      </div>
    </div>
  );
}
