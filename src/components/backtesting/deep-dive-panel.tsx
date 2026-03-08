"use client";

import { useState } from "react";
import { Loader2, Microscope, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { PaywallModal } from "@/components/auth/PaywallModal";
import type { ReplayResult } from "@/lib/engine/types";

const STRATEGIES = [
  "ICT / Smart Money",
  "Supply & Demand",
  "EMA / Moving Averages",
  "Support & Resistance",
  "Volume Profile / VWAP",
  "Candlestick Patterns",
  "The Strat",
  "Greeks / Options Flow",
  "Fibonacci",
  "Price Action",
] as const;

interface DeepDiveResult {
  summary: string;
  bullets: string[];
  catalysts: string[];
  earningsContext: string;
  technicalContext: string;
  strategyNote: string;
  sentiment: "bullish" | "bearish" | "neutral" | "mixed";
  confidence: "high" | "medium" | "low";
}

interface DeepDivePanelProps {
  result: ReplayResult;
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const colors: Record<string, string> = {
    bullish: "bg-green-500/10 text-green-400",
    bearish: "bg-red-500/10 text-red-400",
    neutral: "bg-yellow-500/10 text-yellow-400",
    mixed: "bg-purple-500/10 text-purple-400",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${colors[sentiment] ?? colors.neutral}`}>
      {sentiment}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const colors: Record<string, string> = {
    high: "bg-green-500/10 text-green-400",
    medium: "bg-yellow-500/10 text-yellow-400",
    low: "bg-red-500/10 text-red-400",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${colors[confidence] ?? colors.medium}`}>
      {confidence} confidence
    </span>
  );
}

export function DeepDivePanel({ result }: DeepDivePanelProps) {
  const { isPro } = useAuth();
  const [strategy, setStrategy] = useState<string>(STRATEGIES[0]);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<DeepDiveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const { contract, metrics } = result;

  async function runDeepDive() {
    if (!isPro) {
      setShowPaywall(true);
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const res = await fetch("/api/insights/deep-dive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: contract.ticker,
          date: contract.date,
          strike: contract.strike,
          expiration: contract.expiration,
          direction: contract.right,
          entryTime: contract.entryTime,
          pnl: metrics.exitAtClosePL,
          entryPremium: metrics.entryPremium,
          exitPremium: metrics.exitPremium,
          strategy,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const data: DeepDiveResult = await res.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h3 className="mb-3 text-[15px] font-semibold text-text-primary">
        Deep Dive Analysis
      </h3>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Strategy selector */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-text-primary hover:border-accent/40 transition-colors"
          >
            {strategy}
            <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
          </button>
          {showDropdown && (
            <div className="absolute top-full left-0 z-20 mt-1 w-56 rounded-lg border border-border bg-surface shadow-lg">
              {STRATEGIES.map((s) => (
                <button
                  key={s}
                  onClick={() => { setStrategy(s); setShowDropdown(false); }}
                  className={`block w-full px-3 py-2 text-left text-[13px] hover:bg-accent/10 transition-colors ${
                    s === strategy ? "text-accent font-medium" : "text-text-secondary"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          onClick={runDeepDive}
          disabled={loading}
          className="gap-1.5"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Microscope className="h-3.5 w-3.5" />
          )}
          {loading ? "Analyzing..." : "Run Deep Dive"}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-[13px] text-red-400 mb-4">
          {error}
        </div>
      )}

      {/* Results */}
      {analysis && (
        <div className="rounded-lg border border-border bg-bg p-5 space-y-5">
          {/* Badges */}
          <div className="flex items-center gap-2">
            <SentimentBadge sentiment={analysis.sentiment} />
            <ConfidenceBadge confidence={analysis.confidence} />
          </div>

          {/* Summary */}
          <div>
            <h4 className="text-[13px] font-semibold text-text-muted mb-1">Summary</h4>
            <p className="text-[13px] leading-relaxed text-text-secondary">
              {analysis.summary}
            </p>
          </div>

          {/* Key Points */}
          {analysis.bullets.length > 0 && (
            <div>
              <h4 className="text-[13px] font-semibold text-text-muted mb-1">Key Points</h4>
              <ul className="space-y-1.5">
                {analysis.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-text-secondary">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Catalysts */}
          {analysis.catalysts.length > 0 && (
            <div>
              <h4 className="text-[13px] font-semibold text-text-muted mb-1">Catalysts</h4>
              <ul className="space-y-1.5">
                {analysis.catalysts.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-text-secondary">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Earnings Context */}
          <div>
            <h4 className="text-[13px] font-semibold text-text-muted mb-1">Earnings Context</h4>
            <p className="text-[13px] leading-relaxed text-text-secondary">
              {analysis.earningsContext}
            </p>
          </div>

          {/* Technical Context */}
          <div>
            <h4 className="text-[13px] font-semibold text-text-muted mb-1">Technical Context</h4>
            <p className="text-[13px] leading-relaxed text-text-secondary">
              {analysis.technicalContext}
            </p>
          </div>

          {/* Strategy Note — highlighted */}
          <div className="rounded-lg border border-accent/20 bg-accent/5 px-4 py-3">
            <h4 className="text-[13px] font-semibold text-accent mb-1">
              Strategy Lens: {strategy}
            </h4>
            <p className="text-[13px] leading-relaxed text-text-secondary">
              {analysis.strategyNote}
            </p>
          </div>
        </div>
      )}

      {/* Paywall modal for free users */}
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
      />
    </div>
  );
}
