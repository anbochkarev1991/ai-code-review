"use client";

import { useState } from "react";
import type { Finding, DiffContext } from "@/lib/types";

const DEFAULT_VISIBLE_FINDINGS = 5;

function DiffContextPreview({ diffContext, file, line }: { diffContext: DiffContext; file?: string; line?: number }) {
  const [expanded, setExpanded] = useState(false);

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
        {file && (
          <span className="font-mono text-zinc-400 dark:text-zinc-500 ml-auto">
            {file}{line !== undefined ? `:${line}` : ""}
          </span>
        )}
      </button>
      {expanded && (
        <div className="bg-zinc-900 dark:bg-zinc-950 p-3 font-mono text-xs leading-5 overflow-x-auto">
          {diffContext.diff_context_before && (
            <div className="text-zinc-500">
              {diffContext.diff_context_before.split("\n").map((l, i) => (
                <div key={`before-${i}`}>{l || "\u00A0"}</div>
              ))}
            </div>
          )}
          <div className="text-amber-300 bg-amber-900/20 -mx-3 px-3">
            {diffContext.snippet || "\u00A0"}
          </div>
          {diffContext.diff_context_after && (
            <div className="text-zinc-500">
              {diffContext.diff_context_after.split("\n").map((l, i) => (
                <div key={`after-${i}`}>{l || "\u00A0"}</div>
              ))}
            </div>
          )}
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
          {locations.map((loc, i) => (
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

function FindingCard({ finding }: { finding: Finding }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const severityStyles = getSeverityStyles(finding.severity);
  const hasAIMetadata =
    finding.agent_name || finding.confidence !== undefined || finding.reasoning_trace;
  const isMultiAgent = finding.consensus_level === "multi-agent";

  const handleMarkResolved = () => {
    console.log("Mark as resolved:", finding.id);
  };

  const handleIgnore = () => {
    console.log("Ignore:", finding.id);
  };

  const handleCreateTicket = () => {
    console.log("Create ticket:", finding.id);
  };

  return (
    <div
      className={`rounded-lg border ${isMultiAgent ? "border-emerald-300 dark:border-emerald-800" : "border-zinc-200 dark:border-zinc-800"} ${severityStyles.border} border-l-4 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="p-4">
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="flex items-start gap-3 flex-1">
              <div className={`shrink-0 w-1 h-6 rounded-full ${severityStyles.bg} mt-0.5`} />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 wrap-break-word">
                  {finding.title}
                </h4>
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
            <span
              className={`rounded px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 ${severityStyles.badge}`}
            >
              {finding.severity.toUpperCase()}
            </span>
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
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <button
              onClick={handleMarkResolved}
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Mark as resolved
            </button>
            <button
              onClick={handleIgnore}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Ignore
            </button>
            <button
              onClick={handleCreateTicket}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
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
              Create ticket
            </button>
          </div>

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
                        finding.merged_agents.map((agent) => (
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

export function ReviewFindingsList({ findings }: ReviewFindingsListProps) {
  const [showAll, setShowAll] = useState(false);

  if (findings.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
        No findings reported.
      </div>
    );
  }

  const systemic = findings.filter((f) => classifyFinding(f) === "systemic");
  const codeLevelAll = findings.filter((f) => classifyFinding(f) === "code-level");

  const visibleCodeLevel = showAll
    ? codeLevelAll
    : codeLevelAll.slice(0, DEFAULT_VISIBLE_FINDINGS);
  const hiddenCount = codeLevelAll.length - visibleCodeLevel.length;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Findings
        </h3>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {findings.length} {findings.length === 1 ? "finding" : "findings"}
        </span>
      </div>

      {/* Systemic issues group */}
      {systemic.length > 0 && (
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Systemic Issues
          </h4>
          {systemic.map((finding) => (
            <FindingCard key={finding.id} finding={finding} />
          ))}
        </div>
      )}

      {/* Code-level issues group */}
      <div className="flex flex-col gap-3">
        {systemic.length > 0 && codeLevelAll.length > 0 && (
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Code-Level Issues
          </h4>
        )}
        {visibleCodeLevel.map((finding) => (
          <FindingCard key={finding.id} finding={finding} />
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
          + {hiddenCount} more finding{hiddenCount === 1 ? "" : "s"}
        </button>
      )}

      {showAll && codeLevelAll.length > DEFAULT_VISIBLE_FINDINGS && (
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
