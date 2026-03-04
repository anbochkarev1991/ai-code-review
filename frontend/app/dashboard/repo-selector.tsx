"use client";

import { useState, useRef, useEffect } from "react";
import type { Repo } from "@/lib/types";

interface RepoSelectorProps {
  repos: Repo[];
  value?: string;
  onChange?: (fullName: string) => void;
}

export function RepoSelector({
  repos,
  value = "",
  onChange,
}: RepoSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedRepo = repos.find((repo) => repo.full_name === value);

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

  const handleSelect = (repo: Repo) => {
    onChange?.(repo.full_name);
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
          prev < repos.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        event.preventDefault();
        const repo = highlightedIndex >= 0 ? repos[highlightedIndex] : undefined;
        if (repo !== undefined) {
          handleSelect(repo);
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
        htmlFor="repo-select"
        className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        Repository
      </label>
      <div ref={containerRef} className="relative">
        <button
          id="repo-select"
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label="Select a repository"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-left text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
        >
          {selectedRepo ? (
            <span>
              {selectedRepo.full_name}
              {selectedRepo.private ? " (private)" : ""}
            </span>
          ) : (
            <span className="text-zinc-500 dark:text-zinc-400">
              Select a repository
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
            <div className="border-b border-zinc-200 px-4 py-2 dark:border-zinc-700">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Select a repository
              </h3>
            </div>
            <div
              ref={listRef}
              role="listbox"
              className="max-h-64 overflow-y-auto"
            >
              {repos.map((repo, index) => {
                const isSelected = repo.full_name === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <button
                    key={repo.full_name}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(repo)}
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
                        {repo.full_name}
                        {repo.private ? " (private)" : ""}
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
