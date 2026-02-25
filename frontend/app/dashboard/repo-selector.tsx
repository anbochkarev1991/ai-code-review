"use client";

import type { Repo } from "@/lib/types";

interface RepoSelectorProps {
  repos: Repo[];
  value?: string;
  onChange?: (fullName: string) => void;
}

export function RepoSelector({
  repos,
  value = "",
  onChange,
}: RepoSelectorProps) {
  return (
    <div className="flex w-full flex-col gap-2">
      <label
        htmlFor="repo-select"
        className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        Repository
      </label>
      <select
        id="repo-select"
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        aria-label="Select a repository"
      >
        <option value="" disabled>
          Select a repository
        </option>
        {repos.map((repo) => (
          <option key={repo.full_name} value={repo.full_name}>
            {repo.full_name}
            {repo.private ? " (private)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
