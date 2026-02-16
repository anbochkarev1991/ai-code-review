import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { MeResponse } from "@/lib/types";

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

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
        <main className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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

  const me = await fetchMe(session.access_token);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <main className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Dashboard
        </h1>

        {me ? (
          <div className="flex w-full flex-col gap-4">
            <div className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
              {me.profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={me.profile.avatar_url}
                  alt="Avatar"
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 text-lg font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                  {(me.profile.display_name ?? me.profile.email)?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {me.profile.display_name ?? "User"}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {me.profile.email}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                Plan: {me.plan}
              </span>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                GitHub: {me.github_connected ? "Connected" : "Not connected"}
              </span>
            </div>
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
