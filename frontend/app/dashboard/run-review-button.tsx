"use client";

import { useState } from "react";
import type { PostReviewsResponse } from "@/lib/types";

interface RunReviewButtonProps {
  repoFullName: string;
  prNumber: number;
  accessToken: string;
}

const REVIEW_TIMEOUT_MS = 60000; // 60 seconds

export function RunReviewButton({
  repoFullName,
  prNumber,
  accessToken,
}: RunReviewButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunReview = async () => {
    setLoading(true);
    setError(null);

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

    // Create AbortController for timeout handling
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, REVIEW_TIMEOUT_MS);

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
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ?? `Failed to run review: ${response.statusText}`
        );
      }

      const data = (await response.json()) as PostReviewsResponse;

      // Display error_message from response if present
      if (data.error_message) {
        setError(data.error_message);
        setLoading(false);
        return;
      }

      // Response handling for successful reviews will be implemented in task 5.3
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof Error) {
        if (err.name === "AbortError") {
          setError("Review request timed out after 60 seconds. Please try again.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Failed to run review");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <button
        onClick={handleRunReview}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-zinc-900 dark:border-t-transparent" />
            Running review...
          </>
        ) : (
          "Run review"
        )}
      </button>
      {error && (
        <p className="text-sm text-amber-600 dark:text-amber-500">{error}</p>
      )}
    </div>
  );
}
