/**
 * Core types for the Options Backtesting engine.
 */

// ─── Tickers ─────────────────────────────────────────────────────────

/** Ticker is now a plain string — the 500+ universe lives in /lib/pricing/config/tickers.ts */
export type Ticker = string;

export type Right = "call" | "put";
export type Expiration = "0dte" | "friday";
export type Confidence = "High" | "Med" | "Low";
export type ChartView = "pl_pct" | "pl_dollar" | "price";
export type ChartRange = "same_day" | "to_expiration";

/** @deprecated Use hasDailyOptions() from dailyOptions.ts instead */
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
  dteAtEntry: number;           // days to expiry at entry
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
