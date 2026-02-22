"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MomentPicker } from "@/components/backtesting/moment-picker";
import { ChainSnapshot } from "@/components/backtesting/chain-snapshot";
import { ContractReplay } from "@/components/backtesting/contract-replay";
import { Navbar } from "@/components/landing/navbar";

import type {
  MomentSelection,
  Expiration,
  ChainData,
  SelectedContract,
  ReplayResult,
} from "@/lib/engine/types";
import { generateChain } from "@/lib/engine/chain";
import { replayContract } from "@/lib/engine/replay";

type Step = "moment" | "chain" | "replay";

export default function BacktestingPage() {
  const [step, setStep] = useState<Step>("moment");
  const [chainData, setChainData] = useState<ChainData | null>(null);
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);
  const [loadingChain, setLoadingChain] = useState(false);
  const [loadingReplay, setLoadingReplay] = useState(false);
  const [moment, setMoment] = useState<MomentSelection | null>(null);

  const chainRef = useRef<HTMLDivElement>(null);
  const replayRef = useRef<HTMLDivElement>(null);

  const handleLoadChain = useCallback((selection: MomentSelection) => {
    setMoment(selection);
    setLoadingChain(true);
    setReplayResult(null);

    // Simulate async
    setTimeout(() => {
      const chain = generateChain(
        selection.ticker,
        selection.date,
        selection.entryTime,
        "0dte"
      );
      setChainData(chain);
      setLoadingChain(false);

      // Auto-replay the ATM call contract
      const atmRow = chain.calls.find((r) => r.isATM);
      if (atmRow) {
        const atmContract: SelectedContract = {
          ticker: chain.ticker,
          date: chain.date,
          entryTime: chain.entryTime,
          expiration: chain.expiration,
          strike: atmRow.strike,
          right: "call",
          entryPremium: atmRow.premium,
          confidence: atmRow.confidence,
        };

        setLoadingReplay(true);
        setTimeout(() => {
          const result = replayContract(atmContract);
          setReplayResult(result);
          setStep("replay");
          setLoadingReplay(false);

          setTimeout(() => {
            replayRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }, 100);
        }, 300);
      } else {
        // Fallback: show chain if no ATM found
        setStep("chain");
        setTimeout(() => {
          chainRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    }, 300);
  }, []);

  const handleExpirationChange = useCallback(
    (exp: Expiration) => {
      if (!moment) return;
      const chain = generateChain(
        moment.ticker,
        moment.date,
        moment.entryTime,
        exp
      );
      setChainData(chain);
      setReplayResult(null);
      setStep("chain");
    },
    [moment]
  );

  const handleReplayContract = useCallback((contract: SelectedContract) => {
    setLoadingReplay(true);

    setTimeout(() => {
      const result = replayContract(contract);
      setReplayResult(result);
      setStep("replay");
      setLoadingReplay(false);

      setTimeout(() => {
        replayRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }, 400);
  }, []);

  const handlePickAnother = useCallback(() => {
    // Keep replayResult so user can navigate back
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <>
      <Navbar />
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
                Options Backtesting
              </h1>
            </div>
            <p className="text-[15px] leading-relaxed text-text-secondary">
              Select a moment from the past, pick an options contract, and see
              how much profit you would have made. Ideal for backtesting
              callouts or trade strategies.
            </p>
          </div>

          {/* 3-step vertical flow */}
          <div className="space-y-5">
            {/* Step 1 — always visible */}
            <MomentPicker
              onLoadChain={handleLoadChain}
              loading={loadingChain}
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
