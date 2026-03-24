"use client";

import { useState, type ReactNode } from "react";
import { MODEL_RATES } from "shared";
import type { TraceStep } from "@/lib/types";

interface ReviewTraceProps {
  trace: TraceStep[];
}

const COST_MODEL_KEY = "gpt-4o-mini";

function getStatusColor(status: TraceStep["status"]): string {
  switch (status) {
    case "ok":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "timeout":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    case "error":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return tokens.toLocaleString();
}

/** Aligns with backend ResultFormatter default when model is unknown. */
function formatCost(usd: number): string {
  const rounded = Math.round(usd * 10000) / 10000;
  if (rounded === 0 && usd > 0) {
    return `~$${usd.toExponential(1)}`;
  }
  return `~$${rounded.toFixed(4)}`;
}

function estimateStepCost(step: TraceStep): number | undefined {
  const rate =
    MODEL_RATES[COST_MODEL_KEY] ??
    MODEL_RATES["gpt-4o-mini"] ?? { prompt: 0.15e-6, completion: 0.6e-6 };
  let promptTokens = step.prompt_tokens ?? 0;
  let completionTokens = step.completion_tokens ?? 0;

  if (promptTokens === 0 && completionTokens === 0 && step.tokens_used !== undefined && step.tokens_used > 0) {
    promptTokens = Math.round(step.tokens_used * 0.8);
    completionTokens = step.tokens_used - promptTokens;
  }

  if (promptTokens === 0 && completionTokens === 0) {
    return undefined;
  }

  return promptTokens * rate.prompt + completionTokens * rate.completion;
}

function sumTraceCost(trace: TraceStep[]): number | undefined {
  let sum = 0;
  let any = false;
  for (const step of trace) {
    const c = estimateStepCost(step);
    if (c !== undefined) {
      sum += c;
      any = true;
    }
  }
  return any ? sum : undefined;
}

function getConfidenceBarColor(value: number): string {
  if (value >= 0.7) {
    return "bg-emerald-500 dark:bg-emerald-400";
  }
  if (value >= 0.4) {
    return "bg-amber-500 dark:bg-amber-400";
  }
  return "bg-red-500 dark:bg-red-400";
}

function getAgentIcon(agentName: string): ReactNode {
  const common = "h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400";
  const lower = agentName.toLowerCase();

  if (lower.includes("security")) {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    );
  }
  if (lower.includes("performance")) {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    );
  }
  if (lower.includes("architecture")) {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
        />
      </svg>
    );
  }
  /* Code Quality and default */
  return (
    <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
      />
    </svg>
  );
}

function TelemetryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span className="truncate font-mono text-xs text-zinc-900 tabular-nums dark:text-zinc-100">
        {value}
      </span>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Confidence
      </span>
      <div className="flex items-center gap-2">
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className={`h-full rounded-full transition-[width] ${getConfidenceBarColor(value)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-900 dark:text-zinc-100">
          {value.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function AgentTelemetryCard({ step }: { step: TraceStep }) {
  const durationMs =
    step.duration_ms ??
    new Date(step.finished_at).getTime() - new Date(step.started_at).getTime();

  const tokensDisplay =
    step.tokens_used !== undefined ? formatTokens(step.tokens_used) : "—";

  const findingsDisplay =
    step.finding_count !== undefined ? String(step.finding_count) : "—";

  const stepCost = estimateStepCost(step);

  return (
    <div className="rounded-lg border border-zinc-200/90 bg-zinc-50/80 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/40">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {getAgentIcon(step.agent)}
            <div className="flex min-w-0 flex-col gap-0.5">
              <h4 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {step.agent}
              </h4>
              {step.parallel && (
                <span className="w-fit rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  parallel
                </span>
              )}
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${getStatusColor(step.status)}`}
          >
            {step.status}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <TelemetryCell label="Latency" value={formatMs(durationMs)} />
          <TelemetryCell label="Tokens" value={tokensDisplay} />
          <TelemetryCell label="Findings" value={findingsDisplay} />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          {step.avg_confidence !== undefined ? (
            <ConfidenceBar value={step.avg_confidence} />
          ) : (
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Confidence
              </span>
              <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">—</span>
            </div>
          )}
          <div className="flex shrink-0 flex-col gap-0.5 sm:text-right">
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Est. cost
            </span>
            <span className="font-mono text-xs tabular-nums text-zinc-900 dark:text-zinc-100">
              {stepCost !== undefined ? formatCost(stepCost) : "—"}
            </span>
          </div>
        </div>

        {step.error_message && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-900/20">
            <p className="wrap-break-word text-xs text-red-700 dark:text-red-300">{step.error_message}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TelemetrySummaryFooter({ trace }: { trace: TraceStep[] }) {
  const totalDuration =
    Math.max(...trace.map((s) => new Date(s.finished_at).getTime())) -
    Math.min(...trace.map((s) => new Date(s.started_at).getTime()));

  const totalTokens = trace.reduce((sum, s) => sum + (s.tokens_used ?? 0), 0);

  const totalFindings = trace.reduce((sum, s) => sum + (s.finding_count ?? 0), 0);

  const totalCost = sumTraceCost(trace);

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-zinc-200 pt-3 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
      <span className="font-medium text-zinc-700 dark:text-zinc-300">Total</span>
      <span className="hidden sm:inline">·</span>
      <span>{formatMs(totalDuration)} wall time</span>
      <span>·</span>
      <span>{totalTokens > 0 ? `${formatTokens(totalTokens)} tokens` : "0 tokens"}</span>
      {totalCost !== undefined && (
        <>
          <span>·</span>
          <span className="font-mono tabular-nums">{formatCost(totalCost)}</span>
        </>
      )}
      <span>·</span>
      <span>{totalFindings} findings</span>
    </div>
  );
}

export function ReviewTrace({ trace }: ReviewTraceProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!trace || trace.length === 0) {
    return null;
  }

  const totalDuration =
    Math.max(...trace.map((s: TraceStep) => new Date(s.finished_at).getTime())) -
    Math.min(...trace.map((s: TraceStep) => new Date(s.started_at).getTime()));

  const totalTokens = trace
    .filter((s: TraceStep) => s.tokens_used !== undefined)
    .reduce((sum: number, s: TraceStep) => sum + (s.tokens_used ?? 0), 0);

  const headerCost = sumTraceCost(trace);

  return (
    <div className="flex w-full flex-col gap-3">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 sm:px-4 sm:py-3 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <h3 className="shrink-0 text-base font-semibold text-zinc-900 sm:text-lg dark:text-zinc-100">
            Agent Telemetry
          </h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{trace.length} agents</span>
            <span className="hidden sm:inline">·</span>
            <span>{formatMs(totalDuration)}</span>
            {totalTokens > 0 && (
              <>
                <span>·</span>
                <span>{formatTokens(totalTokens)} tokens</span>
              </>
            )}
            {headerCost !== undefined && (
              <>
                <span>·</span>
                <span className="font-mono tabular-nums">{formatCost(headerCost)}</span>
              </>
            )}
          </div>
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform sm:h-5 sm:w-5 dark:text-zinc-400 ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm sm:p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {trace.map((step: TraceStep, index: number) => (
              <AgentTelemetryCard key={index} step={step} />
            ))}
          </div>
          <TelemetrySummaryFooter trace={trace} />
        </div>
      )}
    </div>
  );
}
