"use client";

import { useState, useMemo } from "react";
import { ChevronDown, TrendingUp, Calendar, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Ticker, MomentSelection, Right } from "@/lib/engine/types";
import {
  ASSET_CLASS_TICKERS,
  TICKER_LABELS,
} from "@/lib/engine/types";
import { getRecentTradingDays, getEntryTimeSlots, formatDateDisplay } from "@/lib/engine/dates";

interface MomentPickerProps {
  onLoadChain: (selection: MomentSelection) => void;
  loading?: boolean;
  selectedRight: Right;
  onRightChange: (right: Right) => void;
}

export function MomentPicker({ onLoadChain, loading, selectedRight, onRightChange }: MomentPickerProps) {
  const [ticker, setTicker] = useState<Ticker | "">("");
  const [date, setDate] = useState("");
  const [entryTime, setEntryTime] = useState("");

  const tickers = ASSET_CLASS_TICKERS.options;
  const tradingDays = useMemo(() => getRecentTradingDays(14), []);
  const timeSlots = useMemo(() => getEntryTimeSlots(), []);

  const canSubmit = ticker && date && entryTime && !loading;

  function handleSubmit() {
    if (!canSubmit) return;
    onLoadChain({ ticker: ticker as Ticker, date, entryTime });
  }

  const isCall = selectedRight === "call";

  return (
    <div className="rounded-[14px] border border-border bg-surface p-6">
      <div className="mb-1 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-[13px] font-semibold text-accent">
          1
        </span>
        <h2 className="text-lg font-semibold text-text-primary">
          Pick a moment in time
        </h2>
      </div>
      <p className="mb-5 text-[13px] text-text-muted">
        Choose your direction, ticker, date, and entry time.
      </p>

      {/* Call / Put main selection */}
      <div className="mb-5">
        <label className="mb-2 block text-[13px] font-medium text-text-secondary">
          Direction
        </label>
        <div className="flex rounded-lg border border-border p-0.5 w-fit">
          <button
            onClick={() => onRightChange("call")}
            className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-semibold transition-colors ${
              isCall
                ? "bg-green-500/15 text-green-400"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <ArrowUpRight className="h-4 w-4" />
            Call
            {isCall && <span className="text-[11px] font-normal opacity-70">Bullish</span>}
          </button>
          <button
            onClick={() => onRightChange("put")}
            className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-semibold transition-colors ${
              !isCall
                ? "bg-red-500/15 text-red-400"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <ArrowDownRight className="h-4 w-4" />
            Put
            {!isCall && <span className="text-[11px] font-normal opacity-70">Bearish</span>}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
        {/* Ticker */}
        <div className="flex-1">
          <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-text-secondary">
            <TrendingUp className="h-3.5 w-3.5 text-accent" />
            Ticker
          </label>
          <div className="relative">
            <select
              value={ticker}
              onChange={(e) => setTicker(e.target.value as Ticker)}
              className={`h-11 w-full appearance-none rounded-xl border bg-bg px-4 pr-10 text-sm outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent/30 ${
                ticker
                  ? "border-accent/40 text-text-primary"
                  : "border-border text-text-muted"
              }`}
            >
              <option value="">Choose ticker...</option>
              {tickers.map((t) => (
                <option key={t} value={t}>
                  {TICKER_LABELS[t]}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          </div>
        </div>

        {/* Date */}
        <div className="flex-1">
          <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-text-secondary">
            <Calendar className="h-3.5 w-3.5 text-accent" />
            Trading Date
          </label>
          <div className="relative">
            <select
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`h-11 w-full appearance-none rounded-xl border bg-bg px-4 pr-10 text-sm outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent/30 ${
                date
                  ? "border-accent/40 text-text-primary"
                  : "border-border text-text-muted"
              }`}
            >
              <option value="">Choose date...</option>
              {tradingDays.map((d) => (
                <option key={d} value={d}>
                  {formatDateDisplay(d)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          </div>
        </div>

        {/* Entry Time */}
        <div className="flex-1">
          <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-text-secondary">
            <Clock className="h-3.5 w-3.5 text-accent" />
            Entry Time (ET)
          </label>
          <div className="relative">
            <select
              value={entryTime}
              onChange={(e) => setEntryTime(e.target.value)}
              className={`h-11 w-full appearance-none rounded-xl border bg-bg px-4 pr-10 text-sm outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent/30 ${
                entryTime
                  ? "border-accent/40 text-text-primary"
                  : "border-border text-text-muted"
              }`}
            >
              <option value="">Choose time...</option>
              {timeSlots.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          </div>
        </div>

        {/* CTA */}
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="h-11 shrink-0 sm:w-auto"
        >
          {loading ? "Loading..." : "Load Chain"}
        </Button>
      </div>
    </div>
  );
}
