/**
 * Yahoo Finance options data service.
 *
 * Fetches real options chains via yahoo-finance2 (v3), normalizes the data
 * for our dual-confirmation backtesting engine, and caches responses
 * for 30 seconds to avoid rate-limiting.
 *
 * Usage:
 *   const chain = await getOptionsChain("SPY");
 *   const chain = await getOptionsChain("SPY", "2026-03-21");
 *   const contract = await getContract("SPY", "2026-03-21", 520, "call");
 */

import YahooFinance from "yahoo-finance2";
import type { CallOrPut, OptionsResult } from "yahoo-finance2/modules/options";
import type {
  MarketContract,
  MarketChain,
  MarketChainSummary,
  NormalizedContract,
  NormalizedChain,
} from "./types";

// Singleton client — reused across requests for connection pooling
const yf = new YahooFinance();

// ─── Cache ────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30_000; // 30 seconds

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const chainCache = new Map<string, CacheEntry<MarketChain>>();
const summaryCache = new Map<string, CacheEntry<MarketChainSummary>>();

function cacheKey(symbol: string, expiration?: string): string {
  return `${symbol.toUpperCase()}:${expiration ?? "summary"}`;
}

function getCached<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string
): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  data: T
): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// ─── Helpers ──────────────────────────────────────────────────────────

/** Compute mid-price if both bid and ask are valid (> 0). */
function computeMidPrice(bid: number, ask: number): number | null {
  if (bid > 0 && ask > 0) {
    return +((bid + ask) / 2).toFixed(4);
  }
  return null;
}

/** Compute spread as a percentage of mid-price. */
function computeSpreadPercent(
  bid: number,
  ask: number,
  mid: number | null
): number | null {
  if (mid && mid > 0 && bid >= 0 && ask > 0) {
    return +(((ask - bid) / mid) * 100).toFixed(2);
  }
  return null;
}

/**
 * Derive a confidence level from spread width and volume.
 * Tight spread + decent volume → High confidence.
 */
function deriveConfidence(
  spreadPercent: number | null,
  volume: number,
  openInterest: number
): "High" | "Med" | "Low" {
  const hasVolume = volume > 10 || openInterest > 100;
  if (spreadPercent !== null && spreadPercent < 5 && hasVolume) return "High";
  if (spreadPercent !== null && spreadPercent < 15 && hasVolume) return "Med";
  return "Low";
}

/**
 * Convert a yahoo-finance2 CallOrPut contract to our MarketContract shape.
 */
function toMarketContract(
  raw: CallOrPut,
  right: "call" | "put"
): MarketContract {
  const bid = raw.bid ?? 0;
  const ask = raw.ask ?? 0;
  const lastPrice = raw.lastPrice ?? 0;
  const impliedVolatility = raw.impliedVolatility ?? 0;
  const openInterest = raw.openInterest ?? 0;
  const volume = raw.volume ?? 0;
  const mid = computeMidPrice(bid, ask);
  const spreadPct = computeSpreadPercent(bid, ask, mid);

  // Parse expiration — yahoo-finance2 v3 returns Date objects
  let expiration = "";
  if (raw.expiration) {
    const d =
      raw.expiration instanceof Date
        ? raw.expiration
        : new Date(raw.expiration as unknown as number);
    expiration = d.toISOString().slice(0, 10);
  }

  return {
    contractSymbol: raw.contractSymbol ?? "",
    strike: raw.strike ?? 0,
    expiration,
    right,
    bid,
    ask,
    lastPrice,
    impliedVolatility,
    openInterest,
    volume,
    midPrice: mid,
    spreadPercent: spreadPct,
  };
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Fetch available expiration dates for a symbol.
 */
export async function getExpirations(
  symbol: string
): Promise<MarketChainSummary> {
  const key = cacheKey(symbol);
  const cached = getCached(summaryCache, key);
  if (cached) return cached;

  try {
    const result: OptionsResult = await yf.options(symbol.toUpperCase());

    const expirations: string[] = (result.expirationDates ?? []).map(
      (d: Date) => d.toISOString().slice(0, 10)
    );

    const underlyingPrice = result.quote?.regularMarketPrice ?? 0;

    const summary: MarketChainSummary = {
      symbol: symbol.toUpperCase(),
      underlyingPrice,
      expirations,
      fetchedAt: Date.now(),
    };

    setCache(summaryCache, key, summary);
    return summary;
  } catch (err) {
    throw new Error(
      `Failed to fetch expirations for ${symbol}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Fetch the full options chain for a symbol and expiration date.
 * If no expiration is given, uses the first available (nearest).
 */
export async function getOptionsChain(
  symbol: string,
  expiration?: string
): Promise<MarketChain> {
  const key = cacheKey(symbol, expiration ?? "nearest");
  const cached = getCached(chainCache, key);
  if (cached) return { ...cached, fetchedAt: cached.fetchedAt };

  try {
    const queryOptions: { date?: Date } = {};
    if (expiration) {
      queryOptions.date = new Date(expiration + "T12:00:00Z");
    }

    const result: OptionsResult = await yf.options(
      symbol.toUpperCase(),
      queryOptions
    );

    const underlyingPrice = result.quote?.regularMarketPrice ?? 0;

    // Determine actual expiration from result
    const actualExpiration = expiration ?? (
      result.expirationDates?.[0]
        ? result.expirationDates[0].toISOString().slice(0, 10)
        : "unknown"
    );

    const calls = (result.options?.[0]?.calls ?? []).map(
      (c: CallOrPut) => toMarketContract(c, "call")
    );
    const puts = (result.options?.[0]?.puts ?? []).map(
      (p: CallOrPut) => toMarketContract(p, "put")
    );

    const chain: MarketChain = {
      symbol: symbol.toUpperCase(),
      underlyingPrice,
      expiration: actualExpiration,
      fetchedAt: Date.now(),
      calls,
      puts,
    };

    setCache(chainCache, key, chain);
    return chain;
  } catch (err) {
    throw new Error(
      `Failed to fetch options chain for ${symbol}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Find a specific contract by strike and right from the chain.
 */
export async function getContract(
  symbol: string,
  expiration: string,
  strike: number,
  right: "call" | "put"
): Promise<MarketContract | null> {
  const chain = await getOptionsChain(symbol, expiration);
  const contracts = right === "call" ? chain.calls : chain.puts;
  return (
    contracts.find(
      (c) => Math.abs(c.strike - strike) < 0.01
    ) ?? null
  );
}

/**
 * Normalize a MarketChain into the format our dual-confirmation
 * engine expects — bridging Yahoo data to our ChainRow format.
 *
 * Premium selection priority:
 *   1. midPrice (if valid bid/ask spread)
 *   2. lastPrice (fallback for illiquid contracts)
 *   3. 0.01 (minimum floor)
 */
export function normalizeChain(chain: MarketChain): NormalizedChain {
  const atmStrike = findATMStrike(chain);

  function normalize(
    contract: MarketContract
  ): NormalizedContract {
    let premium: number;
    let premiumSource: "mid" | "last" | "estimated";

    if (contract.midPrice !== null && contract.midPrice > 0) {
      premium = contract.midPrice;
      premiumSource = "mid";
    } else if (contract.lastPrice > 0) {
      premium = contract.lastPrice;
      premiumSource = "last";
    } else {
      premium = 0.01;
      premiumSource = "estimated";
    }

    const confidence = deriveConfidence(
      contract.spreadPercent,
      contract.volume,
      contract.openInterest
    );

    return {
      contractSymbol: contract.contractSymbol,
      strike: contract.strike,
      expiration: contract.expiration,
      right: contract.right,
      premium: +premium.toFixed(2),
      premiumSource,
      confidence,
      isATM: Math.abs(contract.strike - atmStrike) < 0.5,
      market: {
        bid: contract.bid,
        ask: contract.ask,
        lastPrice: contract.lastPrice,
        midPrice: contract.midPrice,
        spreadPercent: contract.spreadPercent,
        impliedVolatility: contract.impliedVolatility,
        openInterest: contract.openInterest,
        volume: contract.volume,
      },
    };
  }

  return {
    symbol: chain.symbol,
    underlyingPrice: chain.underlyingPrice,
    expiration: chain.expiration,
    fetchedAt: chain.fetchedAt,
    cached: false,
    calls: chain.calls.map(normalize),
    puts: chain.puts.map(normalize),
  };
}

/**
 * Find the ATM strike from the chain (closest to underlying price).
 */
function findATMStrike(chain: MarketChain): number {
  const allStrikes = [
    ...chain.calls.map((c) => c.strike),
    ...chain.puts.map((p) => p.strike),
  ];
  if (allStrikes.length === 0) return chain.underlyingPrice;

  return allStrikes.reduce((closest, strike) =>
    Math.abs(strike - chain.underlyingPrice) <
    Math.abs(closest - chain.underlyingPrice)
      ? strike
      : closest
  );
}

/**
 * High-level convenience: fetch + normalize in one call.
 * This is what the API route uses.
 */
export async function fetchNormalizedChain(
  symbol: string,
  expiration?: string
): Promise<NormalizedChain> {
  const raw = await getOptionsChain(symbol, expiration);
  const normalized = normalizeChain(raw);

  // Check if this was served from cache
  const key = cacheKey(symbol, expiration ?? "nearest");
  const cachedEntry = chainCache.get(key);
  if (cachedEntry && cachedEntry.data === raw) {
    normalized.cached = true;
  }

  return normalized;
}

// ─── Intraday chart data ─────────────────────────────────────────────

export interface IntradayBar {
  time: string;       // HH:MM
  label: string;      // 12-hour display label
  timestamp: number;  // unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const chartCache = new Map<string, CacheEntry<IntradayBar[]>>();

/**
 * Fetch intraday price bars from Yahoo Finance chart API.
 * Returns 5-minute bars for a specific date filtered to trading hours.
 * Yahoo supports ~60 days of 5m data and ~7 days of 1m data.
 */
export async function getIntradayChart(
  symbol: string,
  date: string
): Promise<IntradayBar[]> {
  const key = `chart:${symbol.toUpperCase()}:${date}`;
  const cached = getCached(chartCache, key);
  if (cached) return cached;

  try {
    // period1 = start of requested date, period2 = end of next day
    const startDate = new Date(date + "T04:00:00Z"); // pre-market start
    const endDate = new Date(date + "T21:00:00Z");   // post-market end

    const result = await yf.chart(symbol.toUpperCase(), {
      period1: startDate,
      period2: endDate,
      interval: "5m",
      includePrePost: false,
    });

    if (!result.quotes || result.quotes.length === 0) {
      throw new Error("No intraday data returned");
    }

    const bars: IntradayBar[] = [];

    for (const q of result.quotes) {
      if (q.close == null || q.open == null) continue;

      const d = q.date;
      // Filter to regular trading hours (09:30-16:00 ET)
      const hour = d.getUTCHours() - 5; // EST offset (approximate)
      const minute = d.getUTCMinutes();
      const totalMin = hour * 60 + minute;
      if (totalMin < 570 || totalMin > 960) continue; // 9:30=570, 16:00=960

      const hh = hour.toString().padStart(2, "0");
      const mm = minute.toString().padStart(2, "0");
      const timeStr = `${hh}:${mm}`;

      // 12-hour label
      let h12 = hour;
      const suffix = h12 >= 12 ? "PM" : "AM";
      if (h12 === 0) h12 = 12;
      else if (h12 > 12) h12 -= 12;
      const label = `${h12}:${mm} ${suffix}`;

      bars.push({
        time: timeStr,
        label,
        timestamp: d.getTime(),
        open: q.open,
        high: q.high ?? q.close,
        low: q.low ?? q.close,
        close: q.close,
        volume: q.volume ?? 0,
      });
    }

    if (bars.length === 0) {
      throw new Error("No bars within trading hours");
    }

    setCache(chartCache, key, bars);
    return bars;
  } catch (err) {
    throw new Error(
      `Failed to fetch intraday data for ${symbol} on ${date}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
