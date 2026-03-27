"use client";

import type {
  ExecutionMetadata,
  Finding,
  PRMetadata,
  ReviewSummary as ReviewSummaryType,
  PerformanceSummary as PerformanceSummaryType,
  ReviewSignature,
  ReviewStatus,
  ReviewMetadata,
} from "@/lib/types";
import { RiskScoreGauge } from "@/app/dashboard/risk-score-gauge";
import { FindingsStats } from "@/app/dashboard/review-summary-shared";
import { MergeDecisionBanner } from "@/app/dashboard/merge-decision-banner";

interface ReviewSummaryProps {
  summary: string;
  findings?: Finding[];
  executionMetadata?: ExecutionMetadata;
  reviewSummary?: ReviewSummaryType;
  prMetadata?: PRMetadata;
  performance?: PerformanceSummaryType;
  signature?: ReviewSignature;
  reviewStatus?: ReviewStatus;
  reviewMetadata?: ReviewMetadata;
  /** `main`: overview metrics live in `ReviewSummarySidebar`; `full`: legacy stacked overview. */
  variant?: "full" | "main";
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
            <span className="text-red-600 dark:text-red-400">-{prMetadata.total_deletions}</span>
            {" "}lines
          </span>
          <span>·</span>
          <span className="italic">Analysis scope: Diff-only (unchanged files ignored)</span>
        </div>
      </div>
    </div>
  );
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function DegradedAnalysisBanner({
  agentsStatus,
}: {
  agentsStatus: Record<string, string>;
}) {
  const degraded = Object.entries(agentsStatus).filter(
    ([, status]: [string, string]) => status !== "ok",
  );
  if (degraded.length === 0) return null;

  return (
    <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
      <svg
        className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
        />
      </svg>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
          Degraded analysis:
        </span>{" "}
        <span className="text-xs text-amber-700 dark:text-amber-400">
          {degraded.map(([name, status]: [string, string]) => `${name} (${status})`).join(", ")}
          {" "}— results may be incomplete.
        </span>
      </div>
    </div>
  );
}

function PartialReviewBanner() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
      <svg
        className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
        />
      </svg>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
          Partial review:
        </span>{" "}
        <span className="text-xs text-amber-700 dark:text-amber-400">
          Some analysis agents failed. Review may be incomplete — findings should be interpreted with caution.
        </span>
      </div>
    </div>
  );
}

function SystemicPatternsBanner({ patterns }: { patterns: string[] }) {
  if (patterns.length === 0) return null;

  return (
    <div className="mt-2 flex items-start gap-2 rounded-md border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 px-3 py-2">
      <svg
        className="h-4 w-4 shrink-0 mt-0.5 text-violet-600 dark:text-violet-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
        />
      </svg>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-violet-800 dark:text-violet-300">
          Systemic patterns detected:
        </span>
        <ul className="mt-1 list-disc list-inside">
          {patterns.map((pattern: string, i: number) => (
            <li key={i} className="text-xs text-violet-700 dark:text-violet-400">
              {pattern}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PerformanceBar({ performance }: { performance: PerformanceSummaryType }) {
  return (
    <div className="px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="font-medium">
          Review completed in {formatDuration(performance.total_duration_ms)}
        </span>
        <span>·</span>
        <span>{performance.agents_parallel} agents in parallel</span>
        <span>·</span>
        <span>Avg agent latency: {formatDuration(performance.avg_agent_latency_ms)}</span>
      </div>
    </div>
  );
}

function ExecutionBar({ executionMetadata, performance }: { executionMetadata: ExecutionMetadata; performance?: PerformanceSummaryType }) {
  return (
    <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
      {performance && <PerformanceBar performance={performance} />}
      <div className="px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
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
        {executionMetadata.cost_estimate && (
          <>
            <span>·</span>
            <span>
              Est. cost: {formatCost(executionMetadata.cost_estimate.total_usd)}
              {" "}({executionMetadata.cost_estimate.model})
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function hasDegradedAgents(agentsStatus: Record<string, string>): boolean {
  return Object.values(agentsStatus).some((s) => s !== "ok");
}

export function ReviewSummary({
  summary,
  findings,
  executionMetadata,
  reviewSummary,
  prMetadata,
  performance,
  signature,
  reviewStatus,
  reviewMetadata,
  variant = "main",
}: ReviewSummaryProps) {
  const displayText = reviewSummary?.text ?? summary;
  const hasSummary = displayText && displayText.trim() !== "";
  const mergeRec = reviewSummary?.merge_recommendation;
  const isPartial = reviewStatus === "partial" || reviewMetadata?.review_status === "partial";

  const systemicPatterns = reviewSummary?.systemic_patterns ?? [];
  const showSystemic = systemicPatterns.length > 0;
  const showDegraded =
    executionMetadata?.agents_status &&
    hasDegradedAgents(executionMetadata.agents_status);
  const showMainVariantHeader =
    variant === "main" && (showSystemic || showDegraded);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      {isPartial && <PartialReviewBanner />}

      {prMetadata && <PRMetadataBar prMetadata={prMetadata} />}

      {findings && findings.length > 0 && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
          {variant === "full" && (
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Overview
                </h3>
                {reviewSummary && (
                  <RiskScoreGauge
                    score={reviewSummary.risk_score}
                    riskLevel={reviewSummary.risk_level}
                    size={48}
                  />
                )}
              </div>
              {reviewSummary && (
                <FindingsStats
                  counts={{
                    critical: reviewSummary.critical_count,
                    high: reviewSummary.high_count,
                    medium: reviewSummary.medium_count,
                    low: reviewSummary.low_count,
                  }}
                  multiAgentCount={reviewSummary.multi_agent_confirmed_count}
                />
              )}

              {mergeRec && (
                <MergeDecisionBanner
                  recommendation={mergeRec}
                  verdict={reviewSummary?.decision_verdict}
                  explanation={reviewSummary?.merge_explanation}
                  primaryRiskCategory={reviewSummary?.primary_risk_category}
                  className="mt-3"
                />
              )}

              {showSystemic && <SystemicPatternsBanner patterns={systemicPatterns} />}

              {executionMetadata?.agents_status && (
                <DegradedAnalysisBanner agentsStatus={executionMetadata.agents_status} />
              )}
            </div>
          )}

          {variant === "main" && showMainVariantHeader && (
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
              {showSystemic && <SystemicPatternsBanner patterns={systemicPatterns} />}
              {showDegraded && executionMetadata?.agents_status && (
                <DegradedAnalysisBanner agentsStatus={executionMetadata.agents_status} />
              )}
            </div>
          )}

          {hasSummary && (
            <div className="px-4 py-3">
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap wrap-break-word">
                {displayText}
              </p>
            </div>
          )}
          {executionMetadata && (
            <ExecutionBar executionMetadata={executionMetadata} performance={performance} />
          )}
          {(signature || reviewMetadata) && (
            <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                <span>Engine v{signature?.engine_version ?? reviewMetadata?.engine_version}</span>
                <span>·</span>
                <span title={signature?.review_hash ?? reviewMetadata?.review_hash}>
                  Hash: {(signature?.review_hash ?? reviewMetadata?.review_hash ?? "").slice(0, 12)}...
                </span>
                {(signature?.review_status ?? reviewMetadata?.review_status) && (
                  <>
                    <span>·</span>
                    <span className={
                      (signature?.review_status ?? reviewMetadata?.review_status) === "partial"
                        ? "text-amber-500"
                        : "text-zinc-400 dark:text-zinc-500"
                    }>
                      Status: {signature?.review_status ?? reviewMetadata?.review_status}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {hasSummary && (!findings || findings.length === 0) && (
        <div className="flex w-full flex-col gap-3">
          {variant === "full" && (
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Summary
            </h3>
          )}
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm">
            <div className="p-4">
              {hasSummary && (
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap wrap-break-word">
                  {displayText}
                </p>
              )}
              {variant === "full" && mergeRec && (
                <MergeDecisionBanner
                  recommendation={mergeRec}
                  verdict={reviewSummary?.decision_verdict}
                  explanation={reviewSummary?.merge_explanation}
                  primaryRiskCategory={reviewSummary?.primary_risk_category}
                  className="mt-3"
                />
              )}
            </div>
            {executionMetadata && (
              <ExecutionBar executionMetadata={executionMetadata} performance={performance} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
