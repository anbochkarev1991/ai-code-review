"use client";

import type {
  ExecutionMetadata,
  Finding,
  PRMetadata,
  ReviewSummary as ReviewSummaryType,
  RiskLevel,
  MergeRecommendation,
} from "@/lib/types";

interface ReviewSummaryProps {
  summary: string;
  findings?: Finding[];
  executionMetadata?: ExecutionMetadata;
  reviewSummary?: ReviewSummaryType;
  prMetadata?: PRMetadata;
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = Math.round(ms / 1000);
  return `${seconds}s`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
}

function FindingsStats({ findings }: { findings: Finding[] }) {
  const counts = {
    critical: findings.filter((f) => f.severity === "critical").length,
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
  };

  const total = findings.length;

  if (total === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      {counts.critical > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-600 dark:bg-red-500" />
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {counts.critical}
          </span>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">Critical</span>
        </div>
      )}
      {counts.high > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-orange-600 dark:bg-orange-500" />
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {counts.high}
          </span>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">High</span>
        </div>
      )}
      {counts.medium > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-yellow-500 dark:bg-yellow-400" />
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {counts.medium}
          </span>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">Medium</span>
        </div>
      )}
      {counts.low > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-500" />
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {counts.low}
          </span>
          <span className="text-xs text-zinc-600 dark:text-zinc-400">Low</span>
        </div>
      )}
    </div>
  );
}

function getRiskLevelColor(level: RiskLevel): string {
  switch (level) {
    case "Critical":
      return "text-red-600 dark:text-red-400";
    case "High":
      return "text-orange-600 dark:text-orange-400";
    case "Moderate":
      return "text-yellow-600 dark:text-yellow-400";
    case "Low":
      return "text-green-600 dark:text-green-400";
    default:
      return "text-zinc-600 dark:text-zinc-400";
  }
}

function getRiskScoreColor(score: number): string {
  if (score >= 81) return "text-red-600 dark:text-red-400";
  if (score >= 61) return "text-orange-600 dark:text-orange-400";
  if (score >= 31) return "text-yellow-600 dark:text-yellow-400";
  return "text-green-600 dark:text-green-400";
}

function getMergeRecommendationStyle(rec: MergeRecommendation): {
  bg: string;
  text: string;
  icon: string;
} {
  switch (rec) {
    case "Block merge":
      return {
        bg: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-800 dark:text-red-300",
        icon: "M6 18L18 6M6 6l12 12",
      };
    case "Merge with caution":
      return {
        bg: "bg-yellow-100 dark:bg-yellow-900/30",
        text: "text-yellow-800 dark:text-yellow-300",
        icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z",
      };
    case "Safe to merge":
      return {
        bg: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-800 dark:text-green-300",
        icon: "M5 13l4 4L19 7",
      };
    default:
      return {
        bg: "bg-zinc-100 dark:bg-zinc-800",
        text: "text-zinc-800 dark:text-zinc-300",
        icon: "M5 13l4 4L19 7",
      };
  }
}

function PRMetadataBar({ prMetadata }: { prMetadata: PRMetadata }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            PR: #{prMetadata.pr_number} — {prMetadata.pr_title}
          </span>
          {prMetadata.pr_author && (
            <>
              <span>·</span>
              <span>Author: @{prMetadata.pr_author}</span>
            </>
          )}
          {prMetadata.commit_count !== undefined && (
            <>
              <span>·</span>
              <span>
                {prMetadata.commit_count} commit{prMetadata.commit_count !== 1 ? "s" : ""}
              </span>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          <span>
            Analyzed: {prMetadata.total_files_changed} changed file{prMetadata.total_files_changed !== 1 ? "s" : ""}
          </span>
          <span>·</span>
          <span className="font-mono">
            <span className="text-green-600 dark:text-green-400">+{prMetadata.total_additions}</span>
            {" "}
            <span className="text-red-600 dark:text-red-400">−{prMetadata.total_deletions}</span>
            {" "}lines
          </span>
          <span>·</span>
          <span className="italic">Analysis scope: Diff-only (unchanged files ignored)</span>
        </div>
      </div>
    </div>
  );
}

export function ReviewSummary({
  summary,
  findings,
  executionMetadata,
  reviewSummary,
  prMetadata,
}: ReviewSummaryProps) {
  const displayText = reviewSummary?.text ?? summary;
  const hasSummary = displayText && displayText.trim() !== "";
  const mergeRec = reviewSummary?.merge_recommendation;
  const mergeStyle = mergeRec ? getMergeRecommendationStyle(mergeRec) : null;

  return (
    <div className="flex w-full flex-col gap-4">
      {/* PR Metadata Bar */}
      {prMetadata && <PRMetadataBar prMetadata={prMetadata} />}

      {/* Stats Panel */}
      {findings && findings.length > 0 && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Overview
              </h3>
              {reviewSummary && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-sm font-bold ${getRiskScoreColor(reviewSummary.risk_score)}`}
                    >
                      {reviewSummary.risk_score}/100
                    </span>
                    {reviewSummary.risk_level && (
                      <span
                        className={`text-xs font-medium ${getRiskLevelColor(reviewSummary.risk_level)}`}
                      >
                        {reviewSummary.risk_level}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
            <FindingsStats findings={findings} />

            {/* Merge Recommendation */}
            {mergeRec && mergeStyle && (
              <div className={`mt-3 flex items-center gap-2 rounded-md px-3 py-2 ${mergeStyle.bg}`}>
                <svg
                  className={`h-4 w-4 shrink-0 ${mergeStyle.text}`}
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
                <span className={`text-sm font-semibold ${mergeStyle.text}`}>
                  {mergeRec}
                </span>
                {reviewSummary?.primary_risk_category && (
                  <span className={`text-xs ${mergeStyle.text} opacity-75`}>
                    — Primary risk: {reviewSummary.primary_risk_category}
                  </span>
                )}
              </div>
            )}
          </div>
          {hasSummary && (
            <div className="px-4 py-3">
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap wrap-break-word">
                {displayText}
              </p>
            </div>
          )}
          {executionMetadata && (
            <div className="px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                <span className="font-medium">
                  Generated by {executionMetadata.agent_count} AI agent
                  {executionMetadata.agent_count !== 1 ? "s" : ""}
                </span>
                <span>·</span>
                <span>{formatDuration(executionMetadata.duration_ms)}</span>
                {executionMetadata.total_tokens > 0 && (
                  <>
                    <span>·</span>
                    <span>{formatTokens(executionMetadata.total_tokens)} tokens</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary only (if no findings) */}
      {hasSummary && (!findings || findings.length === 0) && (
        <div className="flex w-full flex-col gap-3">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Summary
          </h3>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
            <div className="p-4">
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap wrap-break-word">
                {displayText}
              </p>
              {mergeRec && mergeStyle && (
                <div className={`mt-3 flex items-center gap-2 rounded-md px-3 py-2 ${mergeStyle.bg}`}>
                  <svg
                    className={`h-4 w-4 shrink-0 ${mergeStyle.text}`}
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
                  <span className={`text-sm font-semibold ${mergeStyle.text}`}>
                    {mergeRec}
                  </span>
                </div>
              )}
            </div>
            {executionMetadata && (
              <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium">
                    Generated by {executionMetadata.agent_count} AI agent
                    {executionMetadata.agent_count !== 1 ? "s" : ""}
                  </span>
                  <span>·</span>
                  <span>{formatDuration(executionMetadata.duration_ms)}</span>
                  {executionMetadata.total_tokens > 0 && (
                    <>
                      <span>·</span>
                      <span>{formatTokens(executionMetadata.total_tokens)} tokens</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
