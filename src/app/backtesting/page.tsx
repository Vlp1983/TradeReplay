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
      setStep("chain");
      setLoadingChain(false);

      setTimeout(() => {
        chainRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
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
          <div className="mb-6 flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">
                Options Backtesting
              </h1>
              <p className="text-[13px] text-text-muted">
                Select a moment, view the chain, replay the contract.
              </p>
            </div>
          </div>

          {/* 3-step vertical flow */}
          <div className="space-y-5">
            {/* Step 1 — always visible */}
            <MomentPicker
              onLoadChain={handleLoadChain}
              loading={loadingChain}
            />

            {/* Step 2 — chain snapshot */}
            <AnimatePresence>
              {chainData && step !== "moment" && (
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
