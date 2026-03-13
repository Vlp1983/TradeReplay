/**
 * Fetches all required historical data for pricing.
 *
 * Data sources (in priority order):
 *   1. Polygon.io (primary)
 *   2. Yahoo Finance (fallback)
 *   3. Prior trading day retry (up to 3 attempts)
 *   4. Synthetic Brownian walk (final fallback)
 *
 * Collects:
 *   - 5-min intraday bars for the underlying on replay date
 *   - 30 prior daily bars for GARCH
 *   - Historical VIX close (Yahoo Finance, cached by date)
 *   - Risk-free rate from rates table
 *   - Ticker config
 */

import type { Bar, PricingInputs } from "./types";
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

// ─── Response types ──────────────────────────────────────────────────

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

interface YahooChartResponse {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: (number | null)[];
          high: (number | null)[];
          low: (number | null)[];
          close: (number | null)[];
          volume: (number | null)[];
        }>;
      };
    }>;
  };
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

// ─── Date helpers ────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function subtractDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() - n);
  return result;
}

/** Get the previous trading weekday (skip weekends) */
function prevTradingDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  // Skip weekends
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return formatDate(d);
}

/** Filter bars to regular trading hours: 9:30 AM - 4:00 PM ET */
function filterTradingHours(bars: Bar[]): Bar[] {
  return bars.filter((bar) => {
    const d = new Date(bar.timestamp);
    const hour = d.getUTCHours() - 5; // approximate ET
    const minute = d.getUTCMinutes();
    const totalMin = hour * 60 + minute;
    return totalMin >= 570 && totalMin <= 960;
  });
}

// ─── Yahoo Finance fetch helper ──────────────────────────────────────

const YAHOO_BASE = "https://query2.finance.yahoo.com/v8/finance/chart";

async function yahooFetch(url: string): Promise<YahooChartResponse | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    if (!res.ok) {
      console.warn(`[collectInputs] Yahoo returned ${res.status} for ${url.split("?")[0]}`);
      return null;
    }
    return res.json() as Promise<YahooChartResponse>;
  } catch (err) {
    console.warn("[collectInputs] Yahoo network error:", err);
    return null;
  }
}

// ─── Intraday bars: Polygon → Yahoo → prior day → synthetic ─────────

async function fetchIntradayPolygon(ticker: string, date: string): Promise<Bar[]> {
  const path = `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/5/minute/${date}/${date}?adjusted=true&sort=asc&limit=500`;
  try {
    const data = await polygonFetch<PolygonAggResponse>(path);
    if (!data?.results || data.results.length === 0) return [];
    return filterTradingHours(data.results.map(toBar));
  } catch {
    return [];
  }
}

async function fetchIntradayYahoo(ticker: string, date: string): Promise<Bar[]> {
  // Compute Unix timestamps for 9:30 AM - 4:00 PM ET on replayDate
  // ET = UTC-5 (EST) or UTC-4 (EDT). Use UTC-5 as safe approximation.
  const startUnix = Math.floor(new Date(date + "T14:30:00Z").getTime() / 1000); // 9:30 AM ET = 14:30 UTC
  const endUnix = Math.floor(new Date(date + "T21:00:00Z").getTime() / 1000);   // 4:00 PM ET = 21:00 UTC

  const url = `${YAHOO_BASE}/${encodeURIComponent(ticker)}?interval=5m&period1=${startUnix}&period2=${endUnix}`;
  try {
    const data = await yahooFetch(url);
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp || !result.indicators?.quote?.[0]) return [];

    const timestamps = result.timestamp;
    const q = result.indicators.quote[0];
    const bars: Bar[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const o = q.open?.[i];
      const h = q.high?.[i];
      const l = q.low?.[i];
      const c = q.close?.[i];
      const v = q.volume?.[i];
      if (o == null || h == null || l == null || c == null) continue;

      const ts = timestamps[i] * 1000;
      // Filter to 9:30 AM - 4:00 PM ET
      const d = new Date(ts);
      const hour = d.getUTCHours() - 5;
      const minute = d.getUTCMinutes();
      const totalMin = hour * 60 + minute;
      if (totalMin >= 570 && totalMin <= 960) {
        bars.push({ timestamp: ts, open: o, high: h, low: l, close: c, volume: v ?? 0 });
      }
    }
    return bars;
  } catch {
    return [];
  }
}

/** Generate synthetic 78-bar Brownian walk as final fallback */
function generateSyntheticBars(ticker: string, date: string): Bar[] {
  const tickerConfig = getTickerConfig(ticker);
  const basePrice = 100 * tickerConfig.volMultiplier;
  const bars: Bar[] = [];
  let price = basePrice;

  // 78 bars = 6.5 hours * 12 bars/hour (5-min intervals)
  const startMs = new Date(date + "T14:30:00Z").getTime(); // 9:30 AM ET
  for (let i = 0; i < 78; i++) {
    const drift = (Math.random() - 0.5) * basePrice * 0.003 * tickerConfig.volMultiplier;
    const open = price;
    const close = price + drift;
    const high = Math.max(open, close) + Math.abs(drift) * 0.3;
    const low = Math.min(open, close) - Math.abs(drift) * 0.3;
    bars.push({
      timestamp: startMs + i * 5 * 60 * 1000,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: Math.floor(100000 + Math.random() * 500000),
    });
    price = close;
  }
  return bars;
}

/** Check if bars end before 3:30 PM ET (early cutoff) */
function hasEarlyCutoff(bars: Bar[]): boolean {
  if (bars.length === 0) return true;
  const lastBar = bars[bars.length - 1];
  const d = new Date(lastBar.timestamp);
  const hour = d.getUTCHours() - 5; // approximate ET
  const minute = d.getUTCMinutes();
  const totalMin = hour * 60 + minute;
  return totalMin < 930; // 3:30 PM = 15*60+30 = 930
}

/** Full intraday fetch with fallback chain */
async function fetchIntradayWithFallback(ticker: string, date: string): Promise<Bar[]> {
  // 1. Try Polygon
  let bars = await fetchIntradayPolygon(ticker, date);

  // 2. If Polygon returned bars but they end before 3:30 PM, try Yahoo too
  if (bars.length > 0 && hasEarlyCutoff(bars)) {
    const yahooBars = await fetchIntradayYahoo(ticker, date);
    if (yahooBars.length > bars.length) {
      console.warn(`[collectInputs] ${ticker} ${date}: Polygon gave ${bars.length} bars (early cutoff). Yahoo gave ${yahooBars.length} bars. Using Yahoo.`);
      bars = yahooBars;
    }
  }

  if (bars.length > 0) return bars;

  // 3. Try Yahoo Finance as primary fallback
  bars = await fetchIntradayYahoo(ticker, date);
  if (bars.length > 0) return bars;

  // 3. Try prior trading days (max 3 attempts)
  let tryDate = date;
  for (let attempt = 0; attempt < 3; attempt++) {
    tryDate = prevTradingDay(tryDate);
    bars = await fetchIntradayPolygon(ticker, tryDate);
    if (bars.length > 0) return bars;
    bars = await fetchIntradayYahoo(ticker, tryDate);
    if (bars.length > 0) return bars;
  }

  // 4. Synthetic fallback
  console.warn("[collectInputs] using synthetic bars for", ticker, date);
  return generateSyntheticBars(ticker, date);
}

// ─── Daily bars: Polygon → Yahoo ─────────────────────────────────────

async function fetchDailyPolygon(ticker: string, startDate: string, endDate: string): Promise<Bar[]> {
  const path = `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${startDate}/${endDate}?adjusted=true&sort=asc&limit=50`;
  try {
    const data = await polygonFetch<PolygonAggResponse>(path);
    if (!data?.results || data.results.length === 0) return [];
    return data.results.map(toBar);
  } catch {
    return [];
  }
}

async function fetchDailyYahoo(ticker: string): Promise<Bar[]> {
  const url = `${YAHOO_BASE}/${encodeURIComponent(ticker)}?interval=1d&range=3mo`;
  try {
    const data = await yahooFetch(url);
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp || !result.indicators?.quote?.[0]) return [];

    const timestamps = result.timestamp;
    const q = result.indicators.quote[0];
    const bars: Bar[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const o = q.open?.[i];
      const h = q.high?.[i];
      const l = q.low?.[i];
      const c = q.close?.[i];
      const v = q.volume?.[i];
      if (o == null || h == null || l == null || c == null) continue;
      bars.push({ timestamp: timestamps[i] * 1000, open: o, high: h, low: l, close: c, volume: v ?? 0 });
    }
    return bars;
  } catch {
    return [];
  }
}

async function fetchDailyWithFallback(ticker: string, startDate: string, endDate: string): Promise<Bar[]> {
  const bars = await fetchDailyPolygon(ticker, startDate, endDate);
  if (bars.length > 0) return bars;
  return fetchDailyYahoo(ticker);
}

// ─── VIX via Yahoo Finance (cached by date) ─────────────────────────

const vixCache = new Map<string, number>();
const DEFAULT_VIX = 20.0;

async function fetchVIXWithCache(replayDate: string): Promise<number> {
  const cached = vixCache.get(replayDate);
  if (cached !== undefined) return cached;

  try {
    const url = `${YAHOO_BASE}/%5EVIX?interval=1d&range=3mo`;
    const data = await yahooFetch(url);
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp || !result.indicators?.quote?.[0]?.close) {
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
      const tsMs = timestamps[i] * 1000;
      const diff = targetMs - tsMs;
      if (diff >= 0 && diff < bestDiff && closes[i] != null) {
        bestDiff = diff;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0 && closes[bestIdx] != null) {
      const vix = closes[bestIdx]!;
      vixCache.set(replayDate, vix);
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

  // Fetch all data sources in parallel
  const [intradayBars, priorDailyBars, historicalVIX] = await Promise.all([
    fetchIntradayWithFallback(ticker, dateStr),
    fetchDailyWithFallback(ticker, priorStart, priorEnd),
    fetchVIXWithCache(dateStr),
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
