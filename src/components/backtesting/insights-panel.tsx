"use client";

import { Lightbulb, Loader2 } from "lucide-react";

interface InsightsPanelProps {
  insights?: string[];
  source?: "ai" | "data-driven";
  ticker: string;
  date: string;
}

export function InsightsPanel({
  insights,
  source,
  ticker,
  date,
}: InsightsPanelProps) {
  const isLoading = !insights;
  const hasInsights = insights && insights.length > 0;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-[15px] font-semibold text-text-primary">
          What Happened & Why
        </h3>
        {source && (
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
              source === "ai"
                ? "bg-purple-500/10 text-purple-400"
                : "bg-blue-500/10 text-blue-400"
            }`}
          >
            {source === "ai" ? "AI Analysis" : "Data Analysis"}
          </span>
        )}
      </div>

      <div className="rounded-lg border border-border bg-bg p-4">
        {isLoading && (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <span className="text-[13px] text-text-muted">
              Analyzing {ticker} price action on {date}...
            </span>
          </div>
        )}

        {hasInsights && (
          <ul className="space-y-3">
            {insights.map((insight, i) => (
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
        )}

        {!isLoading && !hasInsights && (
          <p className="text-[13px] text-text-muted">
            No additional insights available for this replay.
          </p>
        )}
      </div>
    </div>
  );
}
