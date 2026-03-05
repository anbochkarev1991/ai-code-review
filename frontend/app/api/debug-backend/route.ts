import { NextResponse } from "next/server";
import { ensureAbsoluteUrl } from "@/lib/url-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const backendUrl = ensureAbsoluteUrl(
    process.env.NEXT_PUBLIC_BACKEND_URL,
    "http://localhost:3001"
  );

  const results: Record<string, unknown> = {
    rawEnv: process.env.NEXT_PUBLIC_BACKEND_URL ?? "(not set)",
    resolvedUrl: backendUrl,
    healthCheck: null as { ok: boolean; status?: number; error?: string } | null,
  };

  try {
    const res = await fetch(`${backendUrl}/health`, { cache: "no-store" });
    results.healthCheck = {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
    };
    if (res.ok) {
      const json = await res.json();
      results.healthCheck = {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        body: json,
      };
    }
  } catch (err) {
    results.healthCheck = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return NextResponse.json(results);
}
