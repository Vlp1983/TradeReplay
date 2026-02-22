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
