"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MomentPicker } from "@/components/backtesting/moment-picker";
import { ChainSnapshot } from "@/components/backtesting/chain-snapshot";
import { ContractReplay } from "@/components/backtesting/contract-replay";
import type {
  MomentSelection,
  Expiration,
  ChainData,
  SelectedContract,
  ReplayResult,
  Right,
} from "@/lib/engine/types";
import type { IntradayBar } from "@/lib/services/yahoo-finance";
import { fetchLiveChain, fetchIntradayPrices, fetchInsights } from "@/lib/engine/fetch-chain";
import { replayContract } from "@/lib/engine/replay";

type Step = "moment" | "chain" | "replay";

export default function BacktestingPage() {
  const [step, setStep] = useState<Step>("moment");
  const [chainData, setChainData] = useState<ChainData | null>(null);
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);
  const [loadingChain, setLoadingChain] = useState(false);
  const [loadingReplay, setLoadingReplay] = useState(false);
  const [moment, setMoment] = useState<MomentSelection | null>(null);
  const [dataSource, setDataSource] = useState<"yahoo" | "synthetic">("synthetic");
  const [intradayBars, setIntradayBars] = useState<IntradayBar[]>([]);
  const [selectedRight, setSelectedRight] = useState<Right>("call");

  const chainRef = useRef<HTMLDivElement>(null);
  const replayRef = useRef<HTMLDivElement>(null);

  /** Run replay and fetch AI insights for a contract */
  const runReplayWithInsights = useCallback(
    async (contract: SelectedContract, bars: IntradayBar[]) => {
      // Run replay synchronously with real data
      const result = replayContract(contract, bars.length > 0 ? bars : undefined);
      setReplayResult(result);
      setStep("replay");
      setLoadingReplay(false);

      setTimeout(() => {
        replayRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);

      // Fetch AI insights asynchronously (non-blocking)
      const underlyingPrices = bars.length > 0
        ? bars.map((b) => b.close)
        : result.sameDayPoints.map((p) => p.price);

      try {
        const insightsResult = await fetchInsights({
          ticker: contract.ticker,
          date: contract.date,
          entryTime: contract.entryTime,
          strike: contract.strike,
          right: contract.right,
          entryPremium: contract.entryPremium,
          exitPL: result.metrics.exitAtClosePL,
          exitPLPct: result.metrics.exitAtClosePLPct,
          maxProfit: result.metrics.maxProfit,
          maxProfitPct: result.metrics.maxProfitPct,
          maxProfitTime: result.metrics.maxProfitTime,
          maxDrawdown: result.metrics.maxDrawdown,
          maxDrawdownPct: result.metrics.maxDrawdownPct,
          underlyingStart: underlyingPrices[0] ?? 0,
          underlyingEnd: underlyingPrices[underlyingPrices.length - 1] ?? 0,
          underlyingHigh: Math.max(...underlyingPrices),
          underlyingLow: Math.min(...underlyingPrices),
        });

        if (insightsResult.insights.length > 0) {
          setReplayResult((prev) =>
            prev ? { ...prev, insights: insightsResult.insights, insightsSource: insightsResult.source } : prev
          );
        }
      } catch {
        // Insights are non-critical — replay still works without them
      }
    },
    []
  );

  /** Replay an ATM contract for a given right (call or put) using current chain */
  const replayAtm = useCallback(
    (chain: ChainData, right: Right, bars: IntradayBar[]) => {
      const rows = right === "call" ? chain.calls : chain.puts;
      const atmRow = rows.find((r) => r.isATM);
      if (!atmRow) return;

      const atmContract: SelectedContract = {
        ticker: chain.ticker,
        date: chain.date,
        entryTime: chain.entryTime,
        expiration: chain.expiration,
        strike: atmRow.strike,
        right,
        entryPremium: atmRow.premium,
        confidence: atmRow.confidence,
      };

      setLoadingReplay(true);
      setTimeout(() => {
        runReplayWithInsights(atmContract, bars);
      }, 300);
    },
    [runReplayWithInsights]
  );

  const handleLoadChain = useCallback(
    async (selection: MomentSelection) => {
      setMoment(selection);
      setLoadingChain(true);
      setReplayResult(null);

      // Fetch chain and intraday data in parallel
      const [chainResult, intradayResult] = await Promise.all([
        fetchLiveChain(selection.ticker, selection.date, selection.entryTime, "0dte"),
        fetchIntradayPrices(selection.ticker, selection.date),
      ]);

      setChainData(chainResult.chain);
      setDataSource(chainResult.source);
      setIntradayBars(intradayResult.bars);
      setLoadingChain(false);

      // Auto-replay ATM contract with the selected direction
      replayAtm(chainResult.chain, selectedRight, intradayResult.bars);
    },
    [replayAtm, selectedRight]
  );

  const handleToggleRight = useCallback(
    (right: Right) => {
      setSelectedRight(right);
      if (!chainData) return;
      replayAtm(chainData, right, intradayBars);
    },
    [chainData, intradayBars, replayAtm]
  );

  const handleExpirationChange = useCallback(
    async (exp: Expiration) => {
      if (!moment) return;
      setLoadingChain(true);

      const { chain, source } = await fetchLiveChain(
        moment.ticker,
        moment.date,
        moment.entryTime,
        exp
      );

      setChainData(chain);
      setDataSource(source);
      setLoadingChain(false);
      setReplayResult(null);
      setStep("chain");
    },
    [moment]
  );

  const handleReplayContract = useCallback(
    (contract: SelectedContract) => {
      setLoadingReplay(true);
      setTimeout(() => {
        runReplayWithInsights(contract, intradayBars);
      }, 400);
    },
    [intradayBars, runReplayWithInsights]
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
    setDataSource("synthetic");
    setIntradayBars([]);
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
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    dataSource === "yahoo"
                      ? "bg-green-500/10 text-green-400"
                      : "bg-yellow-500/10 text-yellow-400"
                  }`}
                >
                  {dataSource === "yahoo" ? "Live Yahoo Data" : "Synthetic Estimates"}
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
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </>
  );
}
