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
      return "bg-zinc-500 text-white dark:bg-zinc-400 dark:text-zinc-900";
    default:
      return "bg-zinc-600 text-white dark:bg-zinc-500";
  }
}

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

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

function groupConcernsBySeverity(concerns: string[], maxTotal = 5) {
  const parsed = concerns.map(parseConcern);
  const bySeverity = new Map<string, string[]>();
  const seen = new Set<string>();
  let total = 0;

  for (const { severity, title } of parsed) {
    if (total >= maxTotal) break;
    const key = title.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    total++;
    const group = severity ?? "OTHER";
    const list = bySeverity.get(group) ?? [];
    list.push(title);
    bySeverity.set(group, list);
  }

  const ordered: { severity: string; items: string[] }[] = [];
  for (const s of SEVERITY_ORDER) {
    const items = bySeverity.get(s);
    if (items?.length) ordered.push({ severity: s, items });
  }
  const other = bySeverity.get("OTHER");
  if (other?.length) ordered.push({ severity: "OTHER", items: other });

  return ordered;
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
          <section className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Key Concerns
            </span>
            <div className="flex flex-col gap-4">
              {groupConcernsBySeverity(key_concerns).map((group) => (
                <div key={group.severity} className="flex flex-col gap-1.5">
                  {group.severity !== "OTHER" && (
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap shrink-0 w-fit ${getSeverityBadgeClass(group.severity)}`}
                    >
                      {group.severity.charAt(0) +
                        group.severity.slice(1).toLowerCase() +
                        " priority issues"}
                    </span>
                  )}
                  <ul className="list-disc list-inside flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                    {group.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
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
