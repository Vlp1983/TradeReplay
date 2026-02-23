"use client";

import { Lightbulb, Loader2, BookOpen } from "lucide-react";

interface GradeInsightsProps {
  insights?: string[];
  source?: "ai" | "data-driven";
  ticker: string;
  loading?: boolean;
}

export function GradeInsights({
  insights,
  source,
  ticker,
  loading,
}: GradeInsightsProps) {
  const isLoading = loading || !insights;
  const hasInsights = insights && insights.length > 0;

  return (
    <div className="rounded-[14px] border border-border bg-surface p-6">
      {/* Header */}
      <div className="mb-1 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-[13px] font-semibold text-accent">
          4
        </span>
        <h2 className="text-lg font-semibold text-text-primary">
          What You Can Learn
        </h2>
        {source && (
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
              source === "ai"
                ? "bg-purple-500/10 text-purple-400"
                : "bg-blue-500/10 text-blue-400"
            }`}
          >
            {source === "ai" ? "AI Coach" : "Data Analysis"}
          </span>
        )}
      </div>
      <p className="mb-5 text-[13px] text-text-muted">
        Technical analysis of your trade with actionable takeaways for next time.
      </p>

      <div className="rounded-lg border border-border bg-bg p-4">
        {isLoading && (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <span className="text-[13px] text-text-muted">
              Analyzing your {ticker} trade for coaching insights...
            </span>
          </div>
        )}

        {hasInsights && (
          <ul className="space-y-4">
            {insights.map((insight, i) => (
              <li key={i} className="flex gap-3">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  {i === insights.length - 1 ? (
                    <BookOpen className="h-3.5 w-3.5 text-accent" />
                  ) : (
                    <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                  )}
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
            No additional coaching insights available for this trade.
          </p>
        )}
      </div>
    </div>
  );
}
