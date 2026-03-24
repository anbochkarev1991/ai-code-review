"use client";

import { getRiskScoreTheme } from "@/app/dashboard/review-summary-shared";

export interface RiskScoreGaugeProps {
  /** Risk score 0–100 */
  score: number;
  /** e.g. Low risk | Moderate | High | Critical */
  riskLevel?: string;
  /** Outer diameter in px (default 120 for sidebar) */
  size?: number;
}

const COMPACT_THRESHOLD = 72;

export function RiskScoreGauge({
  score,
  riskLevel,
  size = 120,
}: RiskScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const theme = getRiskScoreTheme(clamped);
  const strokeWidth = size >= COMPACT_THRESHOLD ? 8 : 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);
  const compact = size < COMPACT_THRESHOLD;

  const ring = (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      aria-hidden
    >
      <g transform={`translate(${size / 2} ${size / 2}) rotate(-90)`}>
        <circle
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={theme.track}
        />
        <circle
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={`${theme.stroke} transition-[stroke-dashoffset] duration-500 ease-out`}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </g>
    </svg>
  );

  if (compact) {
    return (
      <div
        className="flex items-center gap-3"
        role="img"
        aria-label={`Risk score ${clamped} out of 100${riskLevel ? `, ${riskLevel}` : ""}`}
      >
        {ring}
        <div className="flex min-w-0 flex-col justify-center">
          <div
            className={`inline-flex items-baseline gap-0.5 tabular-nums text-sm font-bold ${theme.text}`}
          >
            <span>{clamped}</span>
            <span className="text-[10px] font-semibold opacity-80">/100</span>
          </div>
          {riskLevel && (
            <p
              className={`mt-0.5 truncate text-[11px] font-medium ${theme.label}`}
            >
              {riskLevel}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center gap-2"
      role="img"
      aria-label={`Risk score ${clamped} out of 100${riskLevel ? `, ${riskLevel}` : ""}`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <div className="absolute inset-0">{ring}</div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className={`flex flex-col items-center ${theme.text}`}>
            <div className="flex items-baseline gap-0.5 tabular-nums">
              <span className="text-2xl font-bold leading-none">{clamped}</span>
              <span className="text-sm font-semibold tracking-tight opacity-85">
                /100
              </span>
            </div>
          </div>
        </div>
      </div>
      {riskLevel && (
        <p className={`text-center text-sm font-medium ${theme.label}`}>{riskLevel}</p>
      )}
    </div>
  );
}
