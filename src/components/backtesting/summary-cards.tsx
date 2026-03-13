"use client";

import type { ReplayMetrics, Right } from "@/lib/engine/types";

interface SummaryCardsProps {
  metrics: ReplayMetrics;
  right: Right;
  /** If set, show actual P&L at exit in a "Your Trade" section */
  exitPL?: { premium: number; dollar: number; pct: number } | null;
}

function fmtContract(perShare: number): string {
  return `$${Math.abs(perShare * 100).toFixed(2)}`;
}

function fmtContractPL(perContract: number): string {
  const sign = perContract >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(perContract).toFixed(2)}`;
}

export function SummaryCards({ metrics, right, exitPL }: SummaryCardsProps) {
  const isCall = right === "call";
  const directionLabel = isCall ? "CALL" : "PUT";

  // Entry-only rows — facts known at trade entry
  const entryRows: { label: string; value: string; color?: string }[] = [
    {
      label: "Direction",
      value: directionLabel,
      color: isCall ? "text-green-400" : "text-red-400",
    },
    {
      label: "Entry Premium",
      value: fmtContract(metrics.entryPremium),
    },
    {
      label: "IV at Entry",
      value: `${(metrics.ivAtEntry * 100).toFixed(0)}%`,
    },
    {
      label: "DTE at Entry",
      value: `${metrics.dteAtEntry} day${metrics.dteAtEntry !== 1 ? "s" : ""}`,
    },
  ];

  // Secondary rows — require scanning bars / assume held to close
  const secondaryRows: { label: string; value: string; color?: string }[] = [
    {
      label: "Exit Premium",
      value: fmtContract(metrics.exitPremium),
    },
    {
      label: "Max Gain (if held to expiry)",
      value: `${fmtContractPL(metrics.maxProfit)} — at ${metrics.maxProfitTime}`,
      color: "text-success",
    },
    {
      label: "Max Loss (if held to expiry)",
      value: `${fmtContractPL(metrics.maxDrawdown)} — at ${metrics.maxDrawdownTime}`,
      color: "text-danger",
    },
    {
      label: "Optimal Exit",
      value: `${metrics.optimalExitTime} at $${(metrics.optimalExitPremium * 100).toFixed(2)} — ${metrics.optimalExitReason}`,
    },
    {
      label: "Result",
      value: `${metrics.exitAtClosePL >= 0 ? "Profit" : "Loss"} of ${fmtContractPL(metrics.exitAtClosePL)} (if held to close)`,
      color: metrics.exitAtClosePL >= 0 ? "text-success" : "text-danger",
    },
  ];

  return (
    <div className="rounded-lg border border-border bg-bg px-5 py-4">
      <h3 className="mb-3 text-[15px] font-semibold text-text-primary">
        Entry Summary
      </h3>

      {/* Entry info */}
      <ul className="space-y-2">
        {entryRows.map((row) => (
          <li key={row.label} className="flex flex-wrap gap-x-2 text-[13px]">
            <span className="font-medium text-text-muted">{row.label}:</span>
            <span className={`font-semibold ${row.color ?? "text-text-primary"}`}>
              {row.value}
            </span>
          </li>
        ))}
      </ul>

      {/* Greeks grid — hidden when all effectively zero */}
      {(Math.abs(metrics.deltaAtEntry) >= 0.0001 ||
        Math.abs(metrics.gammaAtEntry) >= 0.0001 ||
        Math.abs(metrics.thetaAtEntry) >= 0.0001 ||
        Math.abs(metrics.vegaAtEntry) >= 0.0001) && (
        <div className="mt-3 grid grid-cols-4 gap-3 rounded-lg border border-border bg-surface/50 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Delta</span>
            <span className="text-[14px] font-semibold text-text-primary">{metrics.deltaAtEntry.toFixed(2)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Gamma</span>
            <span className="text-[14px] font-semibold text-text-primary">{metrics.gammaAtEntry.toFixed(3)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Theta</span>
            <span className="text-[14px] font-semibold text-text-primary">${(metrics.thetaAtEntry * 100).toFixed(2)}/day</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Vega</span>
            <span className="text-[14px] font-semibold text-text-primary">{metrics.vegaAtEntry.toFixed(3)}</span>
          </div>
        </div>
      )}

      {/* Your Trade section — shown when exit P&L is available */}
      {exitPL && (
        <>
          <div className="my-3 border-t border-border" />
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-accent">
            Your Trade
          </p>
          <ul className="space-y-2">
            <li className="flex flex-wrap gap-x-2 text-[13px]">
              <span className="font-medium text-text-muted">Exit Premium:</span>
              <span className="font-semibold text-text-primary">{fmtContract(exitPL.premium)}</span>
            </li>
            <li className="flex flex-wrap gap-x-2 text-[13px]">
              <span className="font-medium text-text-muted">P&L:</span>
              <span className={`font-semibold ${exitPL.dollar >= 0 ? "text-green-400" : "text-red-400"}`}>
                {fmtContractPL(exitPL.dollar)}
              </span>
            </li>
            <li className="flex flex-wrap gap-x-2 text-[13px]">
              <span className="font-medium text-text-muted">Return:</span>
              <span className={`font-semibold ${exitPL.pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                {exitPL.pct >= 0 ? "+" : ""}{exitPL.pct.toFixed(1)}% on premium paid
              </span>
            </li>
          </ul>
        </>
      )}

      {/* Separator */}
      <div className="my-3 border-t border-border" />

      {/* Secondary info — outcome-dependent */}
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-text-muted">
        If held to close
      </p>
      <ul className="space-y-2">
        {secondaryRows.map((row) => (
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
