"use client";

import { useState, useMemo, useRef } from "react";
import {
  ChevronDown,
  TrendingUp,
  Calendar,
  Clock,
  Upload,
  MessageSquare,
  ClipboardList,
  Loader2,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Ticker, AssetClass } from "@/lib/engine/types";
import {
  ASSET_CLASS_TICKERS,
  ASSET_CLASS_LABELS,
  TICKER_LABELS,
} from "@/lib/engine/types";
import { getRecentTradingDays, getEntryTimeSlots, formatDateDisplay } from "@/lib/engine/dates";

type InputMode = "form" | "text" | "screenshot";

export interface TradeFormData {
  ticker: string;
  date: string;
  entryTime: string;
  strike: number;
  right: "call" | "put";
  entryPremium: number;
  exitPremium?: number;
  exitTime?: string;
}

interface TradeInputFormProps {
  onSubmit: (data: TradeFormData) => void;
  loading?: boolean;
}

export function TradeInputForm({ onSubmit, loading }: TradeInputFormProps) {
  const [mode, setMode] = useState<InputMode>("form");
  const [assetClass, setAssetClass] = useState<AssetClass>("options");

  // Form state
  const [ticker, setTicker] = useState<Ticker | "">("");
  const [date, setDate] = useState("");
  const [entryTime, setEntryTime] = useState("");
  const [strike, setStrike] = useState("");
  const [right, setRight] = useState<"call" | "put">("call");
  const [entryPremium, setEntryPremium] = useState("");
  const [exitPremium, setExitPremium] = useState("");
  const [exitTime, setExitTime] = useState("");

  // Free-text state
  const [freeText, setFreeText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  // Screenshot state
  const fileRef = useRef<HTMLInputElement>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  const tickers = ASSET_CLASS_TICKERS[assetClass];
  const tradingDays = useMemo(() => getRecentTradingDays(30), []);
  const timeSlots = useMemo(() => getEntryTimeSlots(), []);

  const canSubmitForm = ticker && date && entryTime && strike && entryPremium && !loading;

  function handleFormSubmit() {
    if (!canSubmitForm) return;
    onSubmit({
      ticker: ticker as string,
      date,
      entryTime,
      strike: parseFloat(strike),
      right,
      entryPremium: parseFloat(entryPremium),
      exitPremium: exitPremium ? parseFloat(exitPremium) : undefined,
      exitTime: exitTime || undefined,
    });
  }

  async function handleFreeTextSubmit() {
    if (!freeText.trim()) return;
    setParsing(true);
    setParseError("");

    try {
      const res = await fetch("/api/parse-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: freeText }),
      });

      if (!res.ok) throw new Error("Parse failed");
      const data = await res.json();

      if (data.missingFields?.length > 0) {
        // Fill what we can into the form and switch to form mode
        const p = data.parsed;
        if (p.ticker) setTicker(p.ticker as Ticker);
        if (p.date) setDate(p.date);
        if (p.entryTime) setEntryTime(p.entryTime);
        if (p.strike) setStrike(String(p.strike));
        if (p.right) setRight(p.right);
        if (p.entryPremium) setEntryPremium(String(p.entryPremium));
        if (p.exitPremium) setExitPremium(String(p.exitPremium));
        if (p.exitTime) setExitTime(p.exitTime);
        setMode("form");
        setParseError(`Please fill in missing fields: ${data.missingFields.join(", ")}`);
      } else {
        onSubmit(data.parsed as TradeFormData);
      }
    } catch {
      setParseError("Could not parse trade. Try the form instead.");
    } finally {
      setParsing(false);
    }
  }

  async function handleScreenshotUpload(file: File) {
    setParsing(true);
    setParseError("");

    // Preview
    const url = URL.createObjectURL(file);
    setScreenshotPreview(url);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/parse-trade", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Parse failed");
      const data = await res.json();

      // Fill form with parsed data
      const p = data.parsed;
      if (p.ticker) setTicker(p.ticker as Ticker);
      if (p.date) setDate(p.date);
      if (p.entryTime) setEntryTime(p.entryTime);
      if (p.strike) setStrike(String(p.strike));
      if (p.right) setRight(p.right);
      if (p.entryPremium) setEntryPremium(String(p.entryPremium));
      if (p.exitPremium) setExitPremium(String(p.exitPremium));
      if (p.exitTime) setExitTime(p.exitTime);

      // Switch to form for review/submit
      setMode("form");

      if (data.missingFields?.length > 0) {
        setParseError(`Parsed from screenshot. Please verify and fill: ${data.missingFields.join(", ")}`);
      } else {
        setParseError("Parsed from screenshot — verify the details and submit.");
      }
    } catch {
      setParseError("Could not read screenshot. Try entering manually.");
      setMode("form");
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className="rounded-[14px] border border-border bg-surface p-6">
      {/* Header */}
      <div className="mb-1 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-[13px] font-semibold text-accent">
          1
        </span>
        <h2 className="text-lg font-semibold text-text-primary">
          Enter Your Trade
        </h2>
      </div>
      <p className="mb-5 text-[13px] text-text-muted">
        Enter your trade details manually, describe it in text, or upload a broker screenshot.
      </p>

      {/* Input mode toggle */}
      <div className="mb-5 flex rounded-lg border border-border p-0.5 w-fit">
        {([
          { mode: "form" as const, icon: ClipboardList, label: "Form" },
          { mode: "text" as const, icon: MessageSquare, label: "Describe" },
          { mode: "screenshot" as const, icon: Upload, label: "Screenshot" },
        ]).map(({ mode: m, icon: Icon, label }) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              mode === m
                ? "bg-accent text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {parseError && (
        <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
          <p className="text-[13px] text-amber-400">{parseError}</p>
        </div>
      )}

      {/* ── Form mode ──────────────────────────────────────────── */}
      {mode === "form" && (
        <>
          {/* Asset class */}
          <div className="mb-4 flex rounded-lg border border-border p-0.5 w-fit">
            {(Object.keys(ASSET_CLASS_LABELS) as AssetClass[]).map((ac) => (
              <button
                key={ac}
                onClick={() => { setAssetClass(ac); setTicker(""); }}
                className={`rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  assetClass === ac
                    ? "bg-accent text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {ASSET_CLASS_LABELS[ac]}
              </button>
            ))}
          </div>

          {/* Row 1: Ticker, Date, Entry Time */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4 mb-4">
            <div className="flex-1">
              <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-text-secondary">
                <TrendingUp className="h-3.5 w-3.5 text-accent" />
                Ticker
              </label>
              <div className="relative">
                <select
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value as Ticker)}
                  className="w-full appearance-none rounded-lg border border-border bg-bg py-2.5 pl-3 pr-10 text-sm text-text-primary focus:border-accent focus:outline-none"
                >
                  <option value="">Select…</option>
                  {tickers.map((t) => (
                    <option key={t} value={t}>{TICKER_LABELS[t]}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              </div>
            </div>

            <div className="flex-1">
              <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-text-secondary">
                <Calendar className="h-3.5 w-3.5 text-accent" />
                Date
              </label>
              <div className="relative">
                <select
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-border bg-bg py-2.5 pl-3 pr-10 text-sm text-text-primary focus:border-accent focus:outline-none"
                >
                  <option value="">Select…</option>
                  {tradingDays.map((d) => (
                    <option key={d} value={d}>{formatDateDisplay(d)}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              </div>
            </div>

            <div className="flex-1">
              <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-text-secondary">
                <Clock className="h-3.5 w-3.5 text-accent" />
                Entry Time
              </label>
              <div className="relative">
                <select
                  value={entryTime}
                  onChange={(e) => setEntryTime(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-border bg-bg py-2.5 pl-3 pr-10 text-sm text-text-primary focus:border-accent focus:outline-none"
                >
                  <option value="">Select…</option>
                  {timeSlots.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              </div>
            </div>
          </div>

          {/* Row 2: Strike, Call/Put, Entry Premium */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4 mb-4">
            <div className="flex-1">
              <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-text-secondary">
                <TrendingUp className="h-3.5 w-3.5 text-accent" />
                Strike Price
              </label>
              <input
                type="number"
                value={strike}
                onChange={(e) => setStrike(e.target.value)}
                placeholder="595"
                className="w-full rounded-lg border border-border bg-bg py-2.5 px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>

            <div className="flex-1">
              <label className="mb-1.5 text-[13px] font-medium text-text-secondary">
                Direction
              </label>
              <div className="flex rounded-lg border border-border p-0.5">
                <button
                  onClick={() => setRight("call")}
                  className={`flex-1 rounded-md py-2.5 text-[13px] font-semibold transition-colors ${
                    right === "call"
                      ? "bg-green-500/15 text-green-400"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  Call
                </button>
                <button
                  onClick={() => setRight("put")}
                  className={`flex-1 rounded-md py-2.5 text-[13px] font-semibold transition-colors ${
                    right === "put"
                      ? "bg-red-500/15 text-red-400"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  Put
                </button>
              </div>
            </div>

            <div className="flex-1">
              <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-text-secondary">
                <DollarSign className="h-3.5 w-3.5 text-accent" />
                Entry Premium
              </label>
              <input
                type="number"
                step="0.01"
                value={entryPremium}
                onChange={(e) => setEntryPremium(e.target.value)}
                placeholder="2.45"
                className="w-full rounded-lg border border-border bg-bg py-2.5 px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Row 3: Exit (optional) */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4 mb-5">
            <div className="flex-1">
              <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-text-muted">
                <DollarSign className="h-3.5 w-3.5" />
                Exit Premium
                <span className="text-[11px]">(optional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={exitPremium}
                onChange={(e) => setExitPremium(e.target.value)}
                placeholder="3.10"
                className="w-full rounded-lg border border-border bg-bg py-2.5 px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>

            <div className="flex-1">
              <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-text-muted">
                <Clock className="h-3.5 w-3.5" />
                Exit Time
                <span className="text-[11px]">(optional)</span>
              </label>
              <div className="relative">
                <select
                  value={exitTime}
                  onChange={(e) => setExitTime(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-border bg-bg py-2.5 pl-3 pr-10 text-sm text-text-primary focus:border-accent focus:outline-none"
                >
                  <option value="">Held to close</option>
                  {timeSlots.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              </div>
            </div>

            <div className="flex-1" />
          </div>

          <Button
            onClick={handleFormSubmit}
            disabled={!canSubmitForm}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Grading...
              </>
            ) : (
              "Grade This Trade"
            )}
          </Button>
        </>
      )}

      {/* ── Free-text mode ─────────────────────────────────────── */}
      {mode === "text" && (
        <div>
          <label className="mb-1.5 text-[13px] font-medium text-text-secondary">
            Describe your trade
          </label>
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={4}
            placeholder='e.g. "Bought SPY 595C 0DTE at 10:30am for $2.45, sold at $3.10 around 11:45am on 2/20/2025"'
            className="mb-4 w-full rounded-lg border border-border bg-bg py-2.5 px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none resize-none"
          />
          <Button
            onClick={handleFreeTextSubmit}
            disabled={!freeText.trim() || parsing}
            className="w-full sm:w-auto"
          >
            {parsing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Parsing...
              </>
            ) : (
              "Parse & Grade"
            )}
          </Button>
        </div>
      )}

      {/* ── Screenshot mode ────────────────────────────────────── */}
      {mode === "screenshot" && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleScreenshotUpload(file);
            }}
          />

          {screenshotPreview ? (
            <div className="mb-4">
              <img
                src={screenshotPreview}
                alt="Broker screenshot"
                className="max-h-60 rounded-lg border border-border object-contain"
              />
            </div>
          ) : null}

          {parsing ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-4 py-6">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              <span className="text-[13px] text-text-muted">
                Reading your broker screenshot...
              </span>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-lg border-2 border-dashed border-border bg-bg px-4 py-8 text-center transition-colors hover:border-accent/40 hover:bg-accent/5"
            >
              <Upload className="mx-auto mb-2 h-8 w-8 text-text-muted" />
              <p className="text-sm font-medium text-text-secondary">
                Upload a screenshot from your broker
              </p>
              <p className="mt-1 text-[12px] text-text-muted">
                Supports PNG, JPG — we&apos;ll extract the trade details automatically
              </p>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
