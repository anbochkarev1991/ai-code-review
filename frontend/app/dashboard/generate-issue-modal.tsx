"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Finding } from "@/lib/types";

type ModalState = "loading" | "success" | "error";

interface PRMeta {
  repo_full_name: string;
  pr_number: number;
  pr_title: string;
}

interface GenerateIssueModalProps {
  finding: Finding;
  prMetadata?: PRMeta;
  open: boolean;
  onClose: () => void;
}

export function GenerateIssueModal({
  finding,
  prMetadata,
  open,
  onClose,
}: GenerateIssueModalProps) {
  const [state, setState] = useState<ModalState>("loading");
  const [issueText, setIssueText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generate = useCallback(async () => {
    setState("loading");
    setErrorMessage("");
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
      const res = await fetch(`${backendUrl}/reviews/generate-issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          finding,
          pr_metadata: prMetadata,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message ?? `Request failed with status ${res.status}`
        );
      }
      const data = await res.json();
      setIssueText(data.issue_text);
      setState("success");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to generate issue"
      );
      setState("error");
    }
  }, [finding, prMetadata]);

  useEffect(() => {
    if (open) {
      generate();
    }
    return () => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    };
  }, [open, generate]);

  useEffect(() => {
    if (!open) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(issueText);
      setCopied(true);
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard API may be blocked */
    }
  };

  const severityLabel = finding.severity.toUpperCase();

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 dark:border-zinc-700 px-5 py-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Generated issue draft
            </h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-medium">{severityLabel}</span>
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
              <span className="truncate">{finding.title}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {state === "loading" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <svg
                className="h-8 w-8 animate-spin text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Generating issue draft...
              </p>
            </div>
          )}

          {state === "error" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-3">
                <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Failed to generate issue
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {errorMessage}
                </p>
              </div>
              <button
                onClick={generate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry
              </button>
            </div>
          )}

          {state === "success" && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700 font-sans">
                {issueText}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        {state === "success" && (
          <div className="flex items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-700 px-5 py-3">
            <button
              onClick={generate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Regenerate
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                {copied ? (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy to clipboard
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
