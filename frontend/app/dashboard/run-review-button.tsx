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

        const res = await fetch(`${backendUrl}/reviews/${reviewId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
          throw new Error(`Polling failed: ${res.statusText}`);
        }
        const json: unknown = await res.json();
        const review = parseGetReviewResponse(json);
        if (!review) {
          throw new Error("Invalid polling response");
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
      throw new Error("Review timed out — please check the Reviews page later.");
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
      const response = await fetch(`${backendUrl}/reviews`, {
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ?? `Failed to run review: ${response.statusText}`
        );
      }

      const json: unknown = await response.json();
      const data = parsePostReviewsResponse(json);
      if (!data) {
        throw new Error("Invalid review response payload");
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
        setError("Failed to run review");
      }
    } finally {
      stopTimer();
      setLoading(false);
    }
  };

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
              Running review... {elapsed > 0 && `(${elapsed}s)`}
            </>
          ) : (
            "Run review"
          )}
        </button>
        {error && (
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
