"use client";

import type { Finding } from "@/lib/types";

interface ReviewFindingsListProps {
  findings: Finding[];
}

function getSeverityColor(severity: Finding["severity"]): string {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "high":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    case "medium":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "low":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    default:
      return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

export function ReviewFindingsList({ findings }: ReviewFindingsListProps) {
  if (findings.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
        No findings reported.
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Findings ({findings.length})
      </h3>
      <div className="flex flex-col gap-3">
        {findings.map((finding) => (
          <div
            key={finding.id}
            className="rounded-lg border border-zinc-200 bg-white p-3 sm:p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <h4 className="flex-1 font-medium text-sm sm:text-base text-zinc-900 dark:text-zinc-100 break-words">
                  {finding.title}
                </h4>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap flex-shrink-0 ${getSeverityColor(finding.severity)}`}
                >
                  {finding.severity}
                </span>
              </div>

              {finding.category && (
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Category: {finding.category}
                </div>
              )}

              {(finding.file || finding.line !== undefined) && (
                <div className="text-xs text-zinc-500 dark:text-zinc-400 break-all">
                  {finding.file && (
                    <span className="font-mono break-all">{finding.file}</span>
                  )}
                  {finding.file && finding.line !== undefined && (
                    <span className="mx-1">:</span>
                  )}
                  {finding.line !== undefined && (
                    <span>Line {finding.line}</span>
                  )}
                </div>
              )}

              <div className="mt-1 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 break-words">
                {finding.message}
              </div>

              {finding.suggestion && (
                <div className="mt-2 rounded-md border-l-4 border-blue-500 bg-blue-50 p-2 sm:p-3 text-xs sm:text-sm text-blue-900 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-200">
                  <div className="font-medium">Suggestion:</div>
                  <div className="mt-1 break-words">{finding.suggestion}</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
