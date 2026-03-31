"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { Finding } from "@/lib/types";

type ModalState = "loading" | "success" | "error";

interface PRMeta {
  repo_full_name: string;
  pr_number: number;
  pr_title: string;
}

function getSeverityBadgeClass(severity: Finding["severity"]): string {
  switch (severity) {
    case "critical":
      return "bg-red-600 text-white dark:bg-red-500";
    case "high":
      return "bg-orange-600 text-white dark:bg-orange-500";
    case "medium":
      return "bg-yellow-500 text-white dark:bg-yellow-400";
    case "low":
      return "bg-zinc-500 text-white dark:bg-zinc-400 dark:text-zinc-900";
    default:
      return "bg-zinc-600 text-white dark:bg-zinc-500";
  }
}

const markdownComponents: Components = {
  // Custom rendering for task lists (checkboxes) - remarkGfm creates these
  input: ({ ...props }) => {
    const { checked } = props as { checked?: boolean };
    return (
      <input
        type="checkbox"
        checked={checked ?? false}
        readOnly
        disabled
        className="mr-2.5 mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 cursor-default"
        style={{ accentColor: "rgb(39 39 42)" }}
      />
    );
  },
  // Headings with proper hierarchy and spacing
  h2: ({ children, ...props }) => (
    <h2 className="!mt-8 !mb-4 !text-lg !font-semibold !text-zinc-900 dark:!text-zinc-100 !border-b !border-zinc-200 dark:!border-zinc-700 !pb-2 first:!mt-0" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="!mt-6 !mb-3 !text-base !font-semibold !text-zinc-900 dark:!text-zinc-100" {...props}>
      {children}
    </h3>
  ),
  // Paragraphs with proper spacing
  p: ({ children, ...props }) => (
    <p className="!my-3 !text-sm !text-zinc-700 dark:!text-zinc-300 !leading-relaxed !break-words" {...props}>
      {children}
    </p>
  ),
  // List items - handle both regular and task lists
  li: ({ node, children, ...props }) => {
    // Check if this is a task list item by looking at the first child
    type MdNode = { children?: Array<{ type?: string; children?: Array<{ type?: string }> }> };
    const firstChild = (node as MdNode)?.children?.[0];
    const isTaskItem =
      firstChild?.type === "input" ||
      (firstChild?.type === "paragraph" &&
        firstChild?.children?.[0]?.type === "input");
    
    return (
      <li className={`!my-1.5 !text-sm !text-zinc-700 dark:!text-zinc-300 !leading-relaxed !break-words ${isTaskItem ? "!flex !items-start" : ""}`} {...props}>
        {children}
      </li>
    );
  },
  // Unordered lists - CSS handles task list styling, but we ensure proper spacing
  ul: ({ children, ...props }) => {
    return (
      <ul className="!my-3 !space-y-1.5 !list-disc !pl-5" {...props}>
        {children}
      </ul>
    );
  },
  // Ordered lists
  ol: ({ children, ...props }) => (
    <ol className="!my-3 !space-y-1.5 !list-decimal !pl-5" {...props}>
      {children}
    </ol>
  ),
  // Inline code (react-markdown passes inline via ExtraProps)
  code: ({ children, ...props }) => {
    const inline = "inline" in props && Boolean((props as { inline?: boolean }).inline);
    if (inline) {
      return (
        <code className="!text-xs !bg-zinc-100 dark:!bg-zinc-800 !text-zinc-900 dark:!text-zinc-100 !px-1.5 !py-0.5 !rounded !font-mono !break-all" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="!text-xs !font-mono" {...props}>
        {children}
      </code>
    );
  },
  // Code blocks
  pre: ({ children, ...props }) => (
    <pre className="!my-4 !bg-zinc-900 dark:!bg-zinc-950 !border !border-zinc-700 !rounded-lg !p-4 !overflow-x-auto !text-xs" {...props}>
      {children}
    </pre>
  ),
  // Strong/bold text
  strong: ({ children, ...props }) => (
    <strong className="!font-semibold !text-zinc-900 dark:!text-zinc-100" {...props}>
      {children}
    </strong>
  ),
  // Blockquotes
  blockquote: ({ children, ...props }) => (
    <blockquote className="!my-3 !border-l-4 !border-zinc-300 dark:!border-zinc-600 !pl-4 !italic !text-zinc-700 dark:!text-zinc-300 !break-words" {...props}>
      {children}
    </blockquote>
  ),
  // Links
  a: ({ children, ...props }) => (
    <a className="!text-blue-600 dark:!text-blue-400 !no-underline hover:!underline !break-all" {...props}>
      {children}
    </a>
  ),
};

interface GenerateIssueModalProps {
  finding: Finding;
  prMetadata?: PRMeta;
  accessToken: string;
  open: boolean;
  onClose: () => void;
}

export function GenerateIssueModal({
  finding,
  prMetadata,
  accessToken,
  open,
  onClose,
}: GenerateIssueModalProps) {
  const [state, setState] = useState<ModalState>("loading");
  const [issueText, setIssueText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generate = useCallback(
    async (signal?: AbortSignal) => {
      setState("loading");
      setErrorMessage("");
      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
        const res = await fetch(`${backendUrl}/reviews/generate-issue`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            finding,
            pr_metadata: prMetadata,
          }),
          signal,
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
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to generate issue"
        );
        setState("error");
      }
    },
    [finding, prMetadata, accessToken]
  );

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    void generate(ac.signal);
    return () => {
      ac.abort();
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
  const severityBadgeClass = getSeverityBadgeClass(finding.severity);

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
              Generated Issue
            </h2>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className={`rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${severityBadgeClass}`}>
                {severityLabel}
              </span>
              <span className="text-zinc-300 dark:text-zinc-600">—</span>
              <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{finding.title}</span>
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
        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
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
                Generating issue...
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
                type="button"
                onClick={() => void generate()}
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
            <div className="flex-1 overflow-y-auto">
              <div className="prose prose-sm dark:prose-invert max-w-none [&_ul:has(li_input[type='checkbox'])]:list-none [&_ul:has(li_input[type='checkbox'])]:pl-0 [&_ul:has(li_input[type='checkbox'])_li]:flex [&_ul:has(li_input[type='checkbox'])_li]:items-start">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {issueText}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {state === "success" && (
          <div className="flex items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-700 px-5 py-3">
            <button
              type="button"
              onClick={() => void generate()}
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
                    Copy Issue
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
