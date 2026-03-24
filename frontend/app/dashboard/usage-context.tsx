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
  /** Push authoritative usage data from a server response (e.g. POST /reviews) */
  pushUsage: (usage: UsageResponse) => void;
  /** Refetch usage from GET /billing/usage for reconciliation */
  refetchUsage: () => Promise<void>;
}

const UsageContext = createContext<UsageContextValue | null>(null);

interface UsageProviderProps {
  initialUsage: UsageResponse | null;
  accessToken: string;
  children: ReactNode;
}

export function UsageProvider({
  initialUsage,
  accessToken,
  children,
}: UsageProviderProps) {
  const [usage, setUsage] = useState<UsageResponse | null>(initialUsage);
  const [refetchError, setRefetchError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const pushUsage = useCallback((newUsage: UsageResponse) => {
    if (!mountedRef.current) return;
    console.debug("[UsageProvider] pushUsage", newUsage);
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
      if (!res.ok) return;
      const data: UsageResponse = await res.json();
      if (mountedRef.current) {
        console.debug("[UsageProvider] reconciled with server", data);
        setUsage(data);
        setRefetchError(null);
      }
    } catch (err: unknown) {
      console.error("[UsageProvider] refetch failed", err);
      if (mountedRef.current) {
        setRefetchError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }, [accessToken]);

  return (
    <UsageContext.Provider value={{ usage, pushUsage, refetchUsage }}>
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
