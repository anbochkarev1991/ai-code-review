import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { MeResponse, ReposResponse, UsageResponse } from "@/lib/types";
import { RepoAndPRSelectors } from "./repo-and-pr-selectors";
import { UpgradeToProButton } from "./upgrade-to-pro-button";

async function fetchBillingUsage(
  accessToken: string
): Promise<UsageResponse | null> {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
  const res = await fetch(`${backendUrl}/billing/usage`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchMe(accessToken: string): Promise<MeResponse | null> {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
  const res = await fetch(`${backendUrl}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchRepos(
  accessToken: string
): Promise<ReposResponse | null> {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
  const res = await fetch(`${backendUrl}/github/repos`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-3 sm:p-4 dark:bg-zinc-950">
        <main className="flex w-full max-w-md flex-col items-center gap-4 sm:gap-6 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 md:p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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

  const [me, usage] = await Promise.all([
    fetchMe(session.access_token),
    fetchBillingUsage(session.access_token),
  ]);
  const reposData =
    me?.github_connected ? await fetchRepos(session.access_token) : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-3 sm:p-4 dark:bg-zinc-950">
      <main className="flex w-full max-w-md flex-col items-center gap-4 sm:gap-6 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 md:p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-2 sm:gap-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Dashboard
          </h1>
          <Link
            href="/reviews"
            className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 self-start sm:self-auto"
          >
            Past Reviews
          </Link>
        </div>

        {me ? (
          <div className="flex w-full flex-col gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 rounded-lg border border-zinc-200 p-2 sm:p-3 dark:border-zinc-700">
              {me.profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={me.profile.avatar_url}
                  alt="Avatar"
                  width={48}
                  height={48}
                  className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-zinc-200 text-base sm:text-lg font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400 flex-shrink-0">
                  {(me.profile.display_name ?? me.profile.email)?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <p className="font-medium text-sm sm:text-base text-zinc-900 dark:text-zinc-100 truncate">
                  {me.profile.display_name ?? "User"}
                </p>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 truncate">
                  {me.profile.email}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-zinc-100 px-2.5 sm:px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 break-words">
                {usage
                  ? `${usage.review_count} / ${usage.limit} reviews this month — ${usage.plan.charAt(0).toUpperCase() + usage.plan.slice(1)}`
                  : `Plan: ${me.plan}`}
              </span>
              <span className="rounded-full bg-zinc-100 px-2.5 sm:px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                GitHub: {me.github_connected ? "Connected" : "Not connected"}
              </span>
            </div>

            {me.plan === "free" && (
              <UpgradeToProButton accessToken={session.access_token} />
            )}

            {!me.github_connected && (
              <a
                href={`${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001"}/github/oauth?state=${encodeURIComponent(session.access_token)}`}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Connect GitHub
              </a>
            )}

            {me.github_connected && reposData && (
              <RepoAndPRSelectors
                repos={reposData.repos}
                accessToken={session.access_token}
              />
            )}
            {me.github_connected && reposData === null && (
              <p className="text-sm text-amber-600 dark:text-amber-500">
                Failed to load repositories. Make sure the backend is running and
                GitHub is connected.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-amber-600 dark:text-amber-500">
            Failed to load profile from backend. Make sure the backend is running and NEXT_PUBLIC_BACKEND_URL is set.
          </p>
        )}

        <Link
          href="/"
          className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Back to home
        </Link>
      </main>
    </div>
  );
}
