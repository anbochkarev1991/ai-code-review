import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import type { MeResponse, ReposResponse, UsageResponse } from "@/lib/types";
import { RepoAndPRSelectors } from "./repo-and-pr-selectors";
import { UpgradeToProButton } from "./upgrade-to-pro-button";
import { GitHubCallbackHandler } from "./github-callback-handler";
import { ensureAbsoluteUrl } from "@/lib/url-utils";
import { Tooltip } from "./tooltip";

function getBackendUrl(): string {
  return ensureAbsoluteUrl(
    process.env.NEXT_PUBLIC_BACKEND_URL,
    "http://localhost:3001"
  );
}
import { UsageProvider } from "./usage-context";
import { UsageCounter } from "./usage-counter";

async function fetchBillingUsage(
  accessToken: string
): Promise<UsageResponse | null> {
  const backendUrl = getBackendUrl();
  try {
    const res = await fetch(`${backendUrl}/billing/usage`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      console.error("Expected JSON but got:", contentType);
      return null;
    }
    return res.json();
  } catch (error: unknown) {
    console.error("Error fetching billing usage:", error);
    return null;
  }
}

async function fetchMe(accessToken: string): Promise<MeResponse | null> {
  const backendUrl = getBackendUrl();
  try {
    const res = await fetch(`${backendUrl}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`Failed to fetch /me: ${res.status} ${res.statusText}`);
      return null;
    }
    const contentType = res.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      console.error("Expected JSON but got:", contentType);
      return null;
    }
    return res.json();
  } catch (error: unknown) {
    console.error("Error fetching me:", error);
    return null;
  }
}

async function fetchRepos(
  accessToken: string
): Promise<ReposResponse | null> {
  const backendUrl = getBackendUrl();
  try {
    const res = await fetch(`${backendUrl}/github/repos`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      console.error("Expected JSON but got:", contentType);
      return null;
    }
    return res.json();
  } catch (error: unknown) {
    console.error("Error fetching repos:", error);
    return null;
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

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

  const [me, usage] = await Promise.all([
    fetchMe(session.access_token),
    fetchBillingUsage(session.access_token),
  ]);
  const reposData =
    me?.github_connected ? await fetchRepos(session.access_token) : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Suspense fallback={null}>
        <GitHubCallbackHandler />
      </Suspense>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Dashboard
          </h1>
          <Link
            href="/reviews"
            className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Past Reviews →
          </Link>
        </div>

        {me ? (
          <UsageProvider initialUsage={usage} accessToken={session.access_token}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left Sidebar - Profile & Stats */}
            <div className="flex flex-col gap-6 lg:col-span-1">
              {/* Profile Card */}
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-4">
                  {me.profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={me.profile.avatar_url}
                      alt="Avatar"
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-200 text-xl font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400 flex-shrink-0">
                      {(me.profile.display_name ?? me.profile.email)?.[0]?.toUpperCase() ?? "?"}
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="truncate font-semibold text-lg text-zinc-900 dark:text-zinc-100">
                      {me.profile.display_name ?? "User"}
                    </p>
                    <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                      {me.profile.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Usage Stats Card */}
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Usage
                </h2>
                <div className="space-y-4">
                  <UsageCounter />
                  <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Plan</span>
                    <span className="text-sm font-medium capitalize text-zinc-900 dark:text-zinc-100">
                      {usage?.plan ?? me.plan}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800">
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">GitHub</span>
                    <span className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {me.github_connected ? (
                        <>
                          <span className="h-2 w-2 rounded-full bg-green-500"></span>
                          Connected
                        </>
                      ) : (
                        <>
                          <span className="h-2 w-2 rounded-full bg-zinc-400"></span>
                          Not connected
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Upgrade Card (Free plan only) */}
              {me.plan === "free" && (
                <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Upgrade
                  </h2>
                  <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                    Unlock more reviews and{" "}
                    <Tooltip
                      content={
                        <div className="text-left text-zinc-900">
                          <div className="font-semibold mb-2 text-zinc-900">Pro Plan Benefits ($19.99/month):</div>
                          <ul className="list-disc list-inside space-y-1 text-zinc-900">
                            <li>200 reviews per month (vs 10 for free)</li>
                            <li>Priority processing</li>
                            <li>Full access to all review features:
                              <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5 text-zinc-700">
                                <li>Code Quality analysis</li>
                                <li>Architecture review</li>
                                <li>Performance optimization</li>
                                <li>Security scanning</li>
                                <li>Aggregated findings with severity levels</li>
                              </ul>
                            </li>
                          </ul>
                        </div>
                      }
                    >
                      <span className="underline decoration-dotted cursor-help">
                        advanced features
                      </span>
                    </Tooltip>{" "}
                    with Pro.
                  </p>
                  <UpgradeToProButton accessToken={session.access_token} />
                </div>
              )}
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-2">
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  Run Code Review
                </h2>

                {!me.github_connected ? (
                  <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
                    <div className="rounded-full bg-zinc-100 p-4 dark:bg-zinc-800">
                      <svg
                        className="h-8 w-8 text-zinc-600 dark:text-zinc-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        Connect GitHub to get started
                      </h3>
                      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                        Connect your GitHub account to access repositories and run code reviews.
                      </p>
                      <a
                        href={`${getBackendUrl()}/github/oauth?state=${encodeURIComponent(session.access_token)}`}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      >
                        <svg
                          className="h-5 w-5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                        Connect GitHub
                      </a>
                    </div>
                  </div>
                ) : reposData ? (
                  <RepoAndPRSelectors
                    repos={reposData.repos}
                    accessToken={session.access_token}
                  />
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Failed to load repositories. Make sure the backend is running and GitHub is connected.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          </UsageProvider>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-white p-6 shadow-sm dark:border-amber-800 dark:bg-zinc-900">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Failed to load profile from backend. Make sure the backend is running and NEXT_PUBLIC_BACKEND_URL is set.
            </p>
          </div>
        )}

        {/* Footer Link */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
