"use client";

import { useState } from "react";
import type { TraceStep } from "@/lib/types";

interface ReviewTraceProps {
  trace: TraceStep[];
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return dateString;
  }
}

function getStatusColor(status: TraceStep["status"]): string {
  switch (status) {
    case "ok":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

export function ReviewTrace({ trace }: ReviewTraceProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!trace || trace.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Trace ({trace.length} steps)
        </h3>
        <svg
          className={`h-5 w-5 text-zinc-500 transition-transform dark:text-zinc-400 ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isExpanded && (
        <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          {trace.map((step, index) => (
            <div
              key={index}
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-zinc-900 dark:text-zinc-100">
                    {step.agent}
                  </h4>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(step.status)}`}
                  >
                    {step.status}
                  </span>
                </div>

                <div className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                  <div>
                    <span className="font-medium">Started:</span>{" "}
                    {formatDate(step.started_at)}
                  </div>
                  <div>
                    <span className="font-medium">Finished:</span>{" "}
                    {formatDate(step.finished_at)}
                  </div>
                  {step.tokens_used !== undefined && (
                    <div>
                      <span className="font-medium">Tokens used:</span>{" "}
                      {step.tokens_used.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
