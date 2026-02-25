"use client";

import { useState } from "react";

type UpgradeToProButtonProps = {
  accessToken: string;
};

export function UpgradeToProButton({ accessToken }: UpgradeToProButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (isLoading) return;

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const successUrl = `${origin}/billing/success`;
    const cancelUrl = `${origin}/billing/cancel`;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${backendUrl}/billing/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          success_url: successUrl,
          cancel_url: cancelUrl,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(errBody || `Checkout failed (${res.status})`);
      }

      const data = (await res.json()) as { url: string };
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-70 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isLoading ? "Redirecting..." : "Upgrade to Pro"}
      </button>
      {error && (
        <p className="text-sm text-amber-600 dark:text-amber-500">{error}</p>
      )}
    </div>
  );
}
