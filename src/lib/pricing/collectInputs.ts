/**
 * Fetches all required historical data for pricing.
 *
 * Collects:
 *   - 5-min intraday bars for the underlying on replay date (Polygon)
 *   - 30 prior daily bars for GARCH (Polygon)
 *   - Historical VIX close (Yahoo Finance)
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

async function polygonFetch<T>(path: string): Promise<T | null> {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${POLYGON_BASE}${path}${separator}apiKey=${apiKey()}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    console.warn(`[collectInputs] Polygon network error for ${path}:`, err);
    return null;
  }
  if (!res.ok) {
    console.warn(`[collectInputs] Polygon returned ${res.status} for ${path}`);
    return null;
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
  console.log(`[collectInputs] Fetching intraday bars: /v2/aggs/ticker/${ticker}/range/5/minute/${date}/${date}`);

  try {
    const data = await polygonFetch<PolygonAggResponse>(path);
    if (!data || !data.results || data.results.length === 0) {
      console.log(`[collectInputs] No intraday bars returned for ${ticker} on ${date}`);
      return [];
    }

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
    console.log(`[collectInputs] Intraday bars: ${bars.length} (raw: ${data.results.length}), first: O=${bars[0]?.open} H=${bars[0]?.high} L=${bars[0]?.low} C=${bars[0]?.close}, last: O=${bars[bars.length-1]?.open} C=${bars[bars.length-1]?.close}`);
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
    if (!data || !data.results || data.results.length === 0) return [];
    return data.results.map(toBar);
  } catch (err) {
    console.warn(`[collectInputs] Failed to fetch daily bars for ${ticker}:`, err);
    return [];
  }
}

// ─── VIX via Yahoo Finance ───────────────────────────────────────────

interface YahooChartResponse {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          close: (number | null)[];
        }>;
      };
    }>;
  };
}

/**
 * Fetch VIX close for a given replay date via Yahoo Finance.
 * Matches replayDate to the closest prior trading day in the 3-month range.
 * Returns the raw VIX value (e.g. 18.5) — the engine divides by 100 when using it.
 * Never throws — always returns a number.
 */
async function fetchVIX(replayDate: string): Promise<number> {
  const DEFAULT_VIX = 20.0;

  try {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=3mo";
    console.log(`[collectInputs] Fetching VIX from Yahoo Finance for date ${replayDate}`);

    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[collectInputs] Yahoo Finance returned ${res.status} for VIX`);
      return DEFAULT_VIX;
    }

    const data: YahooChartResponse = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result || !result.timestamp || !result.indicators?.quote?.[0]?.close) {
      console.warn("[collectInputs] Yahoo VIX response missing expected fields");
      return DEFAULT_VIX;
    }

    const timestamps = result.timestamp;
    const closes = result.indicators.quote[0].close;

    // Parse replayDate as midnight UTC
    const targetMs = new Date(replayDate + "T00:00:00Z").getTime();

    // Find the closest prior trading day's VIX close
    let bestIdx = -1;
    let bestDiff = Infinity;
    for (let i = 0; i < timestamps.length; i++) {
      const tsMs = timestamps[i] * 1000; // Yahoo returns seconds
      const diff = targetMs - tsMs;
      // Only consider dates on or before replayDate, pick the closest
      if (diff >= 0 && diff < bestDiff && closes[i] != null) {
        bestDiff = diff;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0 && closes[bestIdx] != null) {
      const vix = closes[bestIdx]!;
      console.log(`[collectInputs] VIX from Yahoo: ${vix} (index ${bestIdx}, ${new Date(timestamps[bestIdx] * 1000).toISOString().slice(0, 10)})`);
      return vix;
    }

    console.warn("[collectInputs] No matching VIX date found, using default");
    return DEFAULT_VIX;
  } catch (err) {
    console.warn("[collectInputs] Failed to fetch VIX from Yahoo:", err);
    return DEFAULT_VIX;
  }
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
