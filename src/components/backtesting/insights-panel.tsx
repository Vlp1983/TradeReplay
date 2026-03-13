"use client";

import { useMemo } from "react";
import { Lightbulb, Loader2 } from "lucide-react";
import type { TimePoint, ReplayMetrics } from "@/lib/engine/types";

interface InsightsPanelProps {
  /** AI-generated insights (for Deep Dive section below) */
  insights?: string[];
  source?: "ai" | "data-driven";
  ticker: string;
  date: string;
  /** Current chart points for data-driven observations */
  chartPoints?: TimePoint[];
  /** Entry metrics for contextual info */
  metrics?: ReplayMetrics;
}

/** Generate factual observations from bar data */
function computeDataInsights(
  points: TimePoint[],
  metrics: ReplayMetrics,
  ticker: string
): string[] {
  if (points.length < 2) return [];

  const observations: string[] = [];
  const first = points[0];
  const last = points[points.length - 1];
  const entryPremium = metrics.entryPremium;

  // Option movement over the day
  const dayPL = last.pl_dollar;
  const dayPLPct = last.pl_pct;
  if (dayPL >= 0) {
    observations.push(
      `Your ${ticker} option gained $${dayPL.toFixed(2)} per contract over this session (+${dayPLPct.toFixed(1)}%).`
    );
  } else {
    observations.push(
      `Your ${ticker} option lost $${Math.abs(dayPL).toFixed(2)} per contract over this session (${dayPLPct.toFixed(1)}%).`
    );
  }

  // First hour performance (roughly first 12 bars at 5-min intervals)
  const firstHourEnd = Math.min(12, points.length - 1);
  const firstHourPL = points[firstHourEnd].pl_dollar;
  if (Math.abs(firstHourPL) > 1) {
    const dir = firstHourPL >= 0 ? "gained" : "lost";
    observations.push(
      `In the first hour, the option ${dir} $${Math.abs(firstHourPL).toFixed(2)} per contract.`
    );
  }

  // Peak value
  let peakIdx = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].pl_dollar > points[peakIdx].pl_dollar) peakIdx = i;
  }
  if (points[peakIdx].pl_dollar > 0) {
    const peakPremium = points[peakIdx].price * 100;
    const peakPct = points[peakIdx].pl_pct;
    observations.push(
      `Peak value was $${peakPremium.toFixed(2)} per contract at ${points[peakIdx].label} — ${peakPct.toFixed(0)}% above entry.`
    );
  }

  // Theta cost observation
  if (metrics.dteAtEntry > 0 && metrics.thetaAtEntry < 0) {
    const thetaCostPerDay = Math.abs(metrics.thetaAtEntry * 100);
    observations.push(
      `Theta cost approximately $${thetaCostPerDay.toFixed(2)} per contract per day at ${metrics.dteAtEntry} DTE.`
    );
  }

  // If option lost value significantly despite small underlying move (suggest theta/IV crush)
  if (dayPLPct < -10 && metrics.dteAtEntry <= 3) {
    observations.push(
      `Significant decay with low DTE — theta acceleration likely contributed to the loss.`
    );
  }

  return observations;
}

export function InsightsPanel({
  insights,
  source,
  ticker,
  date,
  chartPoints,
  metrics,
}: InsightsPanelProps) {
  // Compute data-driven observations from bar data
  const dataObservations = useMemo(() => {
    if (!chartPoints?.length || !metrics) return [];
    return computeDataInsights(chartPoints, metrics, ticker);
  }, [chartPoints, metrics, ticker]);

  const isLoading = !insights && dataObservations.length === 0;
  const hasDataObs = dataObservations.length > 0;
  const hasAIInsights = insights && insights.length > 0;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-[15px] font-semibold text-text-primary">
          What Happened & Why
        </h3>
        {hasDataObs && (
          <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-blue-500/10 text-blue-400">
            Data Analysis
          </span>
        )}
      </div>

      <div className="rounded-lg border border-border bg-bg p-4">
        {/* Data-driven observations — always first */}
        {hasDataObs && (
          <ul className="space-y-3">
            {dataObservations.map((obs, i) => (
              <li key={i} className="flex gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                  <Lightbulb className="h-3 w-3 text-blue-400" />
                </div>
                <p className="text-[13px] leading-relaxed text-text-secondary">
                  {obs}
                </p>
              </li>
            ))}
          </ul>
        )}

        {/* AI insights below data observations */}
        {hasAIInsights && (
          <div className={hasDataObs ? "mt-4 border-t border-border pt-4" : ""}>
            <div className="mb-2 flex items-center gap-1.5">
              <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-purple-500/10 text-purple-400">
                AI Analysis
              </span>
            </div>
            <ul className="space-y-3">
              {insights!.map((insight, i) => (
                <li key={i} className="flex gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                    <Lightbulb className="h-3 w-3 text-amber-400" />
                  </div>
                  <p className="text-[13px] leading-relaxed text-text-secondary">
                    {insight}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <span className="text-[13px] text-text-muted">
              Analyzing {ticker} price action on {date}...
            </span>
          </div>
        )}

        {!isLoading && !hasDataObs && !hasAIInsights && (
          <p className="text-[13px] text-text-muted">
            No additional insights available for this replay.
          </p>
        )}
      </div>
    </div>
  );
}
