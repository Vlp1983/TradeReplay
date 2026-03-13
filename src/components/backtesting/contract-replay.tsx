"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { List } from "lucide-react";
import { SummaryCards } from "./summary-cards";
import { ReplayChart } from "./replay-chart";
import { KeyMomentsList } from "./key-moments-list";
import { InsightsPanel } from "./insights-panel";
import { DeepDivePanel } from "./deep-dive-panel";
import type { ReplayResult, Right } from "@/lib/engine/types";
import { to12Hour } from "@/lib/engine/dates";

/** Serialized expiry from pricing API (date is ISO string after JSON round-trip) */
export interface ExpiryOption {
  date: string; // ISO string
  label: string;
  dte: number;
  type: "0DTE" | "weekly";
}

interface ContractReplayProps {
  result: ReplayResult;
  onNewBacktest: () => void;
  onPickAnother: () => void;
  onToggleRight: (right: Right) => void;
  /** Controlled right from parent — toggles update immediately on click */
  selectedRight: Right;
  /** Available expiries from the pricing engine */
  availableExpiries?: ExpiryOption[];
  /** Currently selected expiry ISO string */
  selectedExpiryISO?: string;
  /** Called when user picks a different expiry */
  onExpiryChange?: (expiryDate: Date) => void;
  /** True while a pricing fetch is in progress */
  loading?: boolean;
  /** Error message from last failed fetch */
  error?: string | null;
}

export function ContractReplay({
  result,
  onNewBacktest,
  onPickAnother,
  onToggleRight,
  selectedRight,
  availableExpiries,
  selectedExpiryISO,
  onExpiryChange,
  loading,
  error,
}: ContractReplayProps) {
  const { contract, sameDayPoints, toExpirationPoints, metrics, keyMoments } =
    result;

  const contractLabel = `${contract.ticker} ${contract.strike}${selectedRight === "call" ? "C" : "P"}`;
  const isMultiDay = toExpirationPoints.some((p) => p.dayIndex > 0);

  // Use selectedRight from parent for immediate visual toggle feedback
  const isCall = selectedRight === "call";

  // Derive expiry label from selected expiry or fallback
  const selectedExpiry = availableExpiries?.find(
    (e) => e.date === selectedExpiryISO
  );
  const expLabel = selectedExpiry?.label ?? contract.expiration;

  return (
    <div className="rounded-[14px] border border-border bg-surface p-6">
      {/* Header */}
      <div className="mb-1 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-[13px] font-semibold text-accent">
          2
        </span>
        <h2 className="text-lg font-semibold text-text-primary">
          Your Results
        </h2>
        {loading && (
          <div className="flex items-center gap-1.5 ml-2">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span className="text-[12px] text-text-muted">Repricing...</span>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
          {error}
        </div>
      )}

      {/* Call / Put toggle + contract info + select another strike */}
      <div className="mt-3 mb-4 rounded-lg border border-border bg-bg px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Call / Put toggle */}
            <div className={`flex rounded-lg border border-border p-0.5 ${loading ? "opacity-50 pointer-events-none" : ""}`}>
              <button
                onClick={() => onToggleRight("call")}
                disabled={loading}
                className={`rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  isCall
                    ? "bg-green-500/15 text-green-400"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                Call
              </button>
              <button
                onClick={() => onToggleRight("put")}
                disabled={loading}
                className={`rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  !isCall
                    ? "bg-red-500/15 text-red-400"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                Put
              </button>
            </div>

            {/* Contract details */}
            <span className="text-sm font-semibold text-text-primary">
              {contractLabel}
            </span>
            <Badge className="bg-accent/15 text-accent border-0 text-[10px] font-semibold">
              ATM
            </Badge>
            <span className="text-[13px] text-text-muted">
              Exp {expLabel}
            </span>
            <span className="text-[13px] text-text-muted">
              Entry {to12Hour(contract.entryTime)} ET
            </span>
          </div>

          {/* Select Another Strike — prominent */}
          <Button
            variant="outline"
            onClick={onPickAnother}
            disabled={loading}
            className="gap-1.5 border-accent/30 text-accent hover:bg-accent/10 hover:text-accent"
          >
            <List className="h-3.5 w-3.5" />
            Select Another Strike
          </Button>
        </div>

        {/* Expiry selector chips */}
        {availableExpiries && availableExpiries.length > 0 && onExpiryChange && (
          <div className={`mt-3 flex flex-wrap items-center gap-2 ${loading ? "opacity-50 pointer-events-none" : ""}`}>
            <span className="text-[12px] font-medium text-text-muted">
              Expiry:
            </span>
            {availableExpiries.map((exp) => {
              const isActive = exp.date === selectedExpiryISO;
              return (
                <button
                  key={exp.date}
                  disabled={loading}
                  onClick={() => onExpiryChange(new Date(exp.date))}
                  className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                    isActive
                      ? "bg-accent text-white"
                      : "border border-border text-text-secondary hover:border-accent/40 hover:text-text-primary"
                  }`}
                >
                  {exp.label}
                </button>
              );
            })}
          </div>
        )}

        <p className="mt-2.5 text-[12px] text-text-muted">
          Showing the at-the-money (ATM) {isCall ? "call" : "put"} by default.
          Want to try an out-of-the-money (OTM) strike?{" "}
          <button
            onClick={onPickAnother}
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            Browse all strikes
          </button>
        </p>
      </div>

      {/* Summary cards */}
      <div className={`mb-5 ${loading ? "opacity-50" : ""}`}>
        <SummaryCards metrics={metrics} right={selectedRight} />
      </div>

      {/* Chart with loading overlay */}
      <div className="relative mb-5">
        <ReplayChart
          sameDayPoints={sameDayPoints}
          toExpirationPoints={toExpirationPoints}
          isMultiDay={isMultiDay}
          entryPremium={metrics.entryPremium}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-surface/70 z-10">
            <div className="flex items-center gap-2 rounded-lg bg-bg/90 px-4 py-2 border border-border">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="text-sm text-text-muted">Repricing...</span>
            </div>
          </div>
        )}
      </div>

      {/* Key Insights — trade moments */}
      <div className="mb-5">
        <KeyMomentsList moments={keyMoments} />
      </div>

      {/* What Happened & Why — AI-generated contextual analysis */}
      <div className="mb-5">
        <InsightsPanel
          insights={result.insights}
          source={result.insightsSource}
          ticker={contract.ticker}
          date={contract.date}
        />
      </div>

      {/* Deep Dive — strategy-specific AI analysis */}
      <div className="mb-6">
        <DeepDivePanel result={result} />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={onNewBacktest}>New Backtest</Button>
      </div>
    </div>
  );
}
