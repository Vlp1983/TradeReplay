/**
 * Core types for the Options Backtesting engine.
 */

export type Ticker = "SPY" | "QQQ";
export type Right = "call" | "put";
export type Expiration = "0dte" | "friday";
export type Confidence = "High" | "Med" | "Low";
export type ChartView = "pl_pct" | "pl_dollar" | "price";
export type ChartRange = "same_day" | "to_expiration";

export interface MomentSelection {
  ticker: Ticker;
  date: string;        // YYYY-MM-DD
  entryTime: string;   // HH:MM (ET)
}

export interface ChainRow {
  strike: number;
  premium: number;     // estimated premium at entry
  confidence: Confidence;
  isATM: boolean;
}

export interface ChainData {
  ticker: Ticker;
  date: string;
  entryTime: string;
  expiration: Expiration;
  underlyingPrice: number;
  calls: ChainRow[];
  puts: ChainRow[];
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
}

export interface KeyMoment {
  time: string;
  label: string;
  reason: string;
}

export interface ReplayResult {
  contract: SelectedContract;
  sameDayPoints: TimePoint[];
  toExpirationPoints: TimePoint[];
  metrics: ReplayMetrics;
  keyMoments: KeyMoment[];
}
