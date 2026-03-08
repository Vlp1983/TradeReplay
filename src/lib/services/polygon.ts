/**
 * Polygon.io market data service.
 *
 * Replaces Yahoo Finance as the data source for:
 *   - Intraday OHLCV bars (1-minute)
 *   - Options chain snapshots
 *   - Ticker reference data (company name, description)
 *
 * Uses process.env.POLYGON_API_KEY for authentication.
 */

import type {
  MarketContract,
  MarketChain,
  MarketChainSummary,
  NormalizedContract,
  NormalizedChain,
} from "./types";

const POLYGON_BASE = "https://api.polygon.io";
const CACHE_TTL_MS = 30_000; // 30 seconds

function apiKey(): string {
  const key = process.env.POLYGON_API_KEY;
  if (!key) throw new Error("POLYGON_API_KEY is not configured");
  return key;
}

// ─── Cache ────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const chainCache = new Map<string, CacheEntry<MarketChain>>();
const summaryCache = new Map<string, CacheEntry<MarketChainSummary>>();
const chartCache = new Map<string, CacheEntry<IntradayBar[]>>();

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

function computeMidPrice(bid: number, ask: number): number | null {
  if (bid > 0 && ask > 0) return +((bid + ask) / 2).toFixed(4);
  return null;
}

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

async function polygonFetch<T>(path: string): Promise<T> {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${POLYGON_BASE}${path}${separator}apiKey=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Polygon API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ─── Intraday Bars ──────────────────────────────────────────────────

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

interface PolygonAggResponse {
  results?: Array<{
    o: number;  // open
    h: number;  // high
    l: number;  // low
    c: number;  // close
    v: number;  // volume
    t: number;  // unix ms timestamp
  }>;
  resultsCount?: number;
  status?: string;
}

/**
 * Fetch 5-minute OHLCV bars for a ticker on a specific date.
 * Used for chart display. Enforces a 60-day lookback guard.
 */
export async function getIntradayBars(
  symbol: string,
  date: string
): Promise<IntradayBar[]> {
  // 60-day lookback guard
  const requestedDate = new Date(date + "T12:00:00Z");
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  sixtyDaysAgo.setHours(0, 0, 0, 0);

  if (requestedDate < sixtyDaysAgo) {
    const err = new Error("Date exceeds 60-day lookback limit") as Error & { code?: string };
    err.code = "LOOKBACK_EXCEEDED";
    throw err;
  }

  const key = `chart:${symbol.toUpperCase()}:${date}`;
  const cached = getCached(chartCache, key);
  if (cached) return cached;

  const ticker = symbol.toUpperCase();
  const path = `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/5/minute/${date}/${date}?adjusted=true&sort=asc&limit=500`;

  const data = await polygonFetch<PolygonAggResponse>(path);

  if (!data.results || data.results.length === 0) {
    throw new Error("No intraday data returned from Polygon");
  }

  const bars: IntradayBar[] = [];

  for (const bar of data.results) {
    const d = new Date(bar.t);
    // Convert UTC to ET (approximate: UTC-5 for EST)
    const hour = d.getUTCHours() - 5;
    const minute = d.getUTCMinutes();
    const totalMin = hour * 60 + minute;

    // Filter to regular trading hours (9:30 AM - 4:00 PM ET)
    if (totalMin < 570 || totalMin > 960) continue; // 9:30=570, 16:00=960

    const hh = hour.toString().padStart(2, "0");
    const mm = minute.toString().padStart(2, "0");
    const timeStr = `${hh}:${mm}`;

    let h12 = hour;
    const suffix = h12 >= 12 ? "PM" : "AM";
    if (h12 === 0) h12 = 12;
    else if (h12 > 12) h12 -= 12;
    const label = `${h12}:${mm} ${suffix}`;

    bars.push({
      time: timeStr,
      label,
      timestamp: bar.t,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
    });
  }

  if (bars.length === 0) {
    throw new Error("No bars within trading hours");
  }

  setCache(chartCache, key, bars);
  return bars;
}

// ─── Options Chain ───────────────────────────────────────────────────

interface PolygonOptionsSnapshotResponse {
  results?: Array<{
    details: {
      contract_type: "call" | "put";
      strike_price: number;
      expiration_date: string;
      ticker: string;
    };
    day?: {
      open?: number;
      high?: number;
      low?: number;
      close?: number;
      volume?: number;
      last_updated?: number;
    };
    greeks?: {
      delta?: number;
      gamma?: number;
      theta?: number;
      vega?: number;
    };
    implied_volatility?: number;
    open_interest?: number;
    last_quote?: {
      bid?: number;
      ask?: number;
      bid_size?: number;
      ask_size?: number;
      last_updated?: number;
      midpoint?: number;
    };
    last_trade?: {
      price?: number;
      size?: number;
    };
    underlying_asset?: {
      price?: number;
      ticker?: string;
    };
  }>;
  status?: string;
}

type PolygonOptionResult = NonNullable<PolygonOptionsSnapshotResponse["results"]>[number];

function polygonContractToMarket(
  raw: PolygonOptionResult,
): MarketContract {
  const bid = raw.last_quote?.bid ?? 0;
  const ask = raw.last_quote?.ask ?? 0;
  const lastPrice = raw.last_trade?.price ?? raw.day?.close ?? 0;
  const impliedVolatility = raw.implied_volatility ?? 0;
  const openInterest = raw.open_interest ?? 0;
  const volume = raw.day?.volume ?? 0;
  const mid = computeMidPrice(bid, ask);
  const spreadPct = computeSpreadPercent(bid, ask, mid);

  return {
    contractSymbol: raw.details.ticker,
    strike: raw.details.strike_price,
    expiration: raw.details.expiration_date,
    right: raw.details.contract_type,
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

/**
 * Fetch the options chain for a ticker and expiration date via Polygon snapshots.
 */
export async function getOptionsChain(
  symbol: string,
  expiration?: string
): Promise<MarketChain> {
  const key = `${symbol.toUpperCase()}:${expiration ?? "nearest"}`;
  const cached = getCached(chainCache, key);
  if (cached) return { ...cached };

  const ticker = symbol.toUpperCase();

  // Build the snapshot URL
  let path = `/v3/snapshot/options/${encodeURIComponent(ticker)}?limit=250`;
  if (expiration) {
    path += `&expiration_date=${expiration}`;
  }

  const data = await polygonFetch<PolygonOptionsSnapshotResponse>(path);

  if (!data.results || data.results.length === 0) {
    throw new Error(`No options data returned from Polygon for ${symbol}`);
  }

  // Extract underlying price from first result
  const underlyingPrice = data.results[0]?.underlying_asset?.price ?? 0;

  // Determine actual expiration used
  const actualExpiration = expiration ?? data.results[0]?.details.expiration_date ?? "unknown";

  const calls: MarketContract[] = [];
  const puts: MarketContract[] = [];

  for (const result of data.results) {
    // If no expiration filter was given, only include the nearest expiration
    if (!expiration && result.details.expiration_date !== actualExpiration) {
      continue;
    }

    const contract = polygonContractToMarket(result);
    if (result.details.contract_type === "call") {
      calls.push(contract);
    } else {
      puts.push(contract);
    }
  }

  // Sort by strike
  calls.sort((a, b) => a.strike - b.strike);
  puts.sort((a, b) => a.strike - b.strike);

  const chain: MarketChain = {
    symbol: ticker,
    underlyingPrice,
    expiration: actualExpiration,
    fetchedAt: Date.now(),
    calls,
    puts,
  };

  setCache(chainCache, key, chain);
  return chain;
}

/**
 * Fetch available expiration dates for a symbol.
 * Uses the options chain endpoint and extracts unique expirations.
 */
export async function getExpirations(
  symbol: string
): Promise<MarketChainSummary> {
  const key = `${symbol.toUpperCase()}:summary`;
  const cached = getCached(summaryCache, key);
  if (cached) return cached;

  const ticker = symbol.toUpperCase();

  // Fetch a broad snapshot to discover expirations
  const path = `/v3/snapshot/options/${encodeURIComponent(ticker)}?limit=250`;
  const data = await polygonFetch<PolygonOptionsSnapshotResponse>(path);

  if (!data.results || data.results.length === 0) {
    throw new Error(`No options data returned from Polygon for ${symbol}`);
  }

  const underlyingPrice = data.results[0]?.underlying_asset?.price ?? 0;

  // Collect unique expirations
  const expSet = new Set<string>();
  for (const r of data.results) {
    if (r.details.expiration_date) {
      expSet.add(r.details.expiration_date);
    }
  }
  const expirations = Array.from(expSet).sort();

  const summary: MarketChainSummary = {
    symbol: ticker,
    underlyingPrice,
    expirations,
    fetchedAt: Date.now(),
  };

  setCache(summaryCache, key, summary);
  return summary;
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
    contracts.find((c) => Math.abs(c.strike - strike) < 0.01) ?? null
  );
}

// ─── Normalization (unchanged logic from Yahoo service) ───────────────

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

export function normalizeChain(chain: MarketChain): NormalizedChain {
  const atmStrike = findATMStrike(chain);

  function normalize(contract: MarketContract): NormalizedContract {
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
 * High-level convenience: fetch + normalize in one call.
 */
export async function fetchNormalizedChain(
  symbol: string,
  expiration?: string
): Promise<NormalizedChain> {
  const raw = await getOptionsChain(symbol, expiration);
  const normalized = normalizeChain(raw);

  const key = `${symbol.toUpperCase()}:${expiration ?? "nearest"}`;
  const cachedEntry = chainCache.get(key);
  if (cachedEntry && cachedEntry.data === raw) {
    normalized.cached = true;
  }

  return normalized;
}

// ─── Ticker Details ──────────────────────────────────────────────────

export interface TickerDetails {
  ticker: string;
  name: string;
  description: string;
  market: string;
  locale: string;
  type: string;
}

interface PolygonTickerResponse {
  results?: {
    ticker: string;
    name: string;
    description?: string;
    market?: string;
    locale?: string;
    type?: string;
  };
  status?: string;
}

/**
 * Fetch company name, description, and metadata for a ticker.
 */
export async function getTickerDetails(
  symbol: string
): Promise<TickerDetails> {
  const ticker = symbol.toUpperCase();
  const path = `/v3/reference/tickers/${encodeURIComponent(ticker)}`;
  const data = await polygonFetch<PolygonTickerResponse>(path);

  if (!data.results) {
    throw new Error(`No ticker details found for ${symbol}`);
  }

  return {
    ticker: data.results.ticker,
    name: data.results.name,
    description: data.results.description ?? "",
    market: data.results.market ?? "",
    locale: data.results.locale ?? "",
    type: data.results.type ?? "",
  };
}
