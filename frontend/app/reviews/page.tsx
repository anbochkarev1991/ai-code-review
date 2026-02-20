import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { GetReviewsResponse } from "@/lib/types";

async function fetchReviews(
  accessToken: string,
  limit: number = 20,
  offset: number = 0
): Promise<GetReviewsResponse | null> {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
  const res = await fetch(
    `${backendUrl}/reviews?limit=${limit}&offset=${offset}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );
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

export default async function ReviewsPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
        <main className="flex w-full max-w-3xl flex-col items-center gap-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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

  const reviewsData = await fetchReviews(session.access_token);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <main className="flex w-full max-w-3xl flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Past Reviews
          </h1>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Back to Dashboard
          </Link>
        </div>

        {reviewsData === null ? (
          <p className="text-sm text-amber-600 dark:text-amber-500">
            Failed to load reviews. Make sure the backend is running.
          </p>
        ) : reviewsData.items.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-800/50">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No reviews yet. Run your first review from the dashboard.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-block text-sm font-medium text-zinc-900 underline hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-300"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Showing {reviewsData.items.length} of {reviewsData.total} reviews
            </p>
            <div className="flex flex-col gap-3">
              {reviewsData.items.map((review) => (
                <Link
                  key={review.id}
                  href={`/reviews/${review.id}`}
                  className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                          {review.pr_title || `PR #${review.pr_number}`}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {review.repo_full_name}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(review.status)}`}
                      >
                        {review.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>PR #{review.pr_number}</span>
                      <span>•</span>
                      <span>{formatDate(review.created_at)}</span>
                      {review.result_snapshot && (
                        <>
                          <span>•</span>
                          <span>
                            {review.result_snapshot.findings.length} finding
                            {review.result_snapshot.findings.length !== 1
                              ? "s"
                              : ""}
                          </span>
                        </>
                      )}
                      {review.error_message && (
                        <>
                          <span>•</span>
                          <span className="text-amber-600 dark:text-amber-500">
                            Error
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
