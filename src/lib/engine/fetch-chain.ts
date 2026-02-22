/**
 * Client-side bridge: fetch real options chain from /api/options (Yahoo Finance)
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
import { generateChain } from "./chain";

// ─── Yahoo symbol mapping ────────────────────────────────────────────

const YAHOO_SYMBOLS: Record<string, string> = {
  // Equities/ETFs — same symbol
  SPY: "SPY",
  QQQ: "QQQ",
  AAPL: "AAPL",
  TSLA: "TSLA",
  NVDA: "NVDA",
  AMZN: "AMZN",
  // Futures — Yahoo uses =F suffix
  ES: "ES=F",
  NQ: "NQ=F",
  CL: "CL=F",
  GC: "GC=F",
  SI: "SI=F",
  // Crypto — Yahoo uses -USD suffix
  BTC: "BTC-USD",
  ETH: "ETH-USD",
  SOL: "SOL-USD",
  DOGE: "DOGE-USD",
  XRP: "XRP-USD",
};

function yahooSymbol(ticker: string): string {
  return YAHOO_SYMBOLS[ticker] ?? ticker;
}

// ─── Expiration date resolution ──────────────────────────────────────

/**
 * Given Yahoo's list of available expirations, pick the best match
 * for our "0dte" or "friday" modes.
 */
function pickExpiration(
  available: string[],
  mode: Expiration
): string | undefined {
  if (!available.length) return undefined;

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  if (mode === "0dte") {
    // Prefer today's expiration, otherwise nearest
    return available.find((d) => d === todayStr) ?? available[0];
  }

  // "friday" — find the next Friday (or this Friday if today is before it)
  const dayOfWeek = today.getDay();
  const daysToFriday = (5 - dayOfWeek + 7) % 7 || 7; // next Friday if today is Fri
  const friday = new Date(today);
  friday.setDate(friday.getDate() + daysToFriday);
  const fridayStr = friday.toISOString().slice(0, 10);

  return (
    available.find((d) => d === fridayStr) ??
    // Fallback: nearest expiration after today
    available.find((d) => d > todayStr) ??
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
  confidence: Confidence;
  isATM: boolean;
}

function mapContracts(contracts: APIContract[]): ChainRow[] {
  return contracts.map((c) => ({
    strike: c.strike,
    premium: c.premium,
    confidence: c.confidence,
    isATM: c.isATM,
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
  source: "yahoo" | "synthetic";
}

/**
 * Fetch a real options chain from Yahoo Finance via our API route.
 * Falls back to synthetic data if the API fails.
 */
export async function fetchLiveChain(
  ticker: Ticker,
  date: string,
  entryTime: string,
  expiration: Expiration
): Promise<LiveChainResult> {
  try {
    const symbol = yahooSymbol(ticker);

    // First fetch: get available expirations + nearest chain
    const res = await fetch(`/api/options?symbol=${encodeURIComponent(symbol)}`);
    if (!res.ok) throw new Error(`API ${res.status}`);

    const data: APIChainResponse = await res.json();
    const availableExps = data.availableExpirations ?? [data.expiration];

    // Determine which expiration to use
    const targetExp = pickExpiration(availableExps, expiration);

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
      throw new Error("Empty chain from Yahoo");
    }

    const chain: ChainData = {
      ticker,
      date,
      entryTime,
      expiration,
      underlyingPrice: chainData.underlyingPrice,
      calls,
      puts,
    };

    return { chain, availableExpirations: availableExps, source: "yahoo" };
  } catch (err) {
    // Fall back to synthetic
    console.warn(
      `[fetchLiveChain] Yahoo fetch failed for ${ticker}, using synthetic:`,
      err
    );
    const chain = generateChain(ticker, date, entryTime, expiration);
    return { chain, availableExpirations: [], source: "synthetic" };
  }
}
