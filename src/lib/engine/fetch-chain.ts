/**
 * Client-side bridge: fetch real options chain from /api/options (Polygon.io)
 * and map it to our ChainData format. Falls back to synthetic generateChain()
 * if the API call fails (e.g. no options data for crypto/futures tickers).
 */

import type {
  Ticker,
  Expiration,
  ChainData,
  ChainRow,
  Confidence,
} from "./types";
import { ZERO_DTE_TICKERS } from "./types";
import type { IntradayBar } from "@/lib/services/polygon";
import { generateChain } from "./chain";

// ─── Polygon symbol mapping ─────────────────────────────────────────

const POLYGON_SYMBOLS: Record<string, string> = {
  // Equities/ETFs — same symbol
  SPY: "SPY",
  QQQ: "QQQ",
  AAPL: "AAPL",
  TSLA: "TSLA",
  NVDA: "NVDA",
  AMZN: "AMZN",
  // Futures — use base symbol for Polygon
  ES: "ES",
  NQ: "NQ",
  CL: "CL",
  GC: "GC",
  SI: "SI",
  // Crypto — Polygon uses X: prefix
  BTC: "X:BTCUSD",
  ETH: "X:ETHUSD",
  SOL: "X:SOLUSD",
  DOGE: "X:DOGEUSD",
  XRP: "X:XRPUSD",
};

function polygonSymbol(ticker: string): string {
  return POLYGON_SYMBOLS[ticker] ?? ticker;
}

// ─── Expiration date resolution ──────────────────────────────────────

/**
 * Given the list of available expirations, pick the best match
 * for our "0dte" or "friday" modes.
 */
function pickExpiration(
  available: string[],
  mode: Expiration,
  dateStr: string
): string | undefined {
  if (!available.length) return undefined;

  // Use the user-selected date for context (not always "today")
  const refDate = new Date(dateStr + "T12:00:00Z");
  const refStr = refDate.toISOString().slice(0, 10);

  if (mode === "0dte") {
    // Prefer same-day expiration matching the selected date
    return available.find((d) => d === refStr) ?? available[0];
  }

  // "friday" — find the next Friday from the selected date
  const dayOfWeek = refDate.getUTCDay();
  const daysToFriday = (5 - dayOfWeek + 7) % 7 || 7;
  const friday = new Date(refDate);
  friday.setUTCDate(friday.getUTCDate() + daysToFriday);
  const fridayStr = friday.toISOString().slice(0, 10);

  return (
    available.find((d) => d === fridayStr) ??
    available.find((d) => d > refStr) ??
    available[0]
  );
}

// ─── Normalized API response → ChainData mapping ────────────────────

interface APIChainResponse {
  symbol: string;
  underlyingPrice: number;
  expiration: string;
  calls: APIContract[];
  puts: APIContract[];
  availableExpirations?: string[];
}

interface APIContract {
  strike: number;
  premium: number;
  premiumSource?: "mid" | "last" | "estimated";
  confidence: Confidence;
  isATM: boolean;
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
  };
  market?: {
    impliedVolatility?: number;
  };
}

function mapContracts(contracts: APIContract[]): ChainRow[] {
  return contracts.map((c) => ({
    strike: c.strike,
    premium: c.premium,
    confidence: c.confidence,
    isATM: c.isATM,
    premiumSource: c.premiumSource,
    greeks: c.greeks,
    impliedVolatility: c.market?.impliedVolatility,
  }));
}

/**
 * Trim to ~10 strikes centered around ATM for a clean UI.
 */
function trimAroundATM(rows: ChainRow[], count = 10): ChainRow[] {
  const atmIdx = rows.findIndex((r) => r.isATM);
  if (atmIdx === -1 || rows.length <= count) return rows;

  const half = Math.floor(count / 2);
  let start = Math.max(0, atmIdx - half);
  let end = start + count;
  if (end > rows.length) {
    end = rows.length;
    start = Math.max(0, end - count);
  }
  return rows.slice(start, end);
}

// ─── Public API ──────────────────────────────────────────────────────

export interface LiveChainResult {
  chain: ChainData;
  availableExpirations: string[];
  source: "polygon" | "synthetic";
  /** Historical underlying price on the selected date (null if unavailable) */
  historicalPrice: number | null;
}

/**
 * Check if a ticker supports 0DTE based on known list.
 */
export function has0DTE(ticker: string): boolean {
  return (ZERO_DTE_TICKERS as readonly string[]).includes(ticker.toUpperCase());
}

/**
 * Determine the best default expiration for a ticker.
 * If ticker supports 0DTE, use "0dte". Otherwise, use "friday".
 */
export function defaultExpiration(ticker: string): Expiration {
  return has0DTE(ticker) ? "0dte" : "friday";
}

/**
 * Fetch a real options chain from Polygon.io via our API route.
 * Falls back to synthetic data if the API fails.
 */
export async function fetchLiveChain(
  ticker: Ticker,
  date: string,
  entryTime: string,
  expiration: Expiration
): Promise<LiveChainResult> {
  try {
    const symbol = polygonSymbol(ticker);

    // First fetch: get available expirations + nearest chain
    const res = await fetch(`/api/options?symbol=${encodeURIComponent(symbol)}`);
    if (!res.ok) throw new Error(`API ${res.status}`);

    const data: APIChainResponse = await res.json();
    const availableExps = data.availableExpirations ?? [data.expiration];

    // If 0DTE requested but ticker doesn't have same-day expirations, fallback to nearest
    let effectiveExpiration = expiration;
    if (expiration === "0dte" && !has0DTE(ticker)) {
      effectiveExpiration = "friday";
    }

    // Determine which expiration to use
    const targetExp = pickExpiration(availableExps, effectiveExpiration, date);

    // If the nearest chain doesn't match our target, re-fetch with the right one
    let chainData = data;
    if (targetExp && targetExp !== data.expiration) {
      const res2 = await fetch(
        `/api/options?symbol=${encodeURIComponent(symbol)}&expiration=${targetExp}`
      );
      if (res2.ok) {
        chainData = await res2.json();
      }
    }

    // Map API response → ChainData
    const calls = trimAroundATM(mapContracts(chainData.calls));
    const puts = trimAroundATM(mapContracts(chainData.puts));

    // Ensure at least one ATM row exists
    if (calls.length === 0 && puts.length === 0) {
      throw new Error("Empty chain from Polygon");
    }

    const chain: ChainData = {
      ticker,
      date,
      entryTime,
      expiration: effectiveExpiration,
      underlyingPrice: chainData.underlyingPrice,
      calls,
      puts,
      source: "polygon",
      availableExpirations: availableExps,
    };

    return { chain, availableExpirations: availableExps, source: "polygon", historicalPrice: null };
  } catch (err) {
    // Fall back to synthetic
    console.warn(
      `[fetchLiveChain] Polygon fetch failed for ${ticker}, using synthetic:`,
      err
    );
    const chain = generateChain(ticker, date, entryTime, expiration);
    return { chain, availableExpirations: [], source: "synthetic", historicalPrice: null };
  }
}

// ─── Historical underlying price ──────────────────────────────────────

export interface HistoricalPriceResult {
  price: number | null;
  source: "polygon" | "none";
}

/**
 * Fetch the historical closing price of the underlying on a specific date.
 * Used to determine correct ATM strike for historical backtests.
 */
export async function fetchHistoricalPrice(
  ticker: Ticker,
  date: string
): Promise<HistoricalPriceResult> {
  try {
    const symbol = polygonSymbol(ticker);
    const res = await fetch(
      `/api/historical-price?symbol=${encodeURIComponent(symbol)}&date=${encodeURIComponent(date)}`
    );
    if (!res.ok) throw new Error(`API ${res.status}`);

    const data = await res.json();
    if (data.price && data.price > 0) {
      return { price: data.price, source: "polygon" };
    }
    throw new Error("No price in response");
  } catch (err) {
    console.warn(
      `[fetchHistoricalPrice] Failed for ${ticker} on ${date}:`,
      err
    );
    return { price: null, source: "none" };
  }
}

// ─── Intraday price data ──────────────────────────────────────────────

export interface IntradayResult {
  bars: IntradayBar[];
  source: "polygon" | "none";
}

/**
 * Fetch real intraday price bars for the underlying via /api/intraday.
 * Returns empty bars array if data is unavailable (too old, no data, etc).
 */
export async function fetchIntradayPrices(
  ticker: Ticker,
  date: string
): Promise<IntradayResult> {
  try {
    const symbol = polygonSymbol(ticker);
    const res = await fetch(
      `/api/intraday?symbol=${encodeURIComponent(symbol)}&date=${encodeURIComponent(date)}`
    );
    if (!res.ok) throw new Error(`API ${res.status}`);

    const data = await res.json();
    if (!data.bars || data.bars.length === 0) {
      throw new Error("No bars returned");
    }

    return { bars: data.bars as IntradayBar[], source: "polygon" };
  } catch (err) {
    console.warn(
      `[fetchIntradayPrices] Failed for ${ticker} on ${date}:`,
      err
    );
    return { bars: [], source: "none" };
  }
}

// ─── AI insights ─────────────────────────────────────────────────────

export interface InsightsResult {
  insights: string[];
  source: "ai" | "data-driven";
}

/**
 * Fetch AI-generated contextual insights for a replay.
 */
export async function fetchInsights(payload: {
  ticker: string;
  date: string;
  entryTime: string;
  strike: number;
  right: "call" | "put";
  entryPremium: number;
  exitPL: number;
  exitPLPct: number;
  maxProfit: number;
  maxProfitPct: number;
  maxProfitTime: string;
  maxDrawdown: number;
  maxDrawdownPct: number;
  underlyingStart: number;
  underlyingEnd: number;
  underlyingHigh: number;
  underlyingLow: number;
}): Promise<InsightsResult> {
  try {
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("[fetchInsights] Failed:", err);
    return { insights: [], source: "data-driven" };
  }
}
