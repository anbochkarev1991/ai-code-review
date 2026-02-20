"use client";

interface ReviewSummaryProps {
  summary: string;
}

export function ReviewSummary({ summary }: ReviewSummaryProps) {
  if (!summary || summary.trim() === "") {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Summary
      </h3>
      <div className="rounded-lg border border-zinc-200 bg-white p-3 sm:p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-xs sm:text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
          {summary}
        </p>
      </div>
    </div>
  );
}
