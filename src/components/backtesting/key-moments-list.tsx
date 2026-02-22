"use client";

import {
  Clock,
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  Shield,
  AlertTriangle,
  Zap,
  Newspaper,
} from "lucide-react";
import type { KeyMoment } from "@/lib/engine/types";

interface KeyMomentsListProps {
  moments: KeyMoment[];
}

const tradeIconMap: Record<string, React.ElementType> = {
  Entry: Clock,
  "Momentum surge": TrendingUp,
  "Momentum drop": TrendingDown,
  "Peak profit (MFE)": TrendingUp,
  "Max drawdown (MAE)": TrendingDown,
  "Support held": Shield,
  "Resistance hit": AlertTriangle,
  "Theta decay overnight": Activity,
  "Volatility expansion": Zap,
  "Profitable close": Target,
  "Loss at close": TrendingDown,
};

function getIcon(moment: KeyMoment) {
  if (moment.type === "news") return Newspaper;
  return tradeIconMap[moment.label] || Activity;
}

function getColor(moment: KeyMoment): string {
  if (moment.type === "news") return "text-amber-400";
  const label = moment.label;
  if (label.includes("profit") || label.includes("Profitable") || label.includes("surge") || label === "Support held")
    return "text-success";
  if (label.includes("drawdown") || label.includes("Loss") || label.includes("drop") || label === "Resistance hit")
    return "text-danger";
  return "text-accent";
}

function getBorderColor(moment: KeyMoment): string {
  if (moment.type === "news") return "border-amber-500/20";
  return "border-border";
}

export function KeyMomentsList({ moments }: KeyMomentsListProps) {
  if (moments.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-[15px] font-semibold text-text-primary">
        Key Insights
      </h3>
      <div className="space-y-2">
        {moments.map((m, i) => {
          const Icon = getIcon(m);
          const color = getColor(m);
          const borderColor = getBorderColor(m);
          const isNews = m.type === "news";
          return (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${borderColor} ${
                isNews ? "bg-amber-500/[0.03]" : "bg-bg"
              }`}
            >
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  isNews ? "bg-amber-500/10" : "bg-surface"
                } ${color}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[13px] font-medium ${color}`}>
                    {m.label}
                  </span>
                  {isNews && (
                    <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-400">
                      News
                    </span>
                  )}
                  <span className="text-[11px] text-text-muted">{m.time}</span>
                </div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-text-secondary">
                  {m.reason}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
