"use client";

import { useState, useRef, useCallback } from "react";
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
} from "@/lib/engine/types";
import type { OptionPricingResult } from "@/lib/pricing/types";
import {
  fetchPricing,
  resolveDefaultExpiry,
  pricingToChainData,
  pricingToReplayResult,
  fetchInsights,
} from "@/lib/engine/fetch-chain";

type Step = "moment" | "chain" | "replay";

export default function BacktestingPage() {
  const [step, setStep] = useState<Step>("moment");
  const [chainData, setChainData] = useState<ChainData | null>(null);
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);
  const [loadingChain, setLoadingChain] = useState(false);
  const [loadingReplay, setLoadingReplay] = useState(false);
  const [moment, setMoment] = useState<MomentSelection | null>(null);
  const [selectedRight, setSelectedRight] = useState<Right>("call");
  const [showPaywall, setShowPaywall] = useState(false);
  // Cache the latest pricing result for re-use when toggling right / picking strikes
  const [lastPricing, setLastPricing] = useState<OptionPricingResult | null>(null);
  const [currentExpiry, setCurrentExpiry] = useState<Date | null>(null);
  const [availableExpiries, setAvailableExpiries] = useState<ExpiryOption[]>([]);
  const [loadingExpiry, setLoadingExpiry] = useState(false);

  const { checkAndIncrement, isLimitReached, limitReason } = useGate();

  const chainRef = useRef<HTMLDivElement>(null);
  const replayRef = useRef<HTMLDivElement>(null);

  /** Run the pricing engine and display results */
  const runPricingAndDisplay = useCallback(
    async (
      ticker: string,
      date: string,
      entryTime: string,
      strike: number,
      expiry: Date,
      right: Right
    ) => {
      const optionType = right;

      console.log("[runPricingAndDisplay] Calling fetchPricing:", { ticker, date, strike, expiry: expiry.toISOString(), optionType });
      const pricing = await fetchPricing({
        ticker,
        replayDate: date,
        strike,
        expiry,
        optionType,
      });
      console.log("[runPricingAndDisplay] Got pricing:", { bars: pricing.bars.length, atmStrike: pricing.strikeChain.atmStrike, iv: pricing.ivUsed });

      setLastPricing(pricing);

      // Store available expiries for the UI chips
      const expOpts: ExpiryOption[] = pricing.expiries.map((e) => ({
        date: e.date instanceof Date ? e.date.toISOString() : String(e.date),
        label: e.label,
        dte: e.dte,
        type: e.type,
      }));
      setAvailableExpiries(expOpts);

      // Build chain data for the strike picker
      const chain = pricingToChainData(
        ticker,
        date,
        entryTime,
        pricing,
        pricing.strikeChain.atmStrike // use ATM as underlying proxy
      );
      setChainData(chain);

      // Build contract for replay
      const atmPremium = pricing.bars.length > 0 ? pricing.bars[0].open : 1.0;
      const contract: SelectedContract = {
        ticker,
        date,
        entryTime,
        expiration: pricing.classification.dteBucket === "0DTE" ? "0dte" : "friday",
        strike,
        right,
        entryPremium: +atmPremium.toFixed(2),
        confidence: "Med",
      };

      const result = pricingToReplayResult(contract, pricing);
      console.log("[runPricingAndDisplay] ReplayResult:", { points: result.sameDayPoints.length, entryPremium: result.metrics.entryPremium, exitPL: result.metrics.exitAtClosePL });
      setReplayResult(result);
      setStep("replay");

      setTimeout(() => {
        replayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);

      // Fetch AI insights asynchronously
      const prices = result.sameDayPoints.map((p) => p.price);
      try {
        const insightsResult = await fetchInsights({
          ticker,
          date,
          entryTime,
          strike,
          right,
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
        });

        if (insightsResult.insights.length > 0) {
          setReplayResult((prev) =>
            prev ? { ...prev, insights: insightsResult.insights, insightsSource: insightsResult.source } : prev
          );
        }
      } catch {
        // non-critical
      }
    },
    []
  );

  /** Initial load: fetch pricing for ATM call at default expiry */
  const handleLoadChain = useCallback(
    async (selection: MomentSelection) => {
      if (!checkAndIncrement()) {
        setShowPaywall(true);
        return;
      }

      console.log("[handleLoadChain] Selection:", selection);
      setMoment(selection);
      setLoadingChain(true);
      setReplayResult(null);

      try {
        const expiry = resolveDefaultExpiry(selection.date);
        console.log("[handleLoadChain] Default expiry:", expiry.toISOString());
        setCurrentExpiry(expiry);

        // First call: get pricing for ATM strike (use 0 as placeholder, engine will snap)
        // We need the ATM strike first — fetch a quick pricing to get strikeChain
        const initPricing = await fetchPricing({
          ticker: selection.ticker,
          replayDate: selection.date,
          strike: 0, // will be resolved to ATM by the engine's fallback
          expiry,
          optionType: selectedRight,
        });

        const atmStrike = initPricing.strikeChain.atmStrike;
        console.log("[handleLoadChain] ATM strike resolved:", atmStrike);
        setLastPricing(initPricing);
        setCurrentExpiry(expiry);

        // Now fetch the real ATM pricing
        await runPricingAndDisplay(
          selection.ticker,
          selection.date,
          selection.entryTime,
          atmStrike,
          expiry,
          selectedRight
        );
      } catch (err) {
        console.error("[handleLoadChain] Error:", err);
      } finally {
        setLoadingChain(false);
        setLoadingReplay(false);
      }
    },
    [selectedRight, checkAndIncrement, runPricingAndDisplay]
  );

  /** Toggle call/put: re-run pricing for same strike with new direction */
  const handleToggleRight = useCallback(
    async (right: Right) => {
      setSelectedRight(right);
      if (!moment || !currentExpiry) return;

      const strike = lastPricing?.strikeChain.atmStrike ?? replayResult?.contract.strike;
      if (!strike) return;

      setLoadingReplay(true);
      try {
        await runPricingAndDisplay(
          moment.ticker,
          moment.date,
          moment.entryTime,
          strike,
          currentExpiry,
          right
        );
      } finally {
        setLoadingReplay(false);
      }
    },
    [moment, currentExpiry, lastPricing, replayResult, runPricingAndDisplay]
  );

  /** Expiration change from chain snapshot */
  const handleExpirationChange = useCallback(
    async (exp: Expiration) => {
      if (!moment) return;
      setLoadingChain(true);

      // Resolve expiry date from the Expiration mode
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

      try {
        const strike = lastPricing?.strikeChain.atmStrike ?? 0;
        await runPricingAndDisplay(
          moment.ticker,
          moment.date,
          moment.entryTime,
          strike,
          expiry,
          selectedRight
        );
        setStep("chain");
      } finally {
        setLoadingChain(false);
      }
    },
    [moment, lastPricing, selectedRight, runPricingAndDisplay]
  );

  /** Expiry change from the replay view expiry chips */
  const handleReplayExpiryChange = useCallback(
    async (expiryDate: Date) => {
      if (!moment) return;
      setLoadingExpiry(true);
      setCurrentExpiry(expiryDate);

      try {
        const strike = lastPricing?.strikeChain.atmStrike ?? replayResult?.contract.strike ?? 0;
        await runPricingAndDisplay(
          moment.ticker,
          moment.date,
          moment.entryTime,
          strike,
          expiryDate,
          selectedRight
        );
      } finally {
        setLoadingExpiry(false);
      }
    },
    [moment, lastPricing, replayResult, selectedRight, runPricingAndDisplay]
  );

  /** User selects a specific contract from the chain snapshot */
  const handleReplayContract = useCallback(
    async (contract: SelectedContract) => {
      if (!moment || !currentExpiry) return;
      setLoadingReplay(true);
      try {
        await runPricingAndDisplay(
          contract.ticker,
          contract.date,
          contract.entryTime,
          contract.strike,
          currentExpiry,
          contract.right
        );
      } finally {
        setLoadingReplay(false);
      }
    },
    [moment, currentExpiry, runPricingAndDisplay]
  );

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
    setAvailableExpiries([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

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
              loading={loadingChain}
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
                      loading={loadingReplay}
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
                      availableExpiries={availableExpiries}
                      selectedExpiryISO={currentExpiry?.toISOString()}
                      onExpiryChange={handleReplayExpiryChange}
                      loadingExpiry={loadingExpiry}
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
