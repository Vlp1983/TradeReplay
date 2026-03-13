"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MomentPicker } from "@/components/backtesting/moment-picker";
import { ChainSnapshot } from "@/components/backtesting/chain-snapshot";
import { ContractReplay } from "@/components/backtesting/contract-replay";
import type { ExpiryOption } from "@/components/backtesting/contract-replay";
import { PaywallBlur, PaywallModal } from "@/components/auth/PaywallModal";
import { useGate } from "@/lib/use-gate";
import type {
  MomentSelection,
  Expiration,
  ChainData,
  SelectedContract,
  ReplayResult,
  Right,
  TimePoint,
} from "@/lib/engine/types";
import type { OptionPricingResult } from "@/lib/pricing/types";
import {
  fetchPricing,
  resolveDefaultExpiry,
  pricingToChainData,
  pricingToReplayResult,
  barsToTimePoints,
  getTradingDaysBetween,
  fetchInsights,
} from "@/lib/engine/fetch-chain";

type Step = "moment" | "chain" | "replay";

/** Cached day data for multi-day navigation */
interface DayCache {
  points: TimePoint[];
  dte: number;
}

/**
 * Build a cache key that includes ALL pricing params.
 * Prevents stale cache hits when switching call/put or changing expiry.
 */
function dayCacheKey(
  viewedDate: string,
  optionType: string,
  strike: number,
  expiryMs: number
): string {
  return `${viewedDate}:${optionType}:${strike}:${expiryMs}`;
}

export default function BacktestingPage() {
  // ─── Core pricing params (changes trigger re-pricing via useEffect) ──
  const [moment, setMoment] = useState<MomentSelection | null>(null);
  const [selectedRight, setSelectedRight] = useState<Right>("call");
  const [currentExpiry, setCurrentExpiry] = useState<Date | null>(null);
  const [selectedStrike, setSelectedStrike] = useState<number>(0); // 0 = auto-resolve ATM

  // ─── Results & cache ──────────────────────────────────────────────
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);
  const [chainData, setChainData] = useState<ChainData | null>(null);
  const [lastPricing, setLastPricing] = useState<OptionPricingResult | null>(null);
  const [availableExpiries, setAvailableExpiries] = useState<ExpiryOption[]>([]);

  // ─── Multi-day navigation state ────────────────────────────────────
  const [viewedDate, setViewedDate] = useState<string>("");
  const [viewedDayPoints, setViewedDayPoints] = useState<TimePoint[] | null>(null);
  const [viewedDayLoading, setViewedDayLoading] = useState(false);
  const [viewedDayDTE, setViewedDayDTE] = useState<number | undefined>(undefined);
  const [thetaDecayPrice, setThetaDecayPrice] = useState<number | undefined>(undefined);
  const dayCacheRef = useRef<Map<string, DayCache>>(new Map());
  const dayFetchIdRef = useRef(0);

  // ─── UI state ─────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("moment");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  const { checkAndIncrement, isLimitReached, limitReason } = useGate();

  const chainRef = useRef<HTMLDivElement>(null);
  const replayRef = useRef<HTMLDivElement>(null);
  const fetchIdRef = useRef(0);
  const scrollOnNextResult = useRef(false);

  // Derive stable primitives for useEffect deps (avoids object reference issues)
  const ticker = moment?.ticker;
  const date = moment?.date;
  const entryTime = moment?.entryTime;
  const expiryMs = currentExpiry?.getTime() ?? null;

  // Compute trading days for multi-day navigation
  const tradingDays = useMemo(() => {
    if (!date || expiryMs == null) return [];
    const expiryStr = new Date(expiryMs).toISOString().slice(0, 10);
    if (expiryStr === date) return []; // 0DTE — no multi-day nav
    return getTradingDaysBetween(date, expiryStr);
  }, [date, expiryMs]);

  // ─── Core pricing effect (300ms debounce) ──────────────────────────
  //
  // All pricing calls flow through this single effect. Event handlers
  // just set state; this effect reacts to changes and fetches new data.
  // A fetchId counter prevents stale responses from overwriting newer ones.
  //
  useEffect(() => {
    if (!ticker || !date || !entryTime || expiryMs == null) return;

    const currentFetchId = ++fetchIdRef.current;
    const expiry = new Date(expiryMs);

    // Clear error and stale state immediately (before debounce delay)
    setError(null);

    // Reset multi-day state on new pricing params
    dayCacheRef.current.clear();
    setViewedDate(date);
    setViewedDayPoints(null);
    setViewedDayDTE(undefined);
    setThetaDecayPrice(undefined);

    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        let strike = selectedStrike;

        // Resolve ATM strike if needed (0 = "auto-ATM")
        if (strike === 0) {
          console.log("[pricing-effect] Resolving ATM strike...");
          const probe = await fetchPricing({
            ticker,
            replayDate: date,
            strike: 0,
            expiry,
            optionType: selectedRight,
          });
          if (currentFetchId !== fetchIdRef.current) return; // stale
          strike = probe.strikeChain.atmStrike;
          console.log("[pricing-effect] ATM resolved:", strike);
        }

        // Main pricing call with resolved strike
        console.log("[pricing-effect] Fetching:", {
          ticker,
          strike,
          right: selectedRight,
          expiry: expiry.toISOString(),
        });
        const pricing = await fetchPricing({
          ticker,
          replayDate: date,
          strike,
          expiry,
          optionType: selectedRight,
        });
        if (currentFetchId !== fetchIdRef.current) return; // stale

        // ─── Process results ────────────────────────────────────────
        setLastPricing(pricing);

        // Available expiries for UI chips
        const expOpts: ExpiryOption[] = pricing.expiries.map((e) => ({
          date: e.date instanceof Date ? e.date.toISOString() : String(e.date),
          label: e.label,
          dte: e.dte,
          type: e.type,
        }));
        setAvailableExpiries(expOpts);

        // Chain data for strike picker
        const chain = pricingToChainData(
          ticker,
          date,
          entryTime,
          pricing,
          pricing.strikeChain.atmStrike
        );
        setChainData(chain);

        // Replay result
        const atmPremium =
          pricing.bars.length > 0 ? pricing.bars[0].open : 1.0;
        const contract: SelectedContract = {
          ticker,
          date,
          entryTime,
          expiration:
            pricing.classification.dteBucket === "0DTE" ? "0dte" : "friday",
          strike,
          right: selectedRight,
          entryPremium: +atmPremium.toFixed(2),
          confidence: "Med",
        };

        const result = pricingToReplayResult(contract, pricing);
        console.log("[pricing-effect] Result:", {
          bars: result.sameDayPoints.length,
          entry: result.metrics.entryPremium,
          exitPL: result.metrics.exitAtClosePL,
        });
        setReplayResult(result);
        setStep("replay");

        // Cache entry day data (with full cache key)
        const key = dayCacheKey(date, selectedRight, strike, expiryMs);
        dayCacheRef.current.set(key, {
          points: result.sameDayPoints,
          dte: result.metrics.dteAtEntry,
        });

        // Scroll to replay section on initial load
        if (scrollOnNextResult.current) {
          scrollOnNextResult.current = false;
          setTimeout(() => {
            replayRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }, 100);
        }

        // ─── Fetch insights async (non-blocking, fire-and-forget) ───
        const prices = result.sameDayPoints.map((p) => p.price);
        fetchInsights({
          ticker,
          date,
          entryTime,
          strike,
          right: selectedRight,
          entryPremium: contract.entryPremium,
          exitPL: result.metrics.exitAtClosePL,
          exitPLPct: result.metrics.exitAtClosePLPct,
          maxProfit: result.metrics.maxProfit,
          maxProfitPct: result.metrics.maxProfitPct,
          maxProfitTime: result.metrics.maxProfitTime,
          maxDrawdown: result.metrics.maxDrawdown,
          maxDrawdownPct: result.metrics.maxDrawdownPct,
          underlyingStart: prices[0] ?? 0,
          underlyingEnd: prices[prices.length - 1] ?? 0,
          underlyingHigh: prices.length > 0 ? Math.max(...prices) : 0,
          underlyingLow: prices.length > 0 ? Math.min(...prices) : 0,
        })
          .then((insightsResult) => {
            if (currentFetchId !== fetchIdRef.current) return;
            if (insightsResult.insights.length > 0) {
              setReplayResult((prev) =>
                prev
                  ? {
                      ...prev,
                      insights: insightsResult.insights,
                      insightsSource: insightsResult.source,
                    }
                  : prev
              );
            }
          })
          .catch(() => {});
      } catch (err) {
        if (currentFetchId !== fetchIdRef.current) return; // stale
        console.error("[pricing-effect] Error:", err);
        setError("Failed to load pricing data. Please try again.");
      } finally {
        if (currentFetchId === fetchIdRef.current) {
          setLoading(false);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [ticker, date, entryTime, selectedRight, expiryMs, selectedStrike]);

  // ─── Multi-day: fetch data for a non-entry day ────────────────────
  const handleViewedDateChange = useCallback(
    async (newDate: string) => {
      setViewedDate(newDate);

      // If it's the entry day, use the existing sameDayPoints
      if (newDate === date) {
        setViewedDayPoints(null); // null = use sameDayPoints from result
        setViewedDayDTE(replayResult?.metrics.dteAtEntry);
        setThetaDecayPrice(undefined);
        return;
      }

      // Use the resolved strike from the result (NOT selectedStrike which may be 0)
      const resolvedStrike = replayResult?.contract.strike;
      if (!ticker || !currentExpiry || !resolvedStrike) return;

      // Build cache key with ALL pricing params
      const key = dayCacheKey(newDate, selectedRight, resolvedStrike, currentExpiry.getTime());

      // Check cache
      const cached = dayCacheRef.current.get(key);
      if (cached) {
        setViewedDayPoints(cached.points);
        setViewedDayDTE(cached.dte);
        if (replayResult) {
          const daysFromEntry = replayResult.metrics.dteAtEntry - cached.dte;
          const thetaPrice = replayResult.metrics.entryPremium +
            replayResult.metrics.thetaAtEntry * daysFromEntry;
          setThetaDecayPrice(Math.max(0.01, thetaPrice));
        }
        return;
      }

      // Check if data is available (not future)
      const today = new Date().toISOString().slice(0, 10);
      if (newDate >= today) {
        setViewedDayPoints([]);
        setViewedDayDTE(undefined);
        return;
      }

      // Fetch pricing for the new day
      const currentDayFetchId = ++dayFetchIdRef.current;
      setViewedDayLoading(true);

      try {
        const pricing = await fetchPricing({
          ticker,
          replayDate: newDate,
          strike: resolvedStrike,
          expiry: currentExpiry,
          optionType: selectedRight,
        });
        if (currentDayFetchId !== dayFetchIdRef.current) return; // stale

        // Convert bars to points using the ORIGINAL entry premium
        const entryPremium = replayResult?.metrics.entryPremium ?? 1.0;
        const points = barsToTimePoints(pricing.bars, entryPremium);

        // Compute DTE for this day
        const msPerDay = 86400000;
        const dayDate = new Date(newDate + "T12:00:00Z");
        const dte = Math.max(0, Math.round(
          (currentExpiry.getTime() - dayDate.getTime()) / msPerDay
        ));

        // Cache with full key
        dayCacheRef.current.set(key, { points, dte });

        if (currentDayFetchId !== dayFetchIdRef.current) return; // stale
        setViewedDayPoints(points);
        setViewedDayDTE(dte);

        // Approximate theta decay line
        if (replayResult) {
          const daysFromEntry = replayResult.metrics.dteAtEntry - dte;
          const thetaPrice = replayResult.metrics.entryPremium +
            replayResult.metrics.thetaAtEntry * daysFromEntry;
          setThetaDecayPrice(Math.max(0.01, thetaPrice));
        }
      } catch (err) {
        if (currentDayFetchId !== dayFetchIdRef.current) return; // stale
        console.error("[day-fetch] Error:", err);
        setViewedDayPoints([]);
      } finally {
        if (currentDayFetchId === dayFetchIdRef.current) {
          setViewedDayLoading(false);
        }
      }
    },
    [date, ticker, currentExpiry, selectedRight, replayResult]
  );

  // ─── Exit time handler (placeholder — stores for future deep dive) ─
  const handleExitChange = useCallback((exitTime: string, exitDate: string) => {
    console.log("[exit-change]", { exitTime, exitDate });
    // TODO: compute actual P&L at exit point and pass to SummaryCards
  }, []);

  // ─── Event handlers (set state only — useEffect handles fetching) ──

  /** Initial load from MomentPicker */
  const handleLoadChain = useCallback(
    (selection: MomentSelection) => {
      if (!checkAndIncrement()) {
        setShowPaywall(true);
        return;
      }
      console.log("[handleLoadChain]", selection);
      setMoment(selection);
      setCurrentExpiry(resolveDefaultExpiry(selection.date));
      setSelectedStrike(0); // ATM
      setReplayResult(null);
      setError(null);
      scrollOnNextResult.current = true;
    },
    [checkAndIncrement]
  );

  /** Toggle call/put — immediate visual feedback, useEffect re-prices */
  const handleToggleRight = useCallback((right: Right) => {
    setSelectedRight(right);
  }, []);

  /** Expiry change from replay chips (receives a Date) */
  const handleExpiryChange = useCallback((expiryDate: Date) => {
    setCurrentExpiry(expiryDate);
  }, []);

  /** Expiration change from chain snapshot (converts Expiration → Date) */
  const handleExpirationChange = useCallback(
    (exp: Expiration) => {
      if (!moment) return;
      const refDate = new Date(moment.date + "T12:00:00Z");
      let expiry: Date;
      if (exp === "0dte") {
        expiry = refDate;
      } else {
        const dayOfWeek = refDate.getUTCDay();
        const daysToFriday = (5 - dayOfWeek + 7) % 7 || 7;
        expiry = new Date(refDate);
        expiry.setUTCDate(expiry.getUTCDate() + daysToFriday);
      }
      setCurrentExpiry(expiry);
    },
    [moment]
  );

  /** User picks a specific strike from the chain snapshot */
  const handleReplayContract = useCallback((contract: SelectedContract) => {
    setSelectedStrike(contract.strike);
    setSelectedRight(contract.right);
    scrollOnNextResult.current = true;
  }, []);

  const handlePickAnother = useCallback(() => {
    setStep("chain");
    setTimeout(() => {
      chainRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, []);

  const handleBackToReplay = useCallback(() => {
    if (!replayResult) return;
    setStep("replay");
    setTimeout(() => {
      replayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, [replayResult]);

  const handleNewBacktest = useCallback(() => {
    setStep("moment");
    setChainData(null);
    setReplayResult(null);
    setMoment(null);
    setLastPricing(null);
    setCurrentExpiry(null);
    setSelectedStrike(0);
    setAvailableExpiries([]);
    setError(null);
    setViewedDate("");
    setViewedDayPoints(null);
    setViewedDayDTE(undefined);
    setThetaDecayPrice(undefined);
    dayCacheRef.current.clear();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Show "Loading..." in MomentPicker only during the first load (no prior results)
  const isInitialLoading = loading && !lastPricing;

  return (
    <>
      <main className="min-h-screen px-4 pb-16 pt-[96px] md:px-6">
        <div className="mx-auto max-w-content">
          {/* Page header */}
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <h1 className="text-2xl font-bold text-text-primary">
                AI Backtesting
              </h1>
              {chainData && (
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-blue-500/10 text-blue-400">
                  Synthetic Pricing Engine
                </span>
              )}
            </div>
            <p className="text-[15px] leading-relaxed text-text-secondary">
              Choose calls or puts, pick a contract, and see how much profit
              you would have made.
            </p>
          </div>

          {/* 3-step vertical flow */}
          <div className="space-y-5">
            {/* Step 1 — always visible */}
            <MomentPicker
              onLoadChain={handleLoadChain}
              loading={isInitialLoading}
              selectedRight={selectedRight}
              onRightChange={handleToggleRight}
            />

            {/* Step 2 — chain snapshot (only when user picks another contract) */}
            <PaywallBlur isBlurred={isLimitReached} onUnlock={() => setShowPaywall(true)}>
              <AnimatePresence>
                {chainData && step === "chain" && (
                  <motion.div
                    ref={chainRef}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ChainSnapshot
                      chain={chainData}
                      onExpirationChange={handleExpirationChange}
                      onReplayContract={handleReplayContract}
                      onBackToReplay={replayResult ? handleBackToReplay : undefined}
                      loading={loading}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Step 3 — contract replay */}
              <AnimatePresence>
                {replayResult && step === "replay" && (
                  <motion.div
                    ref={replayRef}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ContractReplay
                      result={replayResult}
                      onNewBacktest={handleNewBacktest}
                      onPickAnother={handlePickAnother}
                      onToggleRight={handleToggleRight}
                      selectedRight={selectedRight}
                      availableExpiries={availableExpiries}
                      selectedExpiryISO={currentExpiry?.toISOString()}
                      onExpiryChange={handleExpiryChange}
                      loading={loading}
                      error={error}
                      tradingDays={tradingDays}
                      viewedDate={viewedDate}
                      onViewedDateChange={handleViewedDateChange}
                      viewedDayPoints={viewedDayPoints}
                      viewedDayLoading={viewedDayLoading}
                      viewedDayDTE={viewedDayDTE}
                      thetaDecayPrice={thetaDecayPrice}
                      onExitChange={handleExitChange}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </PaywallBlur>
          </div>
        </div>
      </main>

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        reason={limitReason ?? "backtests"}
      />
    </>
  );
}
