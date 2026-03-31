"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const GITHUB_ERROR_MESSAGES: Record<string, string> = {
  missing_code_or_state: "GitHub sign-in was cancelled or incomplete. Try connecting again.",
  config_error: "GitHub connection is not configured. Contact support.",
  invalid_state: "Your session expired. Sign out and try connecting GitHub again.",
  exchange_failed:
    "We could not finish connecting GitHub. Please try again or check server logs.",
};

export function GitHubCallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  useEffect(() => {
    const githubStatus = searchParams.get("github");
    if (githubStatus === "connected") {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
      router.refresh();
    } else if (githubStatus === "error") {
      const message = searchParams.get("message") ?? "";
      const text =
        GITHUB_ERROR_MESSAGES[message] ??
        "GitHub connection failed. Please try again.";
      queueMicrotask(() => setErrorBanner(text));
      console.error("GitHub connection error:", message);
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [searchParams, router]);

  if (!errorBanner) return null;

  return (
    <div
      className="fixed right-4 top-20 z-50 max-w-md rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-lg dark:border-amber-800 dark:bg-amber-950/90 dark:text-amber-100"
      role="alert"
    >
      <div className="flex items-start justify-between gap-3">
        <p>{errorBanner}</p>
        <button
          type="button"
          onClick={() => setErrorBanner(null)}
          className="shrink-0 rounded px-1 text-lg leading-none opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
