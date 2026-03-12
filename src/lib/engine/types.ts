/**
 * Core types for the Options Backtesting engine.
 */

// ─── Asset classes ────────────────────────────────────────────────────

export type AssetClass = "options" | "futures" | "crypto";

// ─── Tickers by asset class ──────────────────────────────────────────

export type OptionsTicker = "SPY" | "QQQ" | "AAPL" | "TSLA" | "NVDA" | "AMZN";
export type FuturesTicker = "ES" | "NQ" | "CL" | "GC" | "SI";
export type CryptoTicker = "BTC" | "ETH" | "SOL" | "DOGE" | "XRP";

export type Ticker = OptionsTicker | FuturesTicker | CryptoTicker;

export const ASSET_CLASS_TICKERS: Record<AssetClass, Ticker[]> = {
  options: ["SPY", "QQQ", "AAPL", "TSLA", "NVDA", "AMZN"],
  futures: ["ES", "NQ", "CL", "GC", "SI"],
  crypto: ["BTC", "ETH", "SOL", "DOGE", "XRP"],
};

export const TICKER_LABELS: Record<Ticker, string> = {
  SPY: "SPY — S&P 500 ETF",
  QQQ: "QQQ — Nasdaq 100 ETF",
  AAPL: "AAPL — Apple",
  TSLA: "TSLA — Tesla",
  NVDA: "NVDA — Nvidia",
  AMZN: "AMZN — Amazon",
  ES: "/ES — E-mini S&P 500",
  NQ: "/NQ — E-mini Nasdaq 100",
  CL: "/CL — Crude Oil",
  GC: "/GC — Gold",
  SI: "/SI — Silver",
  BTC: "BTC — Bitcoin",
  ETH: "ETH — Ethereum",
  SOL: "SOL — Solana",
  DOGE: "DOGE — Dogecoin",
  XRP: "XRP — XRP",
};

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  options: "Options",
  futures: "Futures",
  crypto: "Crypto",
};

/** Determine asset class for a ticker. */
export function getAssetClass(ticker: Ticker): AssetClass {
  if ((ASSET_CLASS_TICKERS.options as string[]).includes(ticker)) return "options";
  if ((ASSET_CLASS_TICKERS.futures as string[]).includes(ticker)) return "futures";
  return "crypto";
}

export type Right = "call" | "put";
export type Expiration = "0dte" | "friday";
export type Confidence = "High" | "Med" | "Low";
export type ChartView = "pl_pct" | "pl_dollar" | "price";
export type ChartRange = "same_day" | "to_expiration";

/** Tickers known to have 0DTE (same-day) expirations */
export const ZERO_DTE_TICKERS = [
  "SPY", "QQQ", "IWM", "AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "SPX", "NDX",
] as const;

export interface MomentSelection {
  ticker: Ticker;
  date: string;        // YYYY-MM-DD
  entryTime: string;   // HH:MM (ET)
}

export interface ChainRow {
  strike: number;
  premium: number;     // best available premium at entry
  confidence: Confidence;
  isATM: boolean;
  /** "mid" = from bid/ask midpoint, "last" = last trade, "estimated" = BS fallback */
  premiumSource?: "mid" | "last" | "estimated";
  /** Greeks from Polygon (may be undefined) */
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
  };
  /** Real IV from Polygon (may be undefined) */
  impliedVolatility?: number;
}

export interface ChainData {
  ticker: Ticker;
  date: string;
  entryTime: string;
  expiration: Expiration;
  underlyingPrice: number;
  calls: ChainRow[];
  puts: ChainRow[];
  /** Whether this chain is from live Polygon data or synthetic BS */
  source?: "polygon" | "synthetic";
  /** Available expiration dates from Polygon */
  availableExpirations?: string[];
}

export interface SelectedContract {
  ticker: Ticker;
  date: string;
  entryTime: string;
  expiration: Expiration;
  strike: number;
  right: Right;
  entryPremium: number;
  confidence: Confidence;
}

export interface TimePoint {
  time: string;        // HH:MM or date string
  label: string;       // display label
  price: number;       // estimated premium at this point
  pl_dollar: number;   // P/L in dollars (per contract = 100x)
  pl_pct: number;      // P/L in percent
  dayIndex: number;    // 0 = entry day, 1 = next day, etc.
}

export interface ReplayMetrics {
  entryPremium: number;
  exitPremium: number;          // per-share premium at close
  exitAtClosePL: number;        // $ per contract
  exitAtClosePLPct: number;     // %
  maxProfit: number;            // MFE in $
  maxProfitPct: number;
  maxProfitTime: string;
  maxDrawdown: number;          // MAE in $
  maxDrawdownPct: number;
  maxDrawdownTime: string;
  optimalExitTime: string;
  optimalExitPL: number;
  optimalExitPLPct: number;
  optimalExitPremium: number;   // per-share premium at optimal exit
  optimalExitReason: string;    // why this was the optimal exit
  ivAtEntry: number;            // implied volatility at entry (0-1 scale)
  deltaAtEntry: number;         // option delta at entry
  gammaAtEntry: number;         // option gamma at entry
  thetaAtEntry: number;         // option theta at entry (per day)
  vegaAtEntry: number;          // option vega at entry (per 1% IV)
}

export interface KeyMoment {
  time: string;
  label: string;
  reason: string;
  type?: "trade" | "news";
}

export interface ReplayResult {
  contract: SelectedContract;
  sameDayPoints: TimePoint[];
  toExpirationPoints: TimePoint[];
  metrics: ReplayMetrics;
  keyMoments: KeyMoment[];
  /** AI-generated or data-driven contextual insights (3-5 bullets) */
  insights?: string[];
  insightsSource?: "ai" | "data-driven";
}
