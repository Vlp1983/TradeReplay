"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { TrendingUp, Calendar, Clock, ArrowUpRight, ArrowDownRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MomentSelection, Right } from "@/lib/engine/types";
import { getRecentTradingDays, getEntryTimeSlots, formatDateDisplay } from "@/lib/engine/dates";
import { getAllTickers } from "@/lib/pricing/config/tickers";
import { getTickerLabel } from "@/lib/pricing/config/tickerNames";

// ─── Recent tickers (localStorage) ─────────────────────────────────

const RECENT_KEY = "tr_recent_tickers";
const MAX_RECENT = 3;

function getRecentTickers(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((t: unknown) => typeof t === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecentTicker(ticker: string) {
  if (typeof window === "undefined") return;
  try {
    const prev = getRecentTickers();
    const next = [ticker, ...prev.filter((t) => t !== ticker)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

// ─── Build searchable ticker list once ──────────────────────────────

const ALL_TICKERS = getAllTickers().map((cfg) => cfg.ticker);

interface MomentPickerProps {
  onLoadChain: (selection: MomentSelection) => void;
  loading?: boolean;
  selectedRight: Right;
  onRightChange: (right: Right) => void;
}

export function MomentPicker({ onLoadChain, loading, selectedRight, onRightChange }: MomentPickerProps) {
  // Compute tradingDays first so we can derive the default date from it,
  // ensuring they always agree (avoids SSR/client timezone mismatch).
  const tradingDays = useMemo(() => getRecentTradingDays(42), []); // ~60 calendar days of weekdays
  const timeSlots = useMemo(() => getEntryTimeSlots(), []);

  const [ticker, setTicker] = useState("");
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [date, setDate] = useState(() => tradingDays[0] ?? "");
  const [entryTime, setEntryTime] = useState("10:00");
  const [recentTickers, setRecentTickers] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Hydration safety: if SSR date doesn't match any client-side trading day,
  // snap to the first available trading day.
  useEffect(() => {
    if (tradingDays.length > 0 && (!date || !tradingDays.includes(date))) {
      console.log("[MomentPicker] Snapping date to", tradingDays[0], "(was:", date, ")");
      setDate(tradingDays[0]);
    }
  }, [tradingDays, date]);

  // Load recent tickers on mount
  useEffect(() => {
    setRecentTickers(getRecentTickers());
  }, []);

  // Filter tickers based on query
  const filteredTickers = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [];

    // Prefix matches first, then contains matches
    const prefixMatches: string[] = [];
    const containsMatches: string[] = [];

    for (const t of ALL_TICKERS) {
      if (t.startsWith(q)) {
        prefixMatches.push(t);
      } else if (t.includes(q)) {
        containsMatches.push(t);
      }
      if (prefixMatches.length + containsMatches.length >= 10) break;
    }

    return [...prefixMatches, ...containsMatches].slice(0, 10);
  }, [query]);

  const selectTicker = useCallback((t: string) => {
    setTicker(t);
    setQuery(t);
    setShowDropdown(false);
    saveRecentTicker(t);
    setRecentTickers(getRecentTickers());
    console.log("[MomentPicker] Ticker selected:", t);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const canSubmit = !!ticker && !!date && !!entryTime && !loading;
  const isCall = selectedRight === "call";

  // Debug: log why button might be disabled
  if (!canSubmit) {
    console.log("[MomentPicker] canSubmit=false:", { ticker: !!ticker, date: !!date, entryTime: !!entryTime, loading });
  }

  function handleSubmit() {
    if (!canSubmit) return;
    console.log("[MomentPicker] Submitting:", { ticker, date, entryTime });
    onLoadChain({ ticker, date, entryTime });
  }

  const showRecent = showDropdown && !query.trim() && recentTickers.length > 0;
  const showResults = showDropdown && query.trim().length > 0;

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
        {/* Ticker — typeahead search */}
        <div className="flex-1">
          <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-text-secondary">
            <TrendingUp className="h-3.5 w-3.5 text-accent" />
            Ticker
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder="Search ticker... (e.g. SPY, AAPL)"
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setQuery(val);
                setShowDropdown(true);
                // Clear selected ticker if user edits away
                if (val !== ticker) setTicker("");
              }}
              onFocus={() => setShowDropdown(true)}
              className={`h-11 w-full rounded-xl border bg-bg pl-9 pr-9 text-sm outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent/30 ${
                ticker
                  ? "border-accent/40 text-text-primary"
                  : "border-border text-text-primary"
              }`}
            />
            {query && (
              <button
                onClick={() => { setQuery(""); setTicker(""); inputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Dropdown */}
            {(showRecent || showResults) && (
              <div
                ref={dropdownRef}
                className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-[280px] overflow-y-auto rounded-xl border border-border bg-surface shadow-lg"
              >
                {/* Recently replayed */}
                {showRecent && (
                  <div className="px-3 py-2">
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-text-muted">
                      Recently Replayed
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {recentTickers.map((t) => (
                        <button
                          key={t}
                          onClick={() => selectTicker(t)}
                          className="flex items-center gap-1.5 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-[13px] font-medium text-text-primary transition-colors hover:border-accent/40 hover:bg-accent/5"
                        >
                          <span className="font-semibold">{t}</span>
                          <span className="text-[11px] text-text-muted">{getTickerLabel(t).split(" — ")[1] ?? ""}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search results */}
                {showResults && filteredTickers.length === 0 && (
                  <div className="px-3 py-3 text-[13px] text-text-muted">No results</div>
                )}
                {showResults && filteredTickers.map((t) => (
                  <button
                    key={t}
                    onClick={() => selectTicker(t)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-accent/5"
                  >
                    <span className="font-semibold text-text-primary">{t}</span>
                    {getTickerLabel(t) !== t && (
                      <span className="text-text-muted">{getTickerLabel(t).split(" — ")[1]}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
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
