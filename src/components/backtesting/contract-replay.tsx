"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { List, Lightbulb, TrendingUp, TrendingDown, Target, Users } from "lucide-react";
import { SummaryCards } from "./summary-cards";
import { ReplayChart } from "./replay-chart";
import { UnderlyingChart } from "./underlying-chart";
import type { UnderlyingPoint } from "./underlying-chart";
import { KeyMomentsList } from "./key-moments-list";
import { InsightsPanel } from "./insights-panel";
import { DeepDivePanel } from "./deep-dive-panel";
import { ExitTimePicker } from "./exit-time-picker";
import { DayNavigator } from "./day-navigator";
import type { ReplayResult, ReplayMetrics, Right, TimePoint } from "@/lib/engine/types";
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

  // ─── Multi-day support ───────────────────────────────────────────
  /** All trading days from entry date to expiry date */
  tradingDays?: string[];
  /** Currently viewed day (YYYY-MM-DD) */
  viewedDate?: string;
  /** Called when user picks a different day */
  onViewedDateChange?: (date: string) => void;
  /** Chart points for the currently viewed day (null = use sameDayPoints) */
  viewedDayPoints?: TimePoint[] | null;
  /** True while fetching data for a non-entry day */
  viewedDayLoading?: boolean;
  /** DTE remaining for the currently viewed day */
  viewedDayDTE?: number;
  /** Theta-only theoretical price for the viewed day */
  thetaDecayPrice?: number;
  /** Called when user sets an exit time/date */
  onExitChange?: (exitTime: string, exitDate: string) => void;
  /** Exit P&L computed by parent */
  exitPL?: { premium: number; dollar: number; pct: number } | null;

  // ─── Underlying overlay ──────────────────────────────────────────
  /** Underlying intraday points for the overlay */
  underlyingPoints?: UnderlyingPoint[];
  /** True while fetching underlying data */
  underlyingLoading?: boolean;
  /** Called to request underlying data for overlay */
  onRequestUnderlying?: () => void;
}

/** Best Exit Analysis — 2:1 risk/reward analysis */
function BestExitAnalysis({ metrics, entryPremium }: { metrics: ReplayMetrics; entryPremium: number }) {
  const riskPerContract = entryPremium * 100; // max risk = premium paid
  const twoToOneTarget = riskPerContract * 2;
  const hitTarget = metrics.maxProfit >= twoToOneTarget;
  const optimalWasGood = metrics.optimalExitPL > 0;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-surface/50 px-4 py-3">
        <p className="text-[13px] font-medium text-text-muted mb-1">2:1 Risk/Reward Target</p>
        <p className="text-[13px] text-text-secondary">
          Premium paid: <span className="font-semibold text-text-primary">${riskPerContract.toFixed(2)}</span> per contract.
          A 2:1 target = <span className="font-semibold text-text-primary">${twoToOneTarget.toFixed(2)}</span> profit.
        </p>
        <p className={`mt-1 text-[13px] font-semibold ${hitTarget ? "text-green-400" : "text-amber-400"}`}>
          {hitTarget
            ? `Target was hit — max profit reached $${metrics.maxProfit.toFixed(2)} at ${metrics.maxProfitTime}.`
            : `Target was NOT hit — max profit was $${metrics.maxProfit.toFixed(2)} (${metrics.maxProfitPct.toFixed(0)}%) at ${metrics.maxProfitTime}.`}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface/50 px-4 py-3">
        <p className="text-[13px] font-medium text-text-muted mb-1">Optimal Exit</p>
        <p className="text-[13px] text-text-secondary">
          {optimalWasGood ? (
            <>
              Best exit was at <span className="font-semibold text-text-primary">{metrics.optimalExitTime}</span> with{" "}
              <span className="font-semibold text-green-400">+${metrics.optimalExitPL.toFixed(2)}</span> ({metrics.optimalExitReason}).
            </>
          ) : (
            <>
              No profitable exit window — the option lost value from entry.
              Max drawdown was <span className="font-semibold text-red-400">${Math.abs(metrics.maxDrawdown).toFixed(2)}</span> at {metrics.maxDrawdownTime}.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/** What Most Traders Did — behavioral analysis */
function TraderBehaviorAnalysis({ metrics }: { metrics: ReplayMetrics }) {
  const profitable = metrics.exitAtClosePL >= 0;
  const bigWin = metrics.maxProfitPct >= 50;
  const bigLoss = metrics.maxDrawdownPct <= -30;
  const earlyExit = metrics.optimalExitPLPct > metrics.exitAtClosePLPct + 10;

  // Determine likely trader behavior
  let behavior: string;
  let outcome: string;
  let isWin: boolean;

  if (profitable && bigWin) {
    behavior = "Most traders would have taken profit early, likely around +20-30%, missing the full move.";
    outcome = `Holding to close returned +${metrics.exitAtClosePLPct.toFixed(0)}% — patience was rewarded.`;
    isWin = true;
  } else if (profitable && !bigWin) {
    behavior = "Most traders would have held through the session looking for a bigger move.";
    outcome = `The trade ended with a modest +${metrics.exitAtClosePLPct.toFixed(0)}% gain — a realistic win.`;
    isWin = true;
  } else if (!profitable && bigLoss) {
    behavior = "Most traders would have panic-sold during the sharp drawdown, locking in a loss near the bottom.";
    outcome = `Max drawdown hit ${metrics.maxDrawdownPct.toFixed(0)}% at ${metrics.maxDrawdownTime} — most would have exited there.`;
    isWin = false;
  } else if (!profitable && earlyExit) {
    behavior = "Most traders would have missed the optimal exit window and held hoping for a recovery.";
    outcome = `The optimal exit was at ${metrics.optimalExitTime} (${metrics.optimalExitReason}), but most would have held to a loss.`;
    isWin = false;
  } else {
    behavior = "Most traders would have held through the session, hoping for a turnaround that didn't come.";
    outcome = `The trade closed at ${metrics.exitAtClosePLPct.toFixed(0)}% — a common outcome for undisciplined exits.`;
    isWin = metrics.exitAtClosePL >= 0;
  }

  return (
    <div className="space-y-3">
      <div className={`rounded-lg border px-4 py-3 ${isWin ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isWin ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            Realistic {isWin ? "Win" : "Loss"}
          </span>
        </div>
        <p className="text-[13px] leading-relaxed text-text-secondary">{behavior}</p>
        <p className="mt-1.5 text-[13px] font-medium text-text-primary">{outcome}</p>
      </div>
    </div>
  );
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
  tradingDays,
  viewedDate,
  onViewedDateChange,
  viewedDayPoints,
  viewedDayLoading,
  viewedDayDTE,
  thetaDecayPrice,
  onExitChange,
  exitPL,
  underlyingPoints,
  underlyingLoading,
  onRequestUnderlying,
}: ContractReplayProps) {
  const [showUnderlying, setShowUnderlying] = useState(false);

  const { contract, sameDayPoints, toExpirationPoints, metrics, keyMoments } =
    result;

  const isMultiDay = toExpirationPoints.some((p) => p.dayIndex > 0);

  // Use selectedRight from parent for immediate visual toggle feedback
  const isCall = selectedRight === "call";

  // Compute expiry date string for exit picker
  const expiryDateStr = selectedExpiryISO
    ? new Date(selectedExpiryISO).toISOString().slice(0, 10)
    : contract.date;

  // Determine which points to show in the chart
  const chartPoints = viewedDayPoints ?? sameDayPoints;
  const chartLoading = loading || viewedDayLoading;

  // Today's date for day navigator
  const today = new Date().toISOString().slice(0, 10);

  // Determine if the contract has expired (backward-looking only)
  const isExpired = expiryDateStr < today;

  // Compute DTE dynamically from selected expiry and entry date
  const computedDTE = useMemo(() => {
    if (!selectedExpiryISO) return metrics.dteAtEntry;
    const expiryMs = new Date(selectedExpiryISO).getTime();
    const entryMs = new Date(contract.date + "T12:00:00Z").getTime();
    return Math.max(0, Math.round((expiryMs - entryMs) / 86400000));
  }, [selectedExpiryISO, contract.date, metrics.dteAtEntry]);

  // Show DTE in contract info area — use viewed day DTE if viewing a different day
  const displayDTE = viewedDayDTE ?? computedDTE;

  // Whether we're currently viewing the entry day
  const isEntryDayFlag = !viewedDate || viewedDate === contract.date;

  // Auto-refetch underlying when day changes while overlay is visible
  const prevViewedDateRef = useRef(viewedDate);
  useEffect(() => {
    if (prevViewedDateRef.current !== viewedDate && showUnderlying && onRequestUnderlying) {
      // Small delay to let the day change settle, then refetch
      const timer = setTimeout(() => onRequestUnderlying(), 100);
      prevViewedDateRef.current = viewedDate;
      return () => clearTimeout(timer);
    }
    prevViewedDateRef.current = viewedDate;
  }, [viewedDate, showUnderlying, onRequestUnderlying]);

  // Toggle handler for "Show Underlying"
  const handleToggleUnderlying = () => {
    if (!showUnderlying && (!underlyingPoints || underlyingPoints.length === 0) && onRequestUnderlying) {
      onRequestUnderlying();
    }
    setShowUnderlying(!showUnderlying);
  };

  // Date label for the underlying chart title (e.g. "Feb 27")
  const underlyingDateLabel = useMemo(() => {
    const targetDate = viewedDate || contract.date;
    const d = new Date(targetDate + "T12:00:00Z");
    const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    const day = d.getUTCDate();
    return `${month} ${day}`;
  }, [viewedDate, contract.date]);

  // Convert entry time "10:00" → "10:00 AM" for the chart reference line
  const entryTimeLabel = useMemo(() => {
    const et = contract.entryTime;
    if (!et) return undefined;
    const [hStr, mStr] = et.split(":");
    let h = parseInt(hStr, 10);
    const m = mStr;
    const suffix = h >= 12 ? "PM" : "AM";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${m} ${suffix}`;
  }, [contract.entryTime]);

  // ─── Conversational header text ─────────────────────────────────
  const entryDateLabel = useMemo(() => {
    const d = new Date(contract.date + "T12:00:00Z");
    const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    const day = d.getUTCDate();
    return `${month} ${day}`;
  }, [contract.date]);

  const entryPremiumLabel = `$${(metrics.entryPremium * 100).toFixed(0)}`;
  const dirWord = isCall ? "Call" : "Put";
  const line1 = `You bought a ${contract.ticker} $${contract.strike} ${dirWord} for ${entryPremiumLabel} on ${entryDateLabel} @ ${to12Hour(contract.entryTime)}.`;

  const line2 = useMemo(() => {
    const vd = viewedDate || contract.date;
    if (vd === contract.date) return "Here\u2019s what happened from your entry.";
    if (vd === expiryDateStr) {
      const d = new Date(vd + "T12:00:00Z");
      const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
      const day = d.getUTCDate();
      return `This is expiration day \u2014 ${month} ${day}.`;
    }
    // Calculate days after entry
    const entryMs = new Date(contract.date + "T12:00:00Z").getTime();
    const viewMs = new Date(vd + "T12:00:00Z").getTime();
    const daysDiff = Math.round((viewMs - entryMs) / 86400000);
    const vDate = new Date(vd + "T12:00:00Z");
    const month = vDate.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    const day = vDate.getUTCDate();
    return `Checking in on ${month} ${day} \u2014 ${daysDiff} day${daysDiff !== 1 ? "s" : ""} after entry.`;
  }, [viewedDate, contract.date, expiryDateStr]);

  return (
    <div className="rounded-[14px] border border-border bg-surface p-6">
      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
          {error}
        </div>
      )}

      {/* Conversational header */}
      <div className="mb-4">
        <p className="text-[15px] font-medium text-text-primary leading-relaxed">
          {line1}
          {chartLoading && (
            <span className="ml-2 inline-flex items-center gap-1 align-middle">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="text-[12px] text-text-muted">Repricing...</span>
            </span>
          )}
        </p>
        <p className="mt-1 text-[14px] text-text-secondary">{line2}</p>
      </div>

      {/* Inline controls row */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
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

        {/* Expiry chips inline */}
        {availableExpiries && availableExpiries.length > 0 && onExpiryChange && (
          <>
            <span className="text-text-muted text-[13px]">&middot;</span>
            <div className={`flex flex-wrap items-center gap-2 ${loading ? "opacity-50 pointer-events-none" : ""}`}>
              <span className="text-[12px] font-medium text-text-muted">Expiration Date:</span>
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
          </>
        )}

        {/* Select Another Strike */}
        <span className="text-text-muted text-[13px]">&middot;</span>
        <Button
          variant="outline"
          size="sm"
          onClick={onPickAnother}
          disabled={loading}
          className="gap-1.5 border-accent/30 text-accent hover:bg-accent/10 hover:text-accent text-[12px] h-8"
        >
          <List className="h-3 w-3" />
          Change Strike
        </Button>

        {displayDTE > 0 && (
          <>
            <span className="text-text-muted text-[13px]">&middot;</span>
            <span className="text-[13px] text-text-muted">{displayDTE} DTE</span>
          </>
        )}
        {displayDTE === 0 && (
          <>
            <span className="text-text-muted text-[13px]">&middot;</span>
            <span className="text-[13px] text-text-muted">Same Day</span>
          </>
        )}
      </div>

      {/* Day navigator (multi-day trades only) — inline below controls */}
      {tradingDays && tradingDays.length > 1 && viewedDate && onViewedDateChange && (
        <div className={`mb-4 ${loading ? "opacity-50 pointer-events-none" : ""}`}>
          <DayNavigator
            tradingDays={tradingDays}
            viewedDate={viewedDate}
            entryDate={contract.date}
            expiryDate={expiryDateStr}
            today={today}
            onDayChange={onViewedDateChange}
            loading={chartLoading}
          />
        </div>
      )}

      {/* 2. Chart (above trade summary) with loading overlay */}
      <div className="relative mb-5">
        {/* Show Underlying toggle */}
        <div className="mb-2 flex items-center justify-end">
          <button
            onClick={handleToggleUnderlying}
            disabled={underlyingLoading}
            className={`rounded-md border px-3 py-1 text-[11px] font-medium transition-colors ${
              showUnderlying
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border text-text-muted hover:text-text-primary hover:border-border"
            } ${underlyingLoading ? "opacity-50" : ""}`}
          >
            {underlyingLoading
              ? "Loading..."
              : showUnderlying
                ? "Hide Underlying"
                : "Show Underlying"}
          </button>
        </div>

        <ReplayChart
          sameDayPoints={chartPoints}
          toExpirationPoints={toExpirationPoints}
          isMultiDay={isMultiDay}
          entryPremium={metrics.entryPremium}
          thetaDecayPrice={thetaDecayPrice}
          isEntryDay={isEntryDayFlag}
          entryTime={isEntryDayFlag ? contract.entryTime : undefined}
        />
        {chartLoading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-surface/70 z-10">
            <div className="flex items-center gap-2 rounded-lg bg-bg/90 px-4 py-2 border border-border">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="text-sm text-text-muted">Repricing...</span>
            </div>
          </div>
        )}

        {/* Separate underlying chart below option chart */}
        {showUnderlying && underlyingPoints && underlyingPoints.length > 0 && (
          <div className="mt-3">
            <UnderlyingChart
              points={underlyingPoints}
              ticker={contract.ticker}
              dateLabel={underlyingDateLabel}
              entryTimeLabel={isEntryDayFlag ? entryTimeLabel : undefined}
              isEntryDay={isEntryDayFlag}
              entryTime={isEntryDayFlag ? contract.entryTime : undefined}
            />
          </div>
        )}
      </div>

      {/* Quote */}
      <p className="mb-5 text-center text-[12px] italic text-text-muted/60">
        &ldquo;The past, while not a perfect predictor of the future, is the best guide we have.&rdquo;
      </p>

      {/* 3. Entry Summary (entry details + exit P&L + secondary if-held-to-close) */}
      <div className={`mb-5 ${loading ? "opacity-50" : ""}`}>
        <SummaryCards metrics={metrics} right={selectedRight} exitPL={exitPL} />
      </div>

      {/* 4. Exit time picker — only shown for expired contracts */}
      {isExpired && (
        <div className="mb-5">
          <ExitTimePicker
            entryTime={contract.entryTime}
            entryDate={contract.date}
            expiryDate={expiryDateStr}
            onExitChange={onExitChange}
          />
        </div>
      )}

      {/* 5. Analysis sections — 4 accordion panels */}
      <div className="mb-6 rounded-lg border border-border bg-bg">
        <Accordion type="multiple" defaultValue={["key-insights"]}>
          {/* Key Insights */}
          <AccordionItem value="key-insights">
            <AccordionTrigger className="px-5 text-[15px]">
              <span className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-blue-400" />
                Key Insights
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-5">
              <InsightsPanel
                insights={result.insights}
                source={result.insightsSource}
                ticker={contract.ticker}
                date={contract.date}
                chartPoints={chartPoints}
                metrics={metrics}
              />
            </AccordionContent>
          </AccordionItem>

          {/* What Went Right/Wrong */}
          <AccordionItem value="right-wrong">
            <AccordionTrigger className="px-5 text-[15px]">
              <span className="flex items-center gap-2">
                {metrics.exitAtClosePL >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                )}
                What Went {metrics.exitAtClosePL >= 0 ? "Right" : "Wrong"}
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-5">
              <KeyMomentsList moments={keyMoments} />
            </AccordionContent>
          </AccordionItem>

          {/* Best Exit Analysis */}
          <AccordionItem value="best-exit">
            <AccordionTrigger className="px-5 text-[15px]">
              <span className="flex items-center gap-2">
                <Target className="h-4 w-4 text-accent" />
                Best Exit Analysis
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-5">
              <BestExitAnalysis metrics={metrics} entryPremium={metrics.entryPremium} />
            </AccordionContent>
          </AccordionItem>

          {/* What Most Traders Did */}
          <AccordionItem value="most-traders">
            <AccordionTrigger className="px-5 text-[15px]">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-400" />
                What Most Traders Did
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-5">
              <TraderBehaviorAnalysis metrics={metrics} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Deep Dive — strategy-specific AI analysis */}
      <div className="mb-6">
        <DeepDivePanel result={result} />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="outline" onClick={onNewBacktest}>New Replay</Button>
      </div>
    </div>
  );
}
