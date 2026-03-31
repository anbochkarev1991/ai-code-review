import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { GetReviewResponse } from "@/lib/types";
import { parseGetReviewResponse } from "shared";
import { AiReviewSummaryBlock } from "@/app/dashboard/ai-review-summary-block";
import { ReviewFindingsList } from "@/app/dashboard/review-findings-list";
import { ReviewSummarySidebar } from "@/app/dashboard/review-summary-sidebar";
import { ReviewSummary } from "@/app/dashboard/review-summary";
import { ReviewTrace } from "@/app/dashboard/review-trace";

type ReviewFetchFailedReason =
  | "not_found"
  | "forbidden"
  | "server_error"
  | "network";

type FetchReviewResult =
  | { ok: true; data: GetReviewResponse }
  | { ok: false; reason: ReviewFetchFailedReason };

async function fetchReview(
  id: string,
  accessToken: string
): Promise<FetchReviewResult> {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
  try {
    const res = await fetch(`${backendUrl}/reviews/${id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    if (res.status === 404) {
      return { ok: false, reason: "not_found" };
    }
    if (res.status === 403) {
      return { ok: false, reason: "forbidden" };
    }
    if (!res.ok) {
      return { ok: false, reason: "server_error" };
    }
    const contentType = res.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return { ok: false, reason: "server_error" };
    }
    const json: unknown = await res.json();
    const data = parseGetReviewResponse(json);
    if (!data) {
      return { ok: false, reason: "server_error" };
    }
    return { ok: true, data };
  } catch (error: unknown) {
    console.error("Failed to fetch review:", error);
    return { ok: false, reason: "network" };
  }
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

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "complete":
    case "completed":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "partial":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "running":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    default:
      return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const sessionResult = await supabase.auth.getSession();
  const session = sessionResult.data?.session;

  if (!session?.access_token) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              No session. Redirecting to login...
            </p>
            <Link
              href="/login"
              className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Go to login →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const reviewResult = await fetchReview(id, session.access_token);

  if (!reviewResult.ok) {
    const titles: Record<ReviewFetchFailedReason, string> = {
      not_found: "Review Not Found",
      forbidden: "Access Denied",
      server_error: "Something Went Wrong",
      network: "Connection Problem",
    };
    const bodies: Record<ReviewFetchFailedReason, string> = {
      not_found:
        "The review you are looking for does not exist or was removed.",
      forbidden: "You do not have permission to view this review.",
      server_error:
        "We could not load this review from the server. Try again in a moment.",
      network:
        "Check your connection and try again. If the problem continues, the service may be unreachable.",
    };
    const reason = reviewResult.reason;
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h1 className="mb-4 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {titles[reason]}
            </h1>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              {bodies[reason]}
            </p>
            <Link
              href="/reviews"
              className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Back to Reviews →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const review = reviewResult.data;
  const resultSnapshot = review.result_snapshot;
  const hasRenderableSnapshot =
    !!resultSnapshot &&
    typeof resultSnapshot.summary === "string" &&
    Array.isArray(resultSnapshot.findings);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Review Details
          </h1>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Status
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap flex-shrink-0 ${getStatusColor(review.status)}`}
                  >
                    {review.status}
                  </span>
                </div>
                <div className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400 break-words">
                  <div>
                    <span className="font-medium">Created:</span>{" "}
                    {formatDate(review.created_at)}
                  </div>
                  <div>
                    <span className="font-medium">Updated:</span>{" "}
                    {formatDate(review.updated_at)}
                  </div>
                </div>
              </div>
            </div>

            {review.error_message && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 sm:p-4 dark:border-amber-800 dark:bg-amber-900/20">
                <p className="text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-200">
                  Error
                </p>
                <p className="mt-1 text-xs sm:text-sm text-amber-800 dark:text-amber-300 break-words">
                  {review.error_message}
                </p>
              </div>
            )}

            {hasRenderableSnapshot && resultSnapshot && (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_300px] md:items-start">
                <div className="md:col-start-2 md:row-start-1 md:flex md:h-full md:min-h-0 md:flex-col md:pb-6">
                  <ReviewSummarySidebar
                    summary={resultSnapshot.summary}
                    findings={resultSnapshot.findings}
                    reviewSummary={resultSnapshot.review_summary}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-8 md:col-start-1 md:row-start-1 md:pb-6">
                  {resultSnapshot.ai_review_summary && (
                    <AiReviewSummaryBlock
                      aiReviewSummary={resultSnapshot.ai_review_summary}
                    />
                  )}
                  <ReviewSummary
                    summary={resultSnapshot.summary}
                    findings={resultSnapshot.findings}
                    executionMetadata={resultSnapshot.execution_metadata}
                    reviewSummary={resultSnapshot.review_summary}
                    prMetadata={resultSnapshot.pr_metadata}
                    performance={resultSnapshot.performance}
                    signature={resultSnapshot.signature}
                    reviewStatus={review.status}
                    reviewMetadata={resultSnapshot.review_metadata}
                    variant="main"
                  />
                  <ReviewFindingsList
                    findings={resultSnapshot.findings}
                    accessToken={session.access_token}
                  />
                </div>
              </div>
            )}

            {review.trace && review.trace.length > 0 && (
              <ReviewTrace trace={review.trace} />
            )}

            {!hasRenderableSnapshot &&
              !review.error_message &&
              review.status !== "failed" && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:p-4 text-xs sm:text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
                  Review is still processing or no results available.
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
