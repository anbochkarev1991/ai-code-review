"use client";

import { createClient } from "@/lib/supabase/client";
import { useCallback, useState } from "react";

export function LoginButtons() {
  const supabase = createClient();
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = useCallback(
    async (provider: "google" | "azure") => {
      setOauthError(null);
      setIsLoading(true);
      try {
        const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard`;
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo },
        });

        if (error) {
          setOauthError(error.message || "Sign-in failed. Please try again.");
          console.error("OAuth error:", error);
          return;
        }

        if (data?.url) {
          if (process.env.NODE_ENV === "development") {
            try {
              const url = new URL(data.url);
              console.log(
                "Supabase OAuth redirect_uri:",
                url.searchParams.get("redirect_uri"),
              );
            } catch {
              /* ignore */
            }
          }
          window.location.href = data.url;
        } else {
          setOauthError("No OAuth URL returned. Try again or contact support.");
        }
      } catch (e: unknown) {
        setOauthError(
          e instanceof Error ? e.message : "Sign-in failed. Please try again.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [supabase]
  );

  return (
    <div className="flex flex-col gap-3 w-full max-w-xs">
      {oauthError ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
          role="alert"
        >
          {oauthError}
        </p>
      ) : null}
      <button
        type="button"
        disabled={isLoading}
        onClick={() => handleSignIn("google")}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-zinc-200 bg-white px-5 font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        <GoogleIcon className="h-5 w-5" />
        Sign in with Google
      </button>
      <button
        type="button"
        disabled={isLoading}
        onClick={() => handleSignIn("azure")}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-zinc-200 bg-white px-5 font-medium text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        <MicrosoftIcon className="h-5 w-5" />
        Sign in with Microsoft
      </button>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 23 23"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path fill="#f25022" d="M0 0h11v11H0z" />
      <path fill="#00a4ef" d="M12 0h11v11H12z" />
      <path fill="#7fba00" d="M0 12h11v11H0z" />
      <path fill="#ffb900" d="M12 12h11v11H12z" />
    </svg>
  );
}
