"use client";

import { useEffect, useState, startTransition, useRef } from "react";
import type { Pull, PullsResponse } from "@/lib/types";

interface PRSelectorProps {
  owner: string;
  repo: string;
  accessToken: string;
  value?: string;
  onChange?: (prNumber: string) => void;
}

export function PRSelector({
  owner,
  repo,
  accessToken,
  value = "",
  onChange,
}: PRSelectorProps) {
  const [pulls, setPulls] = useState<Pull[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    startTransition(() => {
      setLoading(true);
      setError(null);
    });
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

    // #region agent log
    const fetchUrl = `${backendUrl}/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=open`;
    console.log('[DEBUG] Fetch PRs - before fetch', {backendUrl,owner,repo,hasAccessToken:!!accessToken,url:fetchUrl});
    // #endregion

    fetch(
      fetchUrl,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    )
      .then(async (res: Response) => {
        // #region agent log
        console.log('[DEBUG] Fetch PRs - response received', {status:res.status,ok:res.ok,statusText:res.statusText,headers:Object.fromEntries(res.headers.entries())});
        // #endregion
        if (cancelled) return null;
        if (!res.ok) {
          // #region agent log
          let errorBody = '';
          try {
            errorBody = await res.clone().text();
          } catch {}
          console.error('[DEBUG] Fetch PRs - response not ok', {status:res.status,statusText:res.statusText,errorBody:errorBody.substring(0,500)});
          // #endregion
          return null;
        }
        // #region agent log
        console.log('[DEBUG] Fetch PRs - before JSON parse');
        // #endregion
        return res.json() as Promise<PullsResponse>;
      })
      .then((data: PullsResponse | null) => {
        // #region agent log
        console.log('[DEBUG] Fetch PRs - after JSON parse', {hasData:!!data,dataType:data?typeof data:'null',pullsCount:data?.pulls?.length??null});
        // #endregion
        if (cancelled) return;
        if (data) {
          setPulls(data.pulls);
        } else {
          setError("Failed to load pull requests.");
        }
      })
      .catch((err: unknown) => {
        // #region agent log
        const errMsg = err instanceof Error ? err.message : String(err);
        const errStack = err instanceof Error ? err.stack : undefined;
        console.error('[DEBUG] Fetch PRs - catch block', {errorMessage:errMsg,errorStack:errStack?.substring(0,500),errorType:err?.constructor?.name});
        // #endregion
        if (!cancelled) {
          setError("Failed to load pull requests.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [owner, repo, accessToken]);

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Pull Request
        </label>
        <div className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          Loading pull requests...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex w-full flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Pull Request
        </label>
        <p className="text-sm text-amber-600 dark:text-amber-500">{error}</p>
      </div>
    );
  }

  if (!pulls || pulls.length === 0) {
    return (
      <div className="flex w-full flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Pull Request
        </label>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No open pull requests in this repository.
        </p>
      </div>
    );
  }

  return (
    <CustomPRDropdown
      pulls={pulls}
      value={value}
      onChange={onChange}
    />
  );
}

function CustomPRDropdown({
  pulls,
  value = "",
  onChange,
}: {
  pulls: Pull[];
  value?: string;
  onChange?: (prNumber: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedPull = pulls.find((pull: Pull) => pull.number.toString() === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.children;
      if (items[highlightedIndex]) {
        (items[highlightedIndex] as HTMLElement).scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (pull: Pull) => {
    onChange?.(pull.number.toString());
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightedIndex((prev) =>
          prev < pulls.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        event.preventDefault();
        const pull = highlightedIndex >= 0 ? pulls[highlightedIndex] : undefined;
        if (pull !== undefined) {
          handleSelect(pull);
        }
        break;
      case "Escape":
        event.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <label
        htmlFor="pr-select"
        className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        Pull Request
      </label>
      <div ref={containerRef} className="relative">
        <button
          id="pr-select"
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label="Select a pull request"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-left text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
        >
          {selectedPull ? (
            <span>
              #{selectedPull.number} {selectedPull.title}
            </span>
          ) : (
            <span className="text-zinc-500 dark:text-zinc-400">
              Select a pull request
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
            <div className="border-b border-zinc-200 px-4 py-2 dark:border-zinc-700">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Select a pull request
              </h3>
            </div>
            <div
              ref={listRef}
              role="listbox"
              className="max-h-64 overflow-y-auto"
            >
              {pulls.map((pull: Pull, index: number) => {
                const isSelected = pull.number.toString() === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <button
                    key={pull.number}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(pull)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                      isHighlighted
                        ? "bg-zinc-200 dark:bg-zinc-700"
                        : "bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-700/50"
                    } ${isSelected ? "font-medium text-zinc-900 dark:text-zinc-100" : "text-zinc-700 dark:text-zinc-300"}`}
                  >
                    <span className="flex items-center gap-2">
                      {isSelected && (
                        <span className="text-green-600 dark:text-green-400">
                          ✔
                        </span>
                      )}
                      <span>
                        #{pull.number} {pull.title}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
