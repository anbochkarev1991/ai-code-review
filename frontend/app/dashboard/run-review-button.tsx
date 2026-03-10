"use client";

import { useState, useRef } from "react";
import type { PostReviewsResponse, ReviewResult, ReviewStatus, TraceStep } from "@/lib/types";
import { ReviewFindingsList } from "./review-findings-list";
import { ReviewSummary } from "./review-summary";
import { ReviewTrace } from "./review-trace";
import { useUsage } from "./usage-context";

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

  const handleRunReview = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setTrace(null);
    setReviewStatus(null);
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
        const errorData = await response.json().catch((_err: unknown) => ({}));
        throw new Error(
          errorData.message ?? `Failed to run review: ${response.statusText}`
        );
      }

      const data = (await response.json()) as PostReviewsResponse;

      if (data.error_message) {
        setError(data.error_message);
        setLoading(false);
        setResult(null);
        setTrace(null);
        return;
      }

      if (data.status) {
        setReviewStatus(data.status);
      }
      if (data.result_snapshot) {
        setResult(data.result_snapshot);
      }
      if (data.trace) {
        setTrace(data.trace);
      }
      if (data.usage) {
        console.debug("[RunReviewButton] Pushing usage from review response", data.usage);
        pushUsage(data.usage);
      }
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
            <>
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
              />
              {result.findings.length > 0 && (
                <div className="border-t border-zinc-200 dark:border-zinc-700 mt-4" />
              )}
              <ReviewFindingsList
                findings={result.findings}
                accessToken={accessToken}
              />
            </>
          )}
          {trace && <ReviewTrace trace={trace} />}
        </div>
      )}
    </div>
  );
}
