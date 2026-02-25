"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export function GitHubCallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const githubStatus = searchParams.get("github");
    if (githubStatus === "connected") {
      // Remove the query parameter and refresh to get fresh data from server
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
      // Force a refresh of the server components
      router.refresh();
    } else if (githubStatus === "error") {
      const message = searchParams.get("message");
      console.error("GitHub connection error:", message);
      // Remove the query parameter
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [searchParams, router]);

  return null;
}
