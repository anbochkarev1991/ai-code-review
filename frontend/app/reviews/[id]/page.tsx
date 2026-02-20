import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { GetReviewResponse } from "@/lib/types";
import { ReviewFindingsList } from "@/app/dashboard/review-findings-list";
import { ReviewSummary } from "@/app/dashboard/review-summary";
import { ReviewTrace } from "@/app/dashboard/review-trace";

async function fetchReview(
  id: string,
  accessToken: string
): Promise<GetReviewResponse | null> {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
  const res = await fetch(`${backendUrl}/reviews/${id}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
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
    case "completed":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
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
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-3 sm:p-4 dark:bg-zinc-950">
        <main className="flex w-full max-w-3xl flex-col items-center gap-4 sm:gap-6 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 md:p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No session. Redirecting to login...
          </p>
          <Link
            href="/login"
            className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Go to login
          </Link>
        </main>
      </div>
    );
  }

  const review = await fetchReview(id, session.access_token);

  if (review === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-3 sm:p-4 dark:bg-zinc-950">
        <main className="flex w-full max-w-3xl flex-col items-center gap-4 sm:gap-6 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 md:p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Review Not Found
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center px-4">
            The review you're looking for doesn't exist or you don't have
            permission to view it.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <Link
              href="/reviews"
              className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 text-center"
            >
              Back to Reviews
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 text-center"
            >
              Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-3 sm:p-4 dark:bg-zinc-950">
      <main className="flex w-full max-w-3xl flex-col gap-4 sm:gap-6 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 md:p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 w-full">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Review Details
          </h1>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <Link
              href="/reviews"
              className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 self-start sm:self-auto"
            >
              Back to Reviews
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 self-start sm:self-auto"
            >
              Dashboard
            </Link>
          </div>
        </div>

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

          {review.result_snapshot && (
            <div className="flex flex-col gap-4">
              {review.result_snapshot.summary && (
                <ReviewSummary summary={review.result_snapshot.summary} />
              )}
              <ReviewFindingsList
                findings={review.result_snapshot.findings}
              />
            </div>
          )}

          {review.trace && review.trace.length > 0 && (
            <ReviewTrace trace={review.trace} />
          )}

          {!review.result_snapshot &&
            !review.error_message &&
            review.status !== "failed" && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:p-4 text-xs sm:text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
                Review is still processing or no results available.
              </div>
            )}
        </div>
      </main>
    </div>
  );
}
