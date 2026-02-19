"use client";

import { useEffect, useState } from "react";
import type { Pull, PullsResponse } from "@/lib/types";

interface PRSelectorProps {
  owner: string;
  repo: string;
  accessToken: string;
  value?: string;
  onChange?: (prNumber: string) => void;
}

export function PRSelector({
  owner,
  repo,
  accessToken,
  value = "",
  onChange,
}: PRSelectorProps) {
  const [pulls, setPulls] = useState<Pull[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

    fetch(
      `${backendUrl}/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=open`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    )
      .then(async (res) => {
        if (cancelled) return null;
        if (!res.ok) return null;
        return res.json() as Promise<PullsResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setPulls(data.pulls);
        } else {
          setError("Failed to load pull requests.");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load pull requests.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [owner, repo, accessToken]);

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Pull Request
        </label>
        <div className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          Loading pull requests...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex w-full flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Pull Request
        </label>
        <p className="text-sm text-amber-600 dark:text-amber-500">{error}</p>
      </div>
    );
  }

  if (!pulls || pulls.length === 0) {
    return (
      <div className="flex w-full flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Pull Request
        </label>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No open pull requests in this repository.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <label
        htmlFor="pr-select"
        className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        Pull Request
      </label>
      <select
        id="pr-select"
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        aria-label="Select a pull request"
      >
        <option value="" disabled>
          Select a pull request
        </option>
        {pulls.map((pull) => (
          <option key={pull.number} value={pull.number}>
            #{pull.number} {pull.title}
          </option>
        ))}
      </select>
    </div>
  );
}
