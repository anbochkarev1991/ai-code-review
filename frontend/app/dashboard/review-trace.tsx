"use client";

import { useState } from "react";
import type { TraceStep } from "@/lib/types";

interface ReviewTraceProps {
  trace: TraceStep[];
}

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

function AgentTelemetryCard({ step }: { step: TraceStep }) {
  const durationMs = step.duration_ms ?? (
    new Date(step.finished_at).getTime() - new Date(step.started_at).getTime()
  );

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2.5 sm:p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="flex flex-col gap-2.5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
              {step.agent}
            </h4>
            {step.parallel && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                parallel
              </span>
            )}
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${getStatusColor(step.status)}`}
          >
            {step.status}
          </span>
        </div>

        {/* Telemetry Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <TelemetryCell label="Latency" value={formatMs(durationMs)} />
          {step.tokens_used !== undefined && (
            <TelemetryCell label="Tokens" value={formatTokens(step.tokens_used)} />
          )}
          {step.prompt_tokens !== undefined && step.completion_tokens !== undefined && (
            <TelemetryCell
              label="Prompt / Completion"
              value={`${formatTokens(step.prompt_tokens)} / ${formatTokens(step.completion_tokens)}`}
            />
          )}
          {step.prompt_size_chars !== undefined && (
            <TelemetryCell
              label="Prompt size"
              value={`${(step.prompt_size_chars / 1000).toFixed(1)}k chars`}
            />
          )}
          {step.finding_count !== undefined && (
            <TelemetryCell label="Findings" value={String(step.finding_count)} />
          )}
          {step.avg_confidence !== undefined && (
            <TelemetryCell
              label="Confidence avg"
              value={step.avg_confidence.toFixed(2)}
            />
          )}
        </div>

        {/* Error message */}
        {step.error_message && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
            <p className="text-xs text-red-700 dark:text-red-300 wrap-break-word">
              {step.error_message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function TelemetryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 font-medium">
        {label}
      </span>
      <span className="text-xs font-mono text-zinc-900 dark:text-zinc-100">
        {value}
      </span>
    </div>
  );
}

export function ReviewTrace({ trace }: ReviewTraceProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!trace || trace.length === 0) {
    return null;
  }

  const totalDuration = Math.max(
    ...trace.map((s: TraceStep) => new Date(s.finished_at).getTime()),
  ) - Math.min(...trace.map((s: TraceStep) => new Date(s.started_at).getTime()));

  const totalTokens = trace
    .filter((s: TraceStep) => s.tokens_used !== undefined)
    .reduce((sum: number, s: TraceStep) => sum + (s.tokens_used ?? 0), 0);

  return (
    <div className="flex w-full flex-col gap-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 sm:px-4 py-2.5 sm:py-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Agent Telemetry
          </h3>
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{trace.length} agents</span>
            <span>·</span>
            <span>{formatMs(totalDuration)}</span>
            {totalTokens > 0 && (
              <>
                <span>·</span>
                <span>{formatTokens(totalTokens)} tokens</span>
              </>
            )}
          </div>
        </div>
        <svg
          className={`h-4 w-4 sm:h-5 sm:w-5 text-zinc-500 transition-transform dark:text-zinc-400 shrink-0 ${
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
        <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 sm:p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          {trace.map((step: TraceStep, index: number) => (
            <AgentTelemetryCard key={index} step={step} />
          ))}
        </div>
      )}
    </div>
  );
}
