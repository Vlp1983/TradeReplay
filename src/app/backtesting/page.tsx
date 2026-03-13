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

interface UnderlyingPoint {
  time: string;
  label: string;
  underlyingPrice: number;
}

export default function BacktestingPage() {
  // ─── Core pricing params (changes trigger re-pricing via useEffect) ──
  const [moment, setMoment] = useState<MomentSelection | null>(null);
  const [selectedRight, setSelectedRight] = useState<Right>("call");
  const [currentExpiry, setCurrentExpiry] = useState<Date | null>(null);
  const [selectedStrike, setSelectedStrike] = useState<number>(0); // 0 = auto-resolve ATM
  const [entryTimeOverride, setEntryTimeOverride] = useState<string | undefined>(undefined);

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

  // ─── Underlying overlay state ─────────────────────────────────────
  const [underlyingPoints, setUnderlyingPoints] = useState<UnderlyingPoint[]>([]);
  const [underlyingLoading, setUnderlyingLoading] = useState(false);
  const underlyingCacheRef = useRef<Map<string, UnderlyingPoint[]>>(new Map());

  // ─── Exit P&L state ───────────────────────────────────────────────
  const [exitPL, setExitPL] = useState<{ premium: number; dollar: number; pct: number } | null>(null);
  const [exitSelection, setExitSelection] = useState<{ time: string; date: string } | null>(null);

  // ─── UI state ─────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("moment");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  const { checkAndIncrement, isLimitReached, limitReason } = useGate();

  const chainRef = useRef<HTMLDivElement>(null);
  const replayRef = useRef<HTMLDivElement>(null);
  const mainFetchId = useRef(0);
  const dayFetchId = useRef(0);
  const scrollOnNextResult = useRef(false);

  // Safety: reset loading on unmount to prevent stuck state
  useEffect(() => {
    return () => { setLoading(false); };
  }, []);

  // Safety: if loading has been true for 15s with no result, force reset
  useEffect(() => {
    if (!loading) return;
    const timeout = setTimeout(() => {
      setLoading(false);
      setError("Request timed out. Please try again.");
    }, 15000);
    return () => clearTimeout(timeout);
  }, [loading]);

  // Derive stable primitives for useEffect deps (avoids object reference issues)
  const ticker = moment?.ticker;
  const date = moment?.date;
  const entryTime = moment?.entryTime;
  const expiryMs = currentExpiry?.getTime() ?? null;

  // Ref to track current params — avoids stale closures in debounced fetch
  const paramsRef = useRef({ ticker, date, entryTime, selectedRight, expiryMs, selectedStrike });
  useEffect(() => {
    paramsRef.current = { ticker, date, entryTime, selectedRight, expiryMs, selectedStrike };
  }, [ticker, date, entryTime, selectedRight, expiryMs, selectedStrike]);

  // Determine if current expiry is 0DTE
  const is0DTE = useMemo(() => {
    if (!date || expiryMs == null) return false;
    const expiryStr = new Date(expiryMs).toISOString().slice(0, 10);
    return expiryStr === date;
  }, [date, expiryMs]);

  // Compute trading days for multi-day navigation
  const tradingDays = useMemo(() => {
    if (!date || expiryMs == null) return [];
    const expiryStr = new Date(expiryMs).toISOString().slice(0, 10);
    if (expiryStr === date) return []; // 0DTE — no multi-day nav
    return getTradingDaysBetween(date, expiryStr);
  }, [date, expiryMs]);

  // ─── Compute exit P&L from cached bar data ────────────────────────
  useEffect(() => {
    if (!exitSelection || !replayResult) {
      setExitPL(null);
      return;
    }

    const { time: exitTime, date: exitDate } = exitSelection;
    const entryPremium = replayResult.metrics.entryPremium;

    // Find the right day's points
    let points: TimePoint[];
    if (exitDate === date) {
      points = replayResult.sameDayPoints;
    } else {
      const resolvedStrike = replayResult?.contract.strike ?? 0;
      const key = `${ticker}-${date}-${resolvedStrike}-${expiryMs}-${selectedRight}-${exitDate}`;
      const cached = dayCacheRef.current.get(key);
      if (cached) {
        points = cached.points;
      } else {
        // Data not cached yet — can't compute
        setExitPL(null);
        return;
      }
    }

    if (points.length === 0) {
      setExitPL(null);
      return;
    }

    // Find the bar closest to exit time
    let closest = points[0];
    for (const pt of points) {
      if (pt.time <= exitTime) closest = pt;
    }

    const exitPremium = closest.price;
    const plDollar = +((exitPremium - entryPremium) * 100).toFixed(0);
    const plPct = entryPremium > 0.01
      ? +(((exitPremium - entryPremium) / entryPremium) * 100).toFixed(1)
      : 0;

    setExitPL({ premium: exitPremium, dollar: plDollar, pct: plPct });
  }, [exitSelection, replayResult, date, ticker, expiryMs, selectedRight]);

  // ─── Core pricing effect (300ms debounce) ──────────────────────────
  //
  // Fires when: ticker, date, entryTime, selectedRight, expiryMs, or selectedStrike change.
  // Does NOT fire on viewedDate changes (that's handled by handleViewedDateChange).
  //
  useEffect(() => {
    if (!ticker || !date || !entryTime || expiryMs == null) return;

    const id = ++mainFetchId.current;
    // Invalidate any pending day fetches
    dayFetchId.current = 0;
    const expiry = new Date(expiryMs);

    // Clear error immediately (before debounce delay)
    setError(null);
    // Only clear replayResult on first load — keep old chart visible during re-fetch
    if (!lastPricing) {
      setReplayResult(null);
    }

    // Reset multi-day cache and underlying cache on new pricing params
    dayCacheRef.current.clear();
    underlyingCacheRef.current.clear();
    setUnderlyingPoints([]);

    // Reset exit P&L since bars changed
    setExitPL(null);

    setViewedDayPoints(null);
    setViewedDayDTE(undefined);
    setThetaDecayPrice(undefined);

    const timer = setTimeout(async () => {
      // Read fresh params from ref to avoid stale closures after debounce
      const p = paramsRef.current;
      const freshTicker = p.ticker!;
      const freshDate = p.date!;
      const freshRight = p.selectedRight;
      const freshExpiry = new Date(p.expiryMs!);

      setLoading(true);
      try {
        let strike = p.selectedStrike;

        // Resolve ATM strike if needed (0 = "auto-ATM")
        if (strike === 0) {
          const probe = await fetchPricing({
            ticker: freshTicker,
            replayDate: freshDate,
            strike: 0,
            expiry: freshExpiry,
            optionType: freshRight,
          });
          if (id !== mainFetchId.current) return;
          strike = probe.strikeChain.atmStrike;
        }

        // Main pricing call with resolved strike
        const pricing = await fetchPricing({
          ticker: freshTicker,
          replayDate: freshDate,
          strike,
          expiry: freshExpiry,
          optionType: freshRight,
        });
        if (id !== mainFetchId.current) return;

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
          freshTicker,
          freshDate,
          p.entryTime!,
          pricing,
          pricing.strikeChain.atmStrike
        );
        setChainData(chain);

        // Replay result
        const atmPremium =
          pricing.bars.length > 0 ? pricing.bars[0].open : 1.0;
        const contract: SelectedContract = {
          ticker: freshTicker,
          date: freshDate,
          entryTime: p.entryTime!,
          expiration:
            pricing.classification.dteBucket === "0DTE" ? "0dte" : "friday",
          strike,
          right: freshRight,
          entryPremium: +atmPremium.toFixed(2),
          confidence: "Med",
        };

        const result = pricingToReplayResult(contract, pricing);
        if (id !== mainFetchId.current) return;
        setReplayResult(result);
        setError(null);
        setStep("replay");

        // Cache entry day data with full 6-part key
        const freshExpiryMs = p.expiryMs!;
        const key = `${freshTicker}-${freshDate}-${strike}-${freshExpiryMs}-${freshRight}-${freshDate}`;
        dayCacheRef.current.set(key, {
          points: result.sameDayPoints,
          dte: result.metrics.dteAtEntry,
        });

        // Set viewedDate to entry day only if not already set to a valid day
        // This preserves the current day view on call/put toggle (item 2)
        setViewedDate((prev) => {
          if (!prev || !tradingDays.length) return freshDate;
          // If previously viewing a day in the new trading days range, keep it
          const newExpiryStr = new Date(freshExpiryMs).toISOString().slice(0, 10);
          const newDays = getTradingDaysBetween(freshDate, newExpiryStr);
          if (newDays.includes(prev)) return prev;
          return freshDate;
        });

        // If we're viewing a non-entry day, fetch its data with the new optionType
        // This handles call/put toggle while on a different day
        const currentViewed = viewedDate || freshDate;
        if (currentViewed !== freshDate && tradingDays.includes(currentViewed)) {
          // Trigger a day fetch for the viewed date after main pricing completes
          // We do this via the handleViewedDateChange flow
          setTimeout(() => {
            if (id === mainFetchId.current) {
              handleViewedDateChangeInternal(currentViewed, result, strike);
            }
          }, 50);
        }

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
          ticker: freshTicker,
          date: freshDate,
          entryTime: p.entryTime!,
          strike,
          right: freshRight,
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
            if (id !== mainFetchId.current) return;
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
      } catch {
        if (id !== mainFetchId.current) return;
        setError("Failed to load pricing data. Please try again.");
      } finally {
        if (id === mainFetchId.current) {
          setLoading(false);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, date, entryTime, selectedRight, expiryMs, selectedStrike]);

  // ─── Internal day fetch (used after main pricing completes for non-entry day) ─
  const handleViewedDateChangeInternal = useCallback(
    async (newDate: string, result: ReplayResult, resolvedStrike: number) => {
      if (!ticker || !currentExpiry) return;

      const key = `${ticker}-${date}-${resolvedStrike}-${currentExpiry.getTime()}-${selectedRight}-${newDate}`;
      const cached = dayCacheRef.current.get(key);
      if (cached) {
        setViewedDayPoints(cached.points);
        setViewedDayDTE(cached.dte);
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      if (newDate >= today) {
        setViewedDayPoints([]);
        return;
      }

      const id = ++dayFetchId.current;
      setViewedDayLoading(true);

      try {
        const pricing = await fetchPricing({
          ticker,
          replayDate: newDate,
          strike: resolvedStrike,
          expiry: currentExpiry,
          optionType: selectedRight,
        });
        if (id !== dayFetchId.current) return;

        const entryPremium = result.metrics.entryPremium;
        const points = barsToTimePoints(pricing.bars, entryPremium);

        const msPerDay = 86400000;
        const dayDate = new Date(newDate + "T12:00:00Z");
        const dte = Math.max(0, Math.round(
          (currentExpiry.getTime() - dayDate.getTime()) / msPerDay
        ));

        dayCacheRef.current.set(key, { points, dte });

        if (id !== dayFetchId.current) return;
        setViewedDayPoints(points);
        setViewedDayDTE(dte);

        if (result) {
          const daysFromEntry = result.metrics.dteAtEntry - dte;
          const thetaPrice = result.metrics.entryPremium +
            result.metrics.thetaAtEntry * daysFromEntry;
          setThetaDecayPrice(Math.max(0.01, thetaPrice));
        }
      } catch {
        if (id !== dayFetchId.current) return;
        setViewedDayPoints([]);
      } finally {
        if (id === dayFetchId.current) setViewedDayLoading(false);
      }
    },
    [ticker, date, currentExpiry, selectedRight]
  );

  // ─── Multi-day: fetch data for a non-entry day ────────────────────
  const handleViewedDateChange = useCallback(
    async (newDate: string) => {
      setViewedDate(newDate);

      // Clear underlying overlay when switching days
      setUnderlyingPoints([]);

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

      // Build cache key: ticker-replayDate-strike-expiry-optionType-viewedDate
      const key = `${ticker}-${date}-${resolvedStrike}-${currentExpiry.getTime()}-${selectedRight}-${newDate}`;

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
      const id = ++dayFetchId.current;
      setError(null);
      setViewedDayLoading(true);

      try {
        // DTE from viewedDate to expiry (not from original replayDate)
        const pricing = await fetchPricing({
          ticker,
          replayDate: newDate,
          strike: resolvedStrike,
          expiry: currentExpiry,
          optionType: selectedRight,
        });
        if (id !== dayFetchId.current) return;

        // Convert bars to points using the ORIGINAL entry premium
        const entryPremium = replayResult?.metrics.entryPremium ?? 1.0;
        const points = barsToTimePoints(pricing.bars, entryPremium);

        // Compute DTE from viewedDate to expiry
        const msPerDay = 86400000;
        const dayDate = new Date(newDate + "T12:00:00Z");
        const dte = Math.max(0, Math.round(
          (currentExpiry.getTime() - dayDate.getTime()) / msPerDay
        ));

        // Cache with full key
        dayCacheRef.current.set(key, { points, dte });

        if (id !== dayFetchId.current) return;
        setViewedDayPoints(points);
        setViewedDayDTE(dte);

        // Approximate theta decay line
        if (replayResult) {
          const daysFromEntry = replayResult.metrics.dteAtEntry - dte;
          const thetaPrice = replayResult.metrics.entryPremium +
            replayResult.metrics.thetaAtEntry * daysFromEntry;
          setThetaDecayPrice(Math.max(0.01, thetaPrice));
        }
      } catch {
        if (id !== dayFetchId.current) return;
        setError("Failed to load day data. Please try again.");
        setViewedDayPoints([]);
      } finally {
        if (id === dayFetchId.current) {
          setViewedDayLoading(false);
        }
      }
    },
    [date, ticker, currentExpiry, selectedRight, replayResult]
  );

  // ─── Underlying overlay fetch ──────────────────────────────────────
  const handleRequestUnderlying = useCallback(async () => {
    if (!ticker) return;
    const targetDate = viewedDate || date;
    if (!targetDate) return;

    // Check cache
    const cacheKey = `${ticker}-${targetDate}`;
    const cached = underlyingCacheRef.current.get(cacheKey);
    if (cached) {
      setUnderlyingPoints(cached);
      return;
    }

    setUnderlyingLoading(true);
    try {
      const res = await fetch(`/api/intraday?symbol=${encodeURIComponent(ticker)}&date=${targetDate}`);
      if (!res.ok) {
        setUnderlyingLoading(false);
        return;
      }
      const data = await res.json();
      const bars: { timestamp: number; close: number }[] = data.bars ?? [];

      const points: UnderlyingPoint[] = bars.map((bar) => {
        const d = new Date(bar.timestamp);
        const hour = d.getUTCHours() - 5;
        const minute = d.getUTCMinutes();
        let h12 = hour;
        const suffix = h12 >= 12 ? "PM" : "AM";
        if (h12 === 0) h12 = 12;
        else if (h12 > 12) h12 -= 12;
        return {
          time: `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
          label: `${h12}:${minute.toString().padStart(2, "0")} ${suffix}`,
          underlyingPrice: bar.close,
        };
      });

      underlyingCacheRef.current.set(cacheKey, points);
      setUnderlyingPoints(points);
    } catch {
      // Silently fail — underlying overlay is optional
    } finally {
      setUnderlyingLoading(false);
    }
  }, [ticker, viewedDate, date]);

  // ─── Exit time handler — computes P&L from cached bar data ─────────
  const handleExitChange = useCallback((exitTime: string, exitDate: string) => {
    setExitSelection({ time: exitTime, date: exitDate });
  }, []);

  // ─── Event handlers (set state only — useEffect handles fetching) ──

  /** Initial load from MomentPicker */
  const handleLoadChain = useCallback(
    (selection: MomentSelection) => {
      if (!checkAndIncrement()) {
        setShowPaywall(true);
        return;
      }
      // Invalidate all pending fetches
      mainFetchId.current++;
      dayFetchId.current = 0;
      // Full state reset before new replay
      setMoment(selection);
      setCurrentExpiry(resolveDefaultExpiry(selection.date));
      setSelectedStrike(0); // ATM
      setReplayResult(null);
      setChainData(null);
      setLastPricing(null);
      setLoading(false);
      setError(null);
      setViewedDate(selection.date);
      setViewedDayPoints(null);
      setViewedDayLoading(false);
      setViewedDayDTE(undefined);
      setThetaDecayPrice(undefined);
      setExitSelection(null);
      setExitPL(null);
      setUnderlyingPoints([]);
      setUnderlyingLoading(false);
      dayCacheRef.current.clear();
      underlyingCacheRef.current.clear();
      scrollOnNextResult.current = true;
    },
    [checkAndIncrement]
  );

  /** Auto-update params when user changes date/time/ticker after initial load (no button click) */
  const handleParamChange = useCallback(
    (selection: MomentSelection) => {
      const prevDate = moment?.date;
      const prevTicker = moment?.ticker;

      // Full reset when ticker or date changes (not just entry time)
      const majorChange = selection.ticker !== prevTicker || selection.date !== prevDate;

      if (majorChange) {
        mainFetchId.current++;
        dayFetchId.current = 0;
        setError(null);
        setExitSelection(null);
        setExitPL(null);
        setUnderlyingPoints([]);
        setUnderlyingLoading(false);
        dayCacheRef.current.clear();
        underlyingCacheRef.current.clear();
        setViewedDayPoints(null);
        setViewedDayDTE(undefined);
        setThetaDecayPrice(undefined);
      }

      setMoment(selection);

      if (selection.date !== prevDate) {
        setCurrentExpiry(resolveDefaultExpiry(selection.date));
        setSelectedStrike(0);
        setViewedDate(selection.date);
      }

      // Update paramsRef synchronously
      paramsRef.current = {
        ...paramsRef.current,
        ticker: selection.ticker,
        date: selection.date,
        entryTime: selection.entryTime,
      };
    },
    [moment?.date, moment?.ticker]
  );

  /** Toggle call/put — preserves viewedDate and old chart (overlay shows "Repricing...") */
  const handleToggleRight = useCallback((right: Right) => {
    // Update paramsRef synchronously before any async work
    paramsRef.current = { ...paramsRef.current, selectedRight: right };
    setSelectedRight(right);
    setError(null);
    // DON'T clear replayResult — old chart stays visible with loading overlay
    // Invalidate pending fetches — the useEffect on selectedRight will re-trigger
    mainFetchId.current++;
  }, []);

  /** Expiry change from replay chips — resets viewedDate to entry day (item 8) */
  const handleExpiryChange = useCallback((expiryDate: Date) => {
    setCurrentExpiry(expiryDate);
    // New expiry = new day range, reset to entry day
    if (date) setViewedDate(date);
    setExitSelection(null);
    setExitPL(null);

    // If switching to 0DTE, snap entry time to 11:30 if currently after
    if (moment) {
      const expiryStr = expiryDate.toISOString().slice(0, 10);
      const isNew0DTE = expiryStr === moment.date;
      if (isNew0DTE && moment.entryTime > "11:30") {
        setEntryTimeOverride("11:30");
        setMoment({ ...moment, entryTime: "11:30" });
      } else {
        setEntryTimeOverride(undefined);
      }
    }
  }, [moment, date]);

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
        let daysToFriday = (5 - dayOfWeek + 7) % 7;
        if (daysToFriday === 0) daysToFriday = 7;
        expiry = new Date(refDate);
        expiry.setUTCDate(expiry.getUTCDate() + daysToFriday);
      }
      setCurrentExpiry(expiry);
      if (date) setViewedDate(date);
    },
    [moment, date]
  );

  /** User picks a specific strike from the chain snapshot — preserves viewedDate (item 8) */
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
    // Invalidate pending fetches so they don't write stale state
    mainFetchId.current++;
    dayFetchId.current++;
    setStep("moment");
    setChainData(null);
    setReplayResult(null);
    setMoment(null);
    setLastPricing(null);
    setCurrentExpiry(null);
    setSelectedStrike(0);
    setAvailableExpiries([]);
    setLoading(false);
    setError(null);
    setViewedDate("");
    setViewedDayPoints(null);
    setViewedDayLoading(false);
    setViewedDayDTE(undefined);
    setThetaDecayPrice(undefined);
    setEntryTimeOverride(undefined);
    setUnderlyingPoints([]);
    setUnderlyingLoading(false);
    setExitSelection(null);
    setExitPL(null);
    dayCacheRef.current.clear();
    underlyingCacheRef.current.clear();
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
              onParamChange={lastPricing ? handleParamChange : undefined}
              loading={isInitialLoading}
              selectedRight={selectedRight}
              onRightChange={handleToggleRight}
              is0DTE={is0DTE}
              entryTimeOverride={entryTimeOverride}
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
                      exitPL={exitPL}
                      underlyingPoints={underlyingPoints}
                      underlyingLoading={underlyingLoading}
                      onRequestUnderlying={handleRequestUnderlying}
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
