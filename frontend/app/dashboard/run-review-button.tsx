"use client";

import { useState, useRef, useCallback } from "react";
import type { ReviewResult, ReviewStatus, TraceStep } from "@/lib/types";
import {
  parsePostReviewsResponse,
  parseGetReviewResponse,
} from "shared";
import { AiReviewSummaryBlock } from "./ai-review-summary-block";
import { ReviewFindingsList } from "./review-findings-list";
import { ReviewSummarySidebar } from "./review-summary-sidebar";
import { ReviewSummary } from "./review-summary";
import { ReviewTrace } from "./review-trace";
import { useUsage } from "./usage-context";

const POLL_INTERVAL_MS = 3_000;
const POLL_MAX_ATTEMPTS = 200;

const TERMINAL_STATUSES = new Set<ReviewStatus>(["complete", "partial", "failed"]);

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Queued",
  processing: "Analyzing code",
  complete: "Complete",
  partial: "Partially complete",
  failed: "Failed",
};

const STATUS_DESCRIPTIONS: Record<ReviewStatus, string> = {
  pending: "Your review is queued and will start shortly…",
  processing: "AI agents are analyzing your pull request…",
  complete: "Review finished successfully.",
  partial: "Review completed with some agents timed out.",
  failed: "Review could not be completed.",
};

type ReviewPhase = "submitting" | "queued" | "analyzing" | "finalizing";

function getPhase(status: ReviewStatus | null, loading: boolean): ReviewPhase | null {
  if (!loading) return null;
  if (!status) return "submitting";
  switch (status) {
    case "pending":
      return "queued";
    case "processing":
      return "analyzing";
    case "complete":
    case "partial":
    case "failed":
      return "finalizing";
    default:
      return "analyzing";
  }
}

const PHASES: { key: ReviewPhase; label: string }[] = [
  { key: "submitting", label: "Submitting" },
  { key: "queued", label: "Queued" },
  { key: "analyzing", label: "Analyzing" },
  { key: "finalizing", label: "Finishing up" },
];

function PhaseIndex(phase: ReviewPhase): number {
  return PHASES.findIndex((p) => p.key === phase);
}

interface RunReviewButtonProps {
  repoFullName: string;
  prNumber: number;
  accessToken: string;
}

export function RunReviewButton({
  repoFullName,
  prNumber,
  accessToken,
}: RunReviewButtonProps) {
  const { pushUsage } = useUsage();
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [trace, setTrace] = useState<TraceStep[] | null>(null);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const startTimer = () => {
    setElapsed(0);
    intervalRef.current = setInterval(() => setElapsed((e: number) => e + 1), 1000);
  };

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const pollReview = useCallback(
    async (reviewId: string, backendUrl: string) => {
      for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
        if (cancelledRef.current) return;
        await delay(POLL_INTERVAL_MS);
        if (cancelledRef.current) return;

        let res: Response;
        try {
          res = await fetch(`${backendUrl}/reviews/${reviewId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        } catch {
          console.warn(`[poll] Network error on attempt ${attempt + 1}, retrying…`);
          continue;
        }
        if (!res.ok) {
          console.warn(`[poll] HTTP ${res.status} on attempt ${attempt + 1}`);
          if (res.status >= 500) continue;
          throw new Error(
            "Unable to check review status. Please try refreshing the page.",
          );
        }
        const json: unknown = await res.json();
        const review = parseGetReviewResponse(json);
        if (!review) {
          console.error("[poll] Response failed schema validation:", json);
          throw new Error(
            "Received an unexpected response from the server. Please try again.",
          );
        }

        setReviewStatus(review.status);
        if (review.trace && review.trace.length > 0) {
          setTrace(review.trace);
        }

        if (TERMINAL_STATUSES.has(review.status)) {
          if (review.error_message) {
            setError(review.error_message);
          }
          if (review.result_snapshot) {
            setResult(review.result_snapshot);
          }
          return;
        }
      }
      throw new Error(
        "The review is taking longer than expected. You can check the Reviews page for results.",
      );
    },
    [accessToken],
  );

  const handleRunReview = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setTrace(null);
    setReviewStatus(null);
    cancelledRef.current = false;
    startTimer();

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

    try {
      let response: Response;
      try {
        response = await fetch(`${backendUrl}/reviews`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            repo_full_name: repoFullName,
            pr_number: prNumber,
          }),
        });
      } catch {
        throw new Error(
          "Could not connect to the server. Please check your connection and try again.",
        );
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 402) {
          throw new Error(
            errorData.message ??
              "You've reached your review limit. Upgrade your plan for more reviews.",
          );
        }
        throw new Error(
          errorData.message ??
            `Something went wrong (${response.status}). Please try again.`,
        );
      }

      const json: unknown = await response.json();
      const data = parsePostReviewsResponse(json);
      if (!data) {
        console.error("[review] POST response failed schema validation:", json);
        throw new Error(
          "Received an unexpected response from the server. Please try again.",
        );
      }

      if (data.usage) {
        pushUsage(data.usage);
      }

      if (data.error_message) {
        setError(data.error_message);
        return;
      }

      setReviewStatus(data.status);

      if (TERMINAL_STATUSES.has(data.status)) {
        if (data.result_snapshot) setResult(data.result_snapshot);
        if (data.trace) setTrace(data.trace);
        return;
      }

      await pollReview(data.id, backendUrl);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      stopTimer();
      setLoading(false);
    }
  };

  const phase = getPhase(reviewStatus, loading);
  const currentPhaseIdx = phase ? PhaseIndex(phase) : -1;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex w-full flex-col gap-3">
        <button
          onClick={handleRunReview}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-zinc-900 dark:border-t-transparent" />
              {reviewStatus
                ? STATUS_LABELS[reviewStatus]
                : "Submitting review"}
              {elapsed > 0 && (
                <span className="tabular-nums text-white/70 dark:text-zinc-900/60">
                  {elapsed}s
                </span>
              )}
            </>
          ) : (
            "Run review"
          )}
        </button>

        {loading && (
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
            <div className="flex items-center gap-3">
              {PHASES.map((p, i) => {
                const isComplete = i < currentPhaseIdx;
                const isCurrent = i === currentPhaseIdx;
                return (
                  <div key={p.key} className="flex items-center gap-1.5">
                    <div
                      className={`h-2 w-2 rounded-full transition-colors ${
                        isComplete
                          ? "bg-emerald-500"
                          : isCurrent
                            ? "animate-pulse bg-blue-500"
                            : "bg-zinc-300 dark:bg-zinc-600"
                      }`}
                    />
                    <span
                      className={`text-xs ${
                        isComplete
                          ? "text-emerald-700 dark:text-emerald-400"
                          : isCurrent
                            ? "font-medium text-blue-700 dark:text-blue-400"
                            : "text-zinc-400 dark:text-zinc-500"
                      }`}
                    >
                      {p.label}
                    </span>
                    {i < PHASES.length - 1 && (
                      <span className="mx-1 text-zinc-300 dark:text-zinc-600">›</span>
                    )}
                  </div>
                );
              })}
            </div>
            {reviewStatus && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {STATUS_DESCRIPTIONS[reviewStatus]}
              </p>
            )}
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            {error}
          </div>
        )}
      </div>
      {(result || trace) && (
        <div className="flex w-full flex-col gap-4">
          {result && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_300px] md:items-start">
              <div className="md:col-start-2 md:row-start-1 md:flex md:h-full md:min-h-0 md:flex-col md:pb-6">
                <ReviewSummarySidebar
                  summary={result.summary}
                  findings={result.findings}
                  reviewSummary={result.review_summary}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-8 md:col-start-1 md:row-start-1 md:pb-6">
                {result.ai_review_summary && (
                  <AiReviewSummaryBlock
                    aiReviewSummary={result.ai_review_summary}
                  />
                )}
                <ReviewSummary
                  summary={result.summary}
                  findings={result.findings}
                  executionMetadata={result.execution_metadata}
                  reviewSummary={result.review_summary}
                  prMetadata={result.pr_metadata}
                  performance={result.performance}
                  signature={result.signature}
                  reviewStatus={reviewStatus ?? undefined}
                  reviewMetadata={result.review_metadata}
                  variant="main"
                />
                <ReviewFindingsList
                  findings={result.findings}
                  accessToken={accessToken}
                />
              </div>
            </div>
          )}
          {trace && <ReviewTrace trace={trace} />}
        </div>
      )}
    </div>
  );
}
