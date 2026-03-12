/**
 * Fetches all required historical data from Polygon for pricing.
 *
 * Collects:
 *   - 5-min intraday bars for the underlying on replay date
 *   - 30 prior daily bars for GARCH
 *   - Historical VIX close
 *   - Risk-free rate from rates table
 *   - Ticker config
 */

import type { Bar, PricingInputs, TickerConfig } from "./types";
import { getRiskFreeRate } from "./config/ratesTable";
import { getTickerConfig } from "./config/tickers";

// ─── Polygon fetch helper ────────────────────────────────────────────

const POLYGON_BASE = "https://api.polygon.io";

function apiKey(): string {
  const key =
    process.env.NEXT_PUBLIC_POLYGON_API_KEY ??
    process.env.POLYGON_API_KEY;
  if (!key) throw new Error("POLYGON_API_KEY is not configured");
  return key;
}

async function polygonFetch<T>(path: string): Promise<T> {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${POLYGON_BASE}${path}${separator}apiKey=${apiKey()}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Polygon API request failed");
  }
  if (!res.ok) {
    throw new Error(`Polygon API request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// ─── Polygon response types ─────────────────────────────────────────

interface PolygonAggResponse {
  results?: Array<{
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
    t: number;
  }>;
  resultsCount?: number;
}

function toBar(raw: { o: number; h: number; l: number; c: number; v: number; t: number }): Bar {
  return {
    timestamp: raw.t,
    open: raw.o,
    high: raw.h,
    low: raw.l,
    close: raw.c,
    volume: raw.v,
  };
}

// ─── Date formatting ─────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function subtractDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() - n);
  return result;
}

// ─── Fetch functions ─────────────────────────────────────────────────

async function fetchIntradayBars(
  ticker: string,
  date: string
): Promise<Bar[]> {
  const path = `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/5/minute/${date}/${date}?adjusted=true&sort=asc&limit=500`;

  try {
    const data = await polygonFetch<PolygonAggResponse>(path);
    if (!data.results || data.results.length === 0) return [];

    const bars: Bar[] = [];
    for (const raw of data.results) {
      const d = new Date(raw.t);
      const hour = d.getUTCHours() - 5; // approximate ET
      const minute = d.getUTCMinutes();
      const totalMin = hour * 60 + minute;

      // Regular trading hours: 9:30 - 16:00 ET
      if (totalMin >= 570 && totalMin <= 960) {
        bars.push(toBar(raw));
      }
    }
    return bars;
  } catch (err) {
    console.warn(`[collectInputs] Failed to fetch intraday bars for ${ticker}:`, err);
    return [];
  }
}

async function fetchDailyBars(
  ticker: string,
  startDate: string,
  endDate: string
): Promise<Bar[]> {
  const path = `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${startDate}/${endDate}?adjusted=true&sort=asc&limit=50`;

  try {
    const data = await polygonFetch<PolygonAggResponse>(path);
    if (!data.results || data.results.length === 0) return [];
    return data.results.map(toBar);
  } catch (err) {
    console.warn(`[collectInputs] Failed to fetch daily bars for ${ticker}:`, err);
    return [];
  }
}

async function fetchVIX(date: string): Promise<number> {
  const path = `/v2/aggs/ticker/I:VIX/range/1/day/${date}/${date}?adjusted=true`;

  try {
    const data = await polygonFetch<PolygonAggResponse>(path);
    if (data.results && data.results.length > 0) {
      return data.results[0].c;
    }
  } catch (err) {
    console.warn(`[collectInputs] Failed to fetch VIX:`, err);
  }

  return 20; // safe default: VIX = 20
}

// ─── Main collection function ────────────────────────────────────────

export async function collectInputs(
  ticker: string,
  replayDate: Date,
  strike: number,
  expiry: Date,
  optionType: "call" | "put"
): Promise<PricingInputs> {
  const dateStr = formatDate(replayDate);
  const priorStart = formatDate(subtractDays(replayDate, 45)); // ~30 trading days
  const priorEnd = formatDate(subtractDays(replayDate, 1));

  // Fetch all data in parallel
  const [intradayBars, priorDailyBars, historicalVIX] = await Promise.all([
    fetchIntradayBars(ticker, dateStr),
    fetchDailyBars(ticker, priorStart, priorEnd),
    fetchVIX(dateStr),
  ]);

  const underlyingOpenPrice =
    intradayBars.length > 0 ? intradayBars[0].open : 0;

  const riskFreeRate = getRiskFreeRate(replayDate);
  const tickerConfig = getTickerConfig(ticker);

  return {
    intradayBars,
    priorDailyBars,
    historicalVIX,
    underlyingOpenPrice,
    riskFreeRate,
    tickerConfig,
  };
}
