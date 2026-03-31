"use client";

import { useUsage } from "./usage-context";

export function UsageCounter() {
  const { usage, usageLoadFailed } = useUsage();

  if (usageLoadFailed) {
    return (
      <p className="text-sm text-amber-700 dark:text-amber-300">
        Couldn&apos;t load usage this month. Refresh the page or try again
        later.
      </p>
    );
  }

  if (!usage) return null;

  const pct = Math.min((usage.review_count / usage.limit) * 100, 100);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">
          Reviews this month
        </span>
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {usage.review_count} / {usage.limit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full bg-zinc-900 transition-all dark:bg-zinc-100"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
