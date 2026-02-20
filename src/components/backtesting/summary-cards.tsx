"use client";

import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Clock,
} from "lucide-react";
import type { ReplayMetrics } from "@/lib/engine/types";

interface SummaryCardsProps {
  metrics: ReplayMetrics;
}

function formatPL(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}$${value.toLocaleString()}`;
}

function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function SummaryCards({ metrics }: SummaryCardsProps) {
  const cards = [
    {
      label: "Entry Premium",
      value: `$${metrics.entryPremium.toFixed(2)}`,
      icon: DollarSign,
      color: "text-accent",
    },
    {
      label: "P/L at Close",
      value: `${formatPL(metrics.exitAtClosePL)} (${formatPct(metrics.exitAtClosePLPct)})`,
      icon: metrics.exitAtClosePL >= 0 ? TrendingUp : TrendingDown,
      color: metrics.exitAtClosePL >= 0 ? "text-success" : "text-danger",
    },
    {
      label: "Max Profit (MFE)",
      value: `${formatPL(metrics.maxProfit)} (${formatPct(metrics.maxProfitPct)})`,
      sub: metrics.maxProfitTime,
      icon: TrendingUp,
      color: "text-success",
    },
    {
      label: "Max Drawdown (MAE)",
      value: `${formatPL(metrics.maxDrawdown)} (${formatPct(metrics.maxDrawdownPct)})`,
      sub: metrics.maxDrawdownTime,
      icon: TrendingDown,
      color: "text-danger",
    },
    {
      label: "Optimal Exit",
      value: `${formatPL(metrics.optimalExitPL)} (${formatPct(metrics.optimalExitPLPct)})`,
      sub: metrics.optimalExitTime,
      icon: Target,
      color: "text-accent",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-border bg-bg px-4 py-3"
        >
          <div className="mb-1 flex items-center gap-1.5">
            <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
            <span className="text-[11px] text-text-muted">{card.label}</span>
          </div>
          <p className={`text-sm font-semibold ${card.color}`}>{card.value}</p>
          {card.sub && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-text-muted">
              <Clock className="h-3 w-3" />
              {card.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
