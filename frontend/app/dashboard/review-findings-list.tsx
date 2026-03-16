"use client";

import { useState } from "react";
import type { Finding, DiffContext, AffectedLocation } from "@/lib/types";
import { GenerateIssueModal } from "./generate-issue-modal";

const DEFAULT_VISIBLE_FINDINGS = 5;

const MAX_SNIPPET_LINES = 12;

function DiffContextPreview({ diffContext, file, line }: { diffContext: DiffContext; file?: string; line?: number }) {
  const [expanded, setExpanded] = useState(false);

  // Raw lines from diff context
  let beforeLines = diffContext.diff_context_before ? diffContext.diff_context_before.split("\n") : [];
  const snippetLine = diffContext.snippet || "";
  let afterLines = diffContext.diff_context_after ? diffContext.diff_context_after.split("\n") : [];

  // Clamp to ~12 lines, keeping target centered
  const total = beforeLines.length + 1 + afterLines.length;
  if (total > MAX_SNIPPET_LINES) {
    const maxPerSide = Math.floor((MAX_SNIPPET_LINES - 1) / 2);
    beforeLines = beforeLines.slice(-maxPerSide);
    afterLines = afterLines.slice(0, maxPerSide);
  }

  const startLine = diffContext.start_line ?? (line !== undefined ? line - beforeLines.length : 1);
  const targetLineIndex = beforeLines.length;

  const allLines: string[] = [...beforeLines, snippetLine, ...afterLines];

  const shortFileName = file ? file.split("/").pop() ?? file : null;
  const fileLabel = shortFileName && line !== undefined ? `${shortFileName}:${line}` : shortFileName ?? file ?? "";
  const hasFullPath = file && file.includes("/");

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <svg
          className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
        <span>View code context</span>
        {fileLabel && (
          <span className="font-mono text-zinc-400 dark:text-zinc-500 ml-auto">
            {fileLabel}
          </span>
        )}
      </button>
      {expanded && (
        <div className="bg-zinc-900 dark:bg-zinc-950 overflow-hidden">
          {file && (
            <div className="flex flex-col gap-0.5 px-3 py-2 border-b border-zinc-700 bg-zinc-800/50">
              <div className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-mono text-xs font-medium text-zinc-300">
                  {fileLabel}
                </span>
              </div>
              {hasFullPath && (
                <span className="font-mono text-[11px] text-zinc-500 pl-5.5">
                  {file}
                </span>
              )}
            </div>
          )}
          <div className="text-[11px] text-zinc-500 px-3 py-1.5">
            Relevant code near the detected issue
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <tbody className="font-mono text-xs leading-5">
                {allLines.map((codeLine, idx) => {
                  const lineNumber = startLine + idx;
                  const isTargetLine = idx === targetLineIndex;
                  return (
                    <tr
                      key={idx}
                      className={isTargetLine ? "bg-amber-900/30 border-l-2 border-amber-400" : ""}
                    >
                      <td className={`sticky left-0 w-6 px-1 py-0.5 text-center text-zinc-500 dark:text-zinc-600 select-none border-r border-zinc-700 ${isTargetLine ? "bg-amber-900/30" : "bg-zinc-900 dark:bg-zinc-950"}`}>
                        {isTargetLine ? (
                          <span className="text-amber-400 font-semibold">&gt;</span>
                        ) : null}
                      </td>
                      <td className={`w-10 px-2 py-0.5 text-right text-zinc-500 dark:text-zinc-600 select-none border-r border-zinc-700 ${isTargetLine ? "bg-amber-900/30" : "bg-zinc-900 dark:bg-zinc-950"}`}>
                        <span className={isTargetLine ? "text-amber-400 font-semibold" : ""}>
                          {lineNumber}
                        </span>
                      </td>
                      <td className={`px-3 py-0.5 whitespace-pre ${isTargetLine ? "bg-amber-900/30 text-amber-100" : "text-zinc-100"}`}>
                        {codeLine || "\u00A0"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function AffectedLocationsExpander({ locations }: { locations: { file: string; line?: number }[] }) {
  const [expanded, setExpanded] = useState(false);

  if (locations.length <= 1) return null;

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <svg
          className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
        <span>{locations.length} affected locations</span>
      </button>
      {expanded && (
        <div className="px-3 py-2 flex flex-col gap-1">
          {locations.map((loc: AffectedLocation, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 font-mono">
              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="break-all">{loc.file}{loc.line !== undefined ? `:${loc.line}` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ReviewFindingsListProps {
  findings: Finding[];
  accessToken: string;
}

// ── Similarity & deduplication ──

const TITLE_SIMILARITY_THRESHOLD = 0.7;
const SEVERITY_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function textSimilarity(textA: string, textB: string): number {
  const a = textA.toLowerCase();
  const b = textB.toLowerCase();
  if (a === b) return 1;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length >= b.length ? a : b;
  if (longer.includes(shorter) && shorter.length > 20) return 0.9;
  const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 3));
  const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = [...wordsA].filter((w) => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.length / union.size;
}

function mergeSimilarFindings(findings: Finding[]): Finding[] {
  const withLocation: Finding[] = [];
  const withoutLocation: Finding[] = [];
  for (const f of findings) {
    const file = f.file?.trim();
    const line = f.line;
    if (!file || line === undefined) {
      withoutLocation.push(f);
      continue;
    }
    withLocation.push(f);
  }

  const merged: Finding[] = [];
  const used = new Set<number>();

  for (let i = 0; i < withLocation.length; i++) {
    if (used.has(i)) continue;
    const primary = withLocation[i]!;
    const group: Finding[] = [primary];

    for (let j = i + 1; j < withLocation.length; j++) {
      if (used.has(j)) continue;
      const other = withLocation[j];
      if (!other) continue;
      if (
        (primary.file?.trim() ?? "") !== (other.file?.trim() ?? "") ||
        primary.line !== other.line
      ) {
        continue;
      }
      if (textSimilarity(primary.title, other.title) >= TITLE_SIMILARITY_THRESHOLD) {
        group.push(other);
        used.add(j);
      }
    }

    if (group.length === 1) {
      merged.push(primary);
    } else {
      group.sort(
        (a, b) => (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0),
      );
      const best = group[0]!;
      const agents = new Set<string>();
      const categories = new Set<string>();
      for (const f of group) {
        if (f.agent_name)
          f.agent_name.split(", ").forEach((a: string) => agents.add(a.trim()));
        if (f.merged_agents) f.merged_agents.forEach((a: string) => agents.add(a));
        if (f.category) categories.add(f.category);
        if (f.merged_categories) f.merged_categories.forEach((c: string) => categories.add(c));
      }
      merged.push({
        ...best,
        message: group.reduce(
          (acc, f) => ((f.message?.length ?? 0) > (acc.length ?? 0) ? (f.message ?? "") : acc),
          best.message ?? "",
        ),
        impact: group.reduce(
          (acc, f) => ((f.impact?.length ?? 0) > (acc.length ?? 0) ? (f.impact ?? "") : acc),
          best.impact ?? "",
        ),
        suggested_fix: group.reduce(
          (acc, f) =>
            ((f.suggested_fix?.length ?? 0) > (acc.length ?? 0) ? (f.suggested_fix ?? "") : acc),
          best.suggested_fix ?? "",
        ),
        merged_agents: agents.size > 0 ? [...agents] : undefined,
        merged_categories: categories.size > 1 ? [...categories] : undefined,
        consensus_level: agents.size > 1 ? "multi-agent" : best.consensus_level,
      });
    }
  }

  return [...merged, ...withoutLocation];
}

// ── Hierarchical grouping (FILE → LINE → FINDINGS) ──

type FileGroup = {
  file: string;
  totalCount: number;
  lineGroups: { line: number; findings: Finding[] }[];
};

function groupByFileThenLine(findings: Finding[]): FileGroup[] {
  const fileMap = new Map<string, Map<number, Finding[]>>();

  for (const f of findings) {
    const file = f.file?.trim();
    const line = f.line;
    if (!file || line === undefined) continue;

    let lineMap = fileMap.get(file);
    if (!lineMap) {
      lineMap = new Map<number, Finding[]>();
      fileMap.set(file, lineMap);
    }
    const list = lineMap.get(line) ?? [];
    list.push(f);
    lineMap.set(line, list);
  }

  const groups: FileGroup[] = [];
  for (const [file, lineMap] of fileMap) {
    const lineGroups: { line: number; findings: Finding[] }[] = [];
    let totalCount = 0;
    const lines = [...lineMap.keys()].sort((a, b) => a - b);
    for (const line of lines) {
      const findingsAtLine = lineMap.get(line) ?? [];
      const sorted = [...findingsAtLine].sort(
        (a, b) => (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0),
      );
      lineGroups.push({ line, findings: sorted });
      totalCount += findingsAtLine.length;
    }
    groups.push({ file, totalCount, lineGroups });
  }

  groups.sort((a, b) => {
    const maxSevA = Math.max(
      ...a.lineGroups.flatMap((lg) => lg.findings.map((f) => SEVERITY_ORDER[f.severity] ?? 0)),
      0,
    );
    const maxSevB = Math.max(
      ...b.lineGroups.flatMap((lg) => lg.findings.map((f) => SEVERITY_ORDER[f.severity] ?? 0)),
      0,
    );
    if (maxSevB !== maxSevA) return maxSevB - maxSevA;
    return a.file.localeCompare(b.file);
  });

  return groups;
}

// ── Systemic: standalone items (flat list for architectural/cross-cutting issues) ──

type StandaloneItem = { type: "standalone"; finding: Finding };

function getSystemicStandaloneItems(findings: Finding[]): StandaloneItem[] {
  return findings.map((f) => ({ type: "standalone" as const, finding: f }));
}

function getSeverityStyles(severity: Finding["severity"]): {
  badge: string;
  border: string;
  accent: string;
  bg: string;
} {
  switch (severity) {
    case "critical":
      return {
        badge: "bg-red-600 text-white dark:bg-red-500",
        border: "border-l-red-600 dark:border-l-red-500",
        accent: "text-red-600 dark:text-red-400",
        bg: "bg-red-50/50 dark:bg-red-950/20",
      };
    case "high":
      return {
        badge: "bg-orange-600 text-white dark:bg-orange-500",
        border: "border-l-orange-600 dark:border-l-orange-500",
        accent: "text-orange-600 dark:text-orange-400",
        bg: "bg-orange-50/50 dark:bg-orange-950/20",
      };
    case "medium":
      return {
        badge: "bg-yellow-500 text-white dark:bg-yellow-400",
        border: "border-l-yellow-500 dark:border-l-yellow-400",
        accent: "text-yellow-600 dark:text-yellow-500",
        bg: "bg-yellow-50/50 dark:bg-yellow-950/20",
      };
    case "low":
      return {
        badge: "bg-blue-600 text-white dark:bg-blue-500",
        border: "border-l-blue-600 dark:border-l-blue-500",
        accent: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-50/50 dark:bg-blue-950/20",
      };
    default:
      return {
        badge: "bg-zinc-600 text-white dark:bg-zinc-500",
        border: "border-l-zinc-600 dark:border-l-zinc-500",
        accent: "text-zinc-600 dark:text-zinc-400",
        bg: "bg-zinc-50/50 dark:bg-zinc-950/20",
      };
  }
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "bg-green-500";
  if (confidence >= 0.6) return "bg-yellow-500";
  return "bg-orange-500";
}

function getFPRiskStyle(risk: string): { bg: string; text: string } {
  switch (risk) {
    case "low":
      return { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400" };
    case "medium":
      return { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400" };
    case "high":
      return { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400" };
    default:
      return { bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-600 dark:text-zinc-400" };
  }
}

function MultiAgentBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Multi-agent confirmed
    </span>
  );
}

function FindingSubCard({ finding, accessToken }: { finding: Finding; accessToken: string }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const severityStyles = getSeverityStyles(finding.severity);
  const hasAIMetadata =
    finding.agent_name || finding.confidence !== undefined || finding.reasoning_trace;
  const isMultiAgent = finding.consensus_level === "multi-agent";

  return (
    <div
      className={`rounded-md border border-zinc-200 dark:border-zinc-700 border-l-4 px-4 py-3 bg-white dark:bg-zinc-900 ${severityStyles.border}`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2">
          <div className={`shrink-0 w-1 h-5 rounded-full ${severityStyles.bg} mt-0.5`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h5 className="flex-1 min-w-0 font-medium text-sm text-zinc-900 dark:text-zinc-100 wrap-break-word pr-2">
                {finding.title}
              </h5>
              <span
                className={`rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap shrink-0 ${severityStyles.badge}`}
              >
                {finding.severity.toUpperCase()}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              {finding.category && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {finding.category}
                </span>
              )}
              {isMultiAgent && <MultiAgentBadge />}
            </div>
          </div>
        </div>

        <div className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed wrap-break-word">
          {finding.message}
        </div>

        {finding.impact && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 shrink-0">
              Impact:
            </span>
            <span className="text-xs text-amber-700 dark:text-amber-400">
              {finding.impact}
            </span>
          </div>
        )}

        {(finding.suggested_fix || finding.suggestion) && (
          <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
            <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-0.5">
              Suggested Fix
            </div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed wrap-break-word">
              {finding.suggested_fix || finding.suggestion}
            </div>
          </div>
        )}

        <div className="flex items-center pt-2 border-t border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => setIssueModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Generate issue
          </button>
        </div>
        <GenerateIssueModal
          finding={finding}
          accessToken={accessToken}
          open={issueModalOpen}
          onClose={() => setIssueModalOpen(false)}
        />

        {finding.outside_diff && (
          <div className="flex items-center gap-1.5 rounded-md border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-600 dark:text-zinc-400">
            References code outside the diff — lower confidence
          </div>
        )}

        {(hasAIMetadata || finding.false_positive_risk) && (
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {finding.agent_name && (
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500 dark:text-zinc-400">Agent:</span>
                  {finding.merged_agents ? (
                    finding.merged_agents.map((agent: string) => (
                      <span
                        key={agent}
                        className="rounded px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 font-medium"
                      >
                        {agent}
                      </span>
                    ))
                  ) : (
                    <span className="rounded px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 font-medium">
                      {finding.agent_name}
                    </span>
                  )}
                </div>
              )}
              {finding.confidence !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500 dark:text-zinc-400">Confidence:</span>
                  <div className="w-10 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden inline-block">
                    <div
                      className={`h-full ${getConfidenceColor(finding.confidence)}`}
                      style={{ width: `${finding.confidence * 100}%` }}
                    />
                  </div>
                  <span className="font-mono">{(finding.confidence * 100).toFixed(0)}%</span>
                </div>
              )}
              {finding.false_positive_risk && (
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500 dark:text-zinc-400">FP risk:</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-semibold ${getFPRiskStyle(finding.false_positive_risk).bg} ${getFPRiskStyle(finding.false_positive_risk).text}`}
                  >
                    {finding.false_positive_risk}
                  </span>
                </div>
              )}
            </div>
            {finding.reasoning_trace && (
              <div className="mt-1.5">
                <button
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  {showReasoning ? "Hide reasoning" : "Show reasoning"}
                </button>
                {showReasoning && (
                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 italic wrap-break-word">
                    {finding.reasoning_trace}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FileBlock({
  fileGroup,
  accessToken,
}: {
  fileGroup: FileGroup;
  accessToken: string;
}) {
  const { file, totalCount, lineGroups } = fileGroup;
  const shortFileName = file.split("/").pop() ?? file;
  const hasFullPath = file.includes("/");

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      {/* File header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <svg
              className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span className="font-mono text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {shortFileName}
            </span>
          </div>
          {hasFullPath && (
            <span className="font-mono text-xs text-zinc-500 dark:text-zinc-500 pl-6">
              {file}
            </span>
          )}
          <p className="text-xs text-zinc-600 dark:text-zinc-400 pl-6">
            {totalCount} {totalCount === 1 ? "issue" : "issues"} detected
          </p>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-5">
        {lineGroups.map(({ line, findings }) => {
          const sharedDiffContext = findings.find((f) => f.diff_context)?.diff_context;
          return (
            <div key={line} className="flex flex-col gap-4 pl-3 border-l-2 border-zinc-200 dark:border-zinc-700">
              {/* Line section header */}
              <h5 className="text-xs font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Line {line}
              </h5>
              {sharedDiffContext && (
                <div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-500 mb-1.5">
                    Code context
                  </div>
                  <DiffContextPreview
                    diffContext={sharedDiffContext}
                    file={file}
                    line={line}
                  />
                </div>
              )}
              <div className="flex flex-col gap-4">
                {findings.map((finding) => (
                  <FindingSubCard
                    key={finding.id}
                    finding={finding}
                    accessToken={accessToken}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FindingCard({ finding, accessToken }: { finding: Finding; accessToken: string }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const severityStyles = getSeverityStyles(finding.severity);
  const hasAIMetadata =
    finding.agent_name || finding.confidence !== undefined || finding.reasoning_trace;
  const isMultiAgent = finding.consensus_level === "multi-agent";

  return (
    <div
      className={`rounded-lg border border-zinc-200 dark:border-zinc-800 ${severityStyles.border} border-l-4 bg-white dark:bg-zinc-900 shadow-sm`}
    >
      <div className="p-4">
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-start gap-2">
            <div className={`shrink-0 w-1 h-6 rounded-full ${severityStyles.bg} mt-0.5`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="flex-1 min-w-0 font-semibold text-sm text-zinc-900 dark:text-zinc-100 wrap-break-word pr-2">
                  {finding.title}
                </h4>
                <span
                  className={`rounded px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 ${severityStyles.badge}`}
                >
                  {finding.severity.toUpperCase()}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {finding.category && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {finding.category}
                  </span>
                )}
                {isMultiAgent && <MultiAgentBadge />}
              </div>
            </div>
          </div>

          {/* Affected locations */}
          {finding.affected_locations && finding.affected_locations.length > 1 ? (
            <AffectedLocationsExpander locations={finding.affected_locations} />
          ) : (finding.file || finding.line !== undefined) && (
            <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <svg
                className="h-3.5 w-3.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span className="font-mono break-all">
                {finding.file}
                {finding.line !== undefined && `:${finding.line}`}
              </span>
            </div>
          )}

          {/* Message */}
          <div className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed wrap-break-word">
            {finding.message}
          </div>

          {/* Impact */}
          {finding.impact && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
              <svg
                className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  Impact:
                </span>{" "}
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  {finding.impact}
                </span>
              </div>
            </div>
          )}

          {/* Suggested Fix */}
          {(finding.suggested_fix || finding.suggestion) && (
            <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 p-3">
              <div className="flex items-start gap-2">
                <svg
                  className="h-4 w-4 shrink-0 mt-0.5 text-zinc-500 dark:text-zinc-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Suggested Fix
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed wrap-break-word">
                    {finding.suggested_fix || finding.suggestion}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Inline Diff Context */}
          {finding.diff_context && (
            <DiffContextPreview
              diffContext={finding.diff_context}
              file={finding.file}
              line={finding.line}
            />
          )}

          {/* Actions */}
          <div className="flex items-center pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setIssueModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Generate issue
            </button>
          </div>
          <GenerateIssueModal
            finding={finding}
            accessToken={accessToken}
            open={issueModalOpen}
            onClose={() => setIssueModalOpen(false)}
          />

          {/* Outside diff warning */}
          {finding.outside_diff && (
            <div className="flex items-center gap-1.5 rounded-md border border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1.5">
              <svg
                className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                References code outside the diff — lower confidence
              </span>
            </div>
          )}

          {/* False Positive Risk + AI Metadata */}
          {(hasAIMetadata || finding.false_positive_risk) && (
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                  {finding.agent_name && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-500 dark:text-zinc-400">Agent:</span>
                      {finding.merged_agents ? (
                        finding.merged_agents.map((agent: string) => (
                          <span
                            key={agent}
                            className="rounded px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 font-medium"
                          >
                            {agent}
                          </span>
                        ))
                      ) : (
                        <span className="rounded px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 font-medium">
                          {finding.agent_name}
                        </span>
                      )}
                    </div>
                  )}
                  {finding.confidence !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-500 dark:text-zinc-400">Confidence:</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getConfidenceColor(finding.confidence)}`}
                            style={{ width: `${finding.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-zinc-600 dark:text-zinc-400 font-mono">
                          {(finding.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )}
                  {finding.false_positive_risk && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-500 dark:text-zinc-400">FP risk:</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${getFPRiskStyle(finding.false_positive_risk).bg} ${getFPRiskStyle(finding.false_positive_risk).text}`}>
                        {finding.false_positive_risk}
                      </span>
                    </div>
                  )}
                </div>
                {finding.reasoning_trace && (
                  <div>
                    <button
                      onClick={() => setShowReasoning(!showReasoning)}
                      className="flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                    >
                      <svg
                        className={`h-3 w-3 transition-transform ${
                          showReasoning ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                      {showReasoning ? "Hide reasoning" : "Show reasoning"}
                    </button>
                    {showReasoning && (
                      <div className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400 italic wrap-break-word">
                        {finding.reasoning_trace}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function classifyFinding(finding: Finding): "systemic" | "code-level" {
  const systemicCategories = ["architecture"];
  if (systemicCategories.includes(finding.category)) return "systemic";
  if (finding.categories && finding.categories.length > 1) return "systemic";
  if (finding.affected_locations && finding.affected_locations.length > 2) return "systemic";
  return "code-level";
}

function deduplicateIds(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.map((f: Finding, i: number) => {
    if (seen.has(f.id)) {
      return { ...f, id: `${f.id}-${i}` };
    }
    seen.add(f.id);
    return f;
  });
}

export function ReviewFindingsList({ findings, accessToken }: ReviewFindingsListProps) {
  const [showAll, setShowAll] = useState(false);

  if (findings.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
        No findings reported.
      </div>
    );
  }

  const uniqueFindings = deduplicateIds(findings);
  const mergedFindings = mergeSimilarFindings(uniqueFindings);

  const systemic = mergedFindings.filter((f: Finding) => classifyFinding(f) === "systemic");
  const codeLevelAll = mergedFindings.filter((f: Finding) => classifyFinding(f) === "code-level");

  const codeLevelWithLocation = codeLevelAll.filter(
    (f) => f.file?.trim() && f.line !== undefined,
  );
  const codeLevelStandalone = codeLevelAll.filter(
    (f) => !f.file?.trim() || f.line === undefined,
  );

  const systemicItems = getSystemicStandaloneItems(systemic);
  const codeLevelFileGroups = groupByFileThenLine(codeLevelWithLocation);

  const visibleFileGroups = showAll
    ? codeLevelFileGroups
    : codeLevelFileGroups.slice(0, DEFAULT_VISIBLE_FINDINGS);
  const hiddenCount = codeLevelFileGroups.length - visibleFileGroups.length;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Findings
        </h3>
        <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {mergedFindings.length} {mergedFindings.length === 1 ? "finding" : "findings"}
        </span>
      </div>

      {/* Systemic issues: standalone cards */}
      {systemicItems.length > 0 && (
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Systemic Issues
          </h4>
          {systemicItems.map((item) => (
            <FindingCard
              key={item.finding.id}
              finding={item.finding}
              accessToken={accessToken}
            />
          ))}
        </div>
      )}

      {/* Code-level: hierarchical FILE → LINE → FINDINGS + standalone */}
      <div className="flex flex-col gap-3">
        {(codeLevelFileGroups.length > 0 || codeLevelStandalone.length > 0) && (
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Code-Level Issues
            </h4>
          )}
        {codeLevelStandalone.map((finding) => (
          <FindingCard
            key={finding.id}
            finding={finding}
            accessToken={accessToken}
          />
        ))}
        {visibleFileGroups.map((fileGroup) => (
          <FileBlock
            key={fileGroup.file}
            fileGroup={fileGroup}
            accessToken={accessToken}
          />
        ))}
      </div>

      {/* "+ X more" expandable */}
      {hiddenCount > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mx-auto flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          + {hiddenCount} more file{hiddenCount === 1 ? "" : "s"}
        </button>
      )}

      {showAll && codeLevelFileGroups.length > DEFAULT_VISIBLE_FINDINGS && (
        <button
          onClick={() => setShowAll(false)}
          className="mx-auto flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
        >
          <svg className="h-4 w-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Show fewer
        </button>
      )}
    </div>
  );
}
