"use client";

import type { ReplayMetrics, Right } from "@/lib/engine/types";

interface SummaryCardsProps {
  metrics: ReplayMetrics;
  right: Right;
}

function dual(perShare: number): string {
  return `$${Math.abs(perShare).toFixed(2)} per share / $${Math.abs(perShare * 100).toFixed(2)} per contract (100x)`;
}

function dualPL(perContract: number): string {
  const perShare = perContract / 100;
  const sign = perContract >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(perShare).toFixed(2)} per share / ${sign}$${Math.abs(perContract).toFixed(2)} per contract (100x)`;
}

export function SummaryCards({ metrics, right }: SummaryCardsProps) {
  const isCall = right === "call";
  const directionEmoji = isCall ? "\u{1F4C8}" : "\u{1F4C9}";
  const directionLabel = isCall ? "CALL" : "PUT";
  const resultPL = metrics.exitAtClosePL;
  const resultLabel = resultPL >= 0 ? "Profit" : "Loss";

  const rows: { label: string; value: string; color?: string }[] = [
    {
      label: "Direction",
      value: `${directionEmoji} ${directionLabel}`,
      color: isCall ? "text-green-400" : "text-red-400",
    },
    {
      label: "Entry Premium",
      value: dual(metrics.entryPremium),
    },
    {
      label: "Exit Premium",
      value: dual(metrics.exitPremium),
    },
    {
      label: "Max Gain",
      value: `${dualPL(metrics.maxProfit)} — at ${metrics.maxProfitTime}`,
      color: "text-success",
    },
    {
      label: "Max Loss",
      value: `${dualPL(metrics.maxDrawdown)} — at ${metrics.maxDrawdownTime}`,
      color: "text-danger",
    },
    {
      label: "Optimal Exit",
      value: `${metrics.optimalExitTime} at $${metrics.optimalExitPremium.toFixed(2)} — ${metrics.optimalExitReason}`,
    },
    {
      label: "Result",
      value: `${resultLabel} of ${dualPL(resultPL)}`,
      color: resultPL >= 0 ? "text-success" : "text-danger",
    },
    {
      label: "IV at Entry",
      value: `${(metrics.ivAtEntry * 100).toFixed(0)}%`,
    },
    {
      label: "Greeks at Entry",
      value: `\u0394 ${metrics.deltaAtEntry.toFixed(2)}  \u0393 ${metrics.gammaAtEntry.toFixed(4)}  \u0398 ${metrics.thetaAtEntry.toFixed(2)}  \u03BD ${metrics.vegaAtEntry.toFixed(3)}`,
    },
  ];

  return (
    <div className="rounded-lg border border-border bg-bg px-5 py-4">
      <h3 className="mb-3 text-[15px] font-semibold text-text-primary">
        Trade Summary
      </h3>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.label} className="flex flex-wrap gap-x-2 text-[13px]">
            <span className="font-medium text-text-muted">{row.label}:</span>
            <span className={`font-semibold ${row.color ?? "text-text-primary"}`}>
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
