"use client";

import { useState } from "react";

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactNode;
};

export function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2 rounded-lg bg-white px-3 py-2.5 text-xs text-zinc-900 shadow-lg border border-zinc-200 dark:bg-white dark:text-zinc-900 dark:border-zinc-300">
          {content}
          <div className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-1/2 border-4 border-transparent border-t-white dark:border-t-white" />
        </div>
      )}
    </span>
  );
}
