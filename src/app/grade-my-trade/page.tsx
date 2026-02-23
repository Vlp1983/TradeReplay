"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/landing/navbar";
import { TradeInputForm } from "@/components/grading/trade-input-form";
import type { TradeFormData } from "@/components/grading/trade-input-form";
import { TradeGradeCard } from "@/components/grading/trade-grade-card";
import { GradeInsights } from "@/components/grading/grade-insights";
import { ReplayChart } from "@/components/backtesting/replay-chart";
import { KeyMomentsList } from "@/components/backtesting/key-moments-list";
import type { TradeGrade } from "@/lib/engine/grading";
import type { TimePoint, ReplayMetrics, KeyMoment } from "@/lib/engine/types";

interface GradeResult {
  grade: TradeGrade;
  replay: {
    sameDayPoints: TimePoint[];
    toExpirationPoints: TimePoint[];
    metrics: ReplayMetrics;
    keyMoments: KeyMoment[];
  };
  insights: string[];
  insightsSource: "ai" | "data-driven";
}

export default function GradeMyTradePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [tradeData, setTradeData] = useState<TradeFormData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);

  const handleSubmit = useCallback(async (data: TradeFormData) => {
    setLoading(true);
    setResult(null);
    setTradeData(data);

    try {
      const res = await fetch("/api/grade-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error(`API ${res.status}`);
      const gradeResult: GradeResult = await res.json();
      setResult(gradeResult);

      setTimeout(() => {
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (err) {
      console.error("[grade-my-trade] Failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setResult(null);
    setTradeData(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const isMultiDay = result?.replay.toExpirationPoints.some((p) => p.dayIndex > 0) ?? false;

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
                Grade My Trade
              </h1>
              <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-[11px] font-medium text-green-400">
                Free Sample
              </span>
            </div>
            <p className="text-[15px] leading-relaxed text-text-secondary">
              Enter a trade you took (or would have taken) and get an AI-powered
              grade with detailed analysis. Learn what worked, what didn&apos;t, and
              what indicators would have helped.
            </p>
          </div>

          <div className="space-y-5">
            {/* Step 1 — Trade input */}
            <TradeInputForm onSubmit={handleSubmit} loading={loading} />

            {/* Results */}
            <AnimatePresence>
              {result && (
                <motion.div
                  ref={resultRef}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-5"
                >
                  {/* Step 2 — Grade card */}
                  <TradeGradeCard grade={result.grade} />

                  {/* Step 3 — Chart with entry/exit markers */}
                  <div className="rounded-[14px] border border-border bg-surface p-6">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-[13px] font-semibold text-accent">
                        3
                      </span>
                      <h2 className="text-lg font-semibold text-text-primary">
                        Trade Replay
                      </h2>
                    </div>
                    <p className="mb-4 text-[13px] text-text-muted">
                      How the contract&apos;s estimated premium moved throughout the session.
                    </p>

                    <div className="mb-5">
                      <ReplayChart
                        sameDayPoints={result.replay.sameDayPoints}
                        toExpirationPoints={result.replay.toExpirationPoints}
                        isMultiDay={isMultiDay}
                        entryPremium={result.replay.metrics.entryPremium}
                      />
                    </div>

                    {/* Key insights */}
                    <KeyMomentsList moments={result.replay.keyMoments} />
                  </div>

                  {/* Step 4 — AI teaching insights */}
                  <GradeInsights
                    insights={result.insights}
                    source={result.insightsSource}
                    ticker={tradeData?.ticker ?? ""}
                    loading={insightsLoading}
                  />

                  {/* Actions */}
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button onClick={handleReset}>Grade Another Trade</Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </>
  );
}
