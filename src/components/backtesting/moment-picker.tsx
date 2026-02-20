"use client";

import { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Ticker, MomentSelection } from "@/lib/engine/types";
import { getRecentTradingDays, getEntryTimeSlots, formatDateDisplay } from "@/lib/engine/dates";

interface MomentPickerProps {
  onLoadChain: (selection: MomentSelection) => void;
  loading?: boolean;
}

const TICKERS: Ticker[] = ["SPY", "QQQ"];

export function MomentPicker({ onLoadChain, loading }: MomentPickerProps) {
  const [ticker, setTicker] = useState<Ticker | "">("");
  const [date, setDate] = useState("");
  const [entryTime, setEntryTime] = useState("");

  const tradingDays = useMemo(() => getRecentTradingDays(14), []);
  const timeSlots = useMemo(() => getEntryTimeSlots(), []);

  const canSubmit = ticker && date && entryTime && !loading;

  function handleSubmit() {
    if (!canSubmit) return;
    onLoadChain({ ticker: ticker as Ticker, date, entryTime });
  }

  return (
    <div className="rounded-[14px] border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-[13px] font-semibold text-accent">
          1
        </span>
        <h2 className="text-lg font-semibold text-text-primary">
          Select Moment
        </h2>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
        {/* Ticker */}
        <div className="flex-1">
          <label className="mb-1.5 block text-[13px] text-text-muted">
            Ticker
          </label>
          <div className="relative">
            <select
              value={ticker}
              onChange={(e) => setTicker(e.target.value as Ticker)}
              className="h-11 w-full appearance-none rounded-xl border border-border bg-bg px-4 pr-10 text-sm text-text-primary outline-none transition-colors focus:border-accent"
            >
              <option value="">Select ticker</option>
              {TICKERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          </div>
        </div>

        {/* Date */}
        <div className="flex-1">
          <label className="mb-1.5 block text-[13px] text-text-muted">
            Date (last 14 trading days)
          </label>
          <div className="relative">
            <select
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-border bg-bg px-4 pr-10 text-sm text-text-primary outline-none transition-colors focus:border-accent"
            >
              <option value="">Select date</option>
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
          <label className="mb-1.5 block text-[13px] text-text-muted">
            Entry Time (ET)
          </label>
          <div className="relative">
            <select
              value={entryTime}
              onChange={(e) => setEntryTime(e.target.value)}
              className="h-11 w-full appearance-none rounded-xl border border-border bg-bg px-4 pr-10 text-sm text-text-primary outline-none transition-colors focus:border-accent"
            >
              <option value="">Select time</option>
              {timeSlots.map((t) => (
                <option key={t} value={t}>
                  {t}
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
