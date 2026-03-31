"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { UsageResponse } from "@/lib/types";

interface UsageContextValue {
  usage: UsageResponse | null;
  /** True when GET /billing/usage failed (distinct from missing initial data). */
  usageLoadFailed: boolean;
  /** Push authoritative usage data from a server response (e.g. POST /reviews) */
  pushUsage: (usage: UsageResponse) => void;
  /** Refetch usage from GET /billing/usage for reconciliation */
  refetchUsage: () => Promise<void>;
}

const UsageContext = createContext<UsageContextValue | null>(null);

interface UsageProviderProps {
  initialUsage: UsageResponse | null;
  initialUsageLoadFailed: boolean;
  accessToken: string;
  children: ReactNode;
}

export function UsageProvider({
  initialUsage,
  initialUsageLoadFailed,
  accessToken,
  children,
}: UsageProviderProps) {
  const [usage, setUsage] = useState<UsageResponse | null>(initialUsage);
  const [usageLoadFailed, setUsageLoadFailed] = useState(
    initialUsageLoadFailed,
  );
  const mountedRef = useRef(true);

  const pushUsage = useCallback((newUsage: UsageResponse) => {
    if (!mountedRef.current) return;
    console.debug("[UsageProvider] pushUsage", newUsage);
    setUsageLoadFailed(false);
    setUsage(newUsage);
  }, []);

  const refetchUsage = useCallback(async () => {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
    try {
      console.debug("[UsageProvider] refetching from server");
      const res = await fetch(`${backendUrl}/billing/usage`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      if (!res.ok) {
        if (mountedRef.current) setUsageLoadFailed(true);
        console.error("[UsageProvider] refetch non-OK:", res.status);
        return;
      }
      const contentType = res.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        if (mountedRef.current) setUsageLoadFailed(true);
        return;
      }
      const data: UsageResponse = await res.json();
      if (mountedRef.current) {
        console.debug("[UsageProvider] reconciled with server", data);
        setUsageLoadFailed(false);
        setUsage(data);
      }
    } catch (err: unknown) {
      console.error("[UsageProvider] refetch failed", err);
      if (mountedRef.current) setUsageLoadFailed(true);
    }
  }, [accessToken]);

  return (
    <UsageContext.Provider
      value={{ usage, usageLoadFailed, pushUsage, refetchUsage }}
    >
      {children}
    </UsageContext.Provider>
  );
}

export function useUsage(): UsageContextValue {
  const ctx = useContext(UsageContext);
  if (!ctx) {
    throw new Error("useUsage must be used within a UsageProvider");
  }
  return ctx;
}
