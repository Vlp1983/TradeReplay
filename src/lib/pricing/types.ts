/**
 * Shared types for the synthetic pricing engine.
 *
 * All interfaces used across /lib/pricing modules are defined here
 * so ContractReplay and other consumers can import them cleanly.
 */

// ─── Config Types ────────────────────────────────────────────────────

export interface TickerConfig {
  ticker: string;
  tickerCategory: "index_etf" | "single_name";
  betaProxy: number;
  volMultiplier: number;
  sabrRho: number;
}

// ─── Bar Types ───────────────────────────────────────────────────────

export interface Bar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OptionBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// ─── Classification ──────────────────────────────────────────────────

export type DteBucket = "0DTE" | "weekly" | "short" | "standard" | "long";
export type LiquidityClass = "liquid" | "semi_liquid" | "illiquid";
export type MoneynessClass =
  | "deep_itm"
  | "itm"
  | "atm"
  | "otm"
  | "deep_otm";

export interface ContractClassification {
  dteBucket: DteBucket;
  liquidityClass: LiquidityClass;
  moneynessClass: MoneynessClass;
  delta: number;
}

// ─── Pricing Inputs ──────────────────────────────────────────────────

export interface PricingInputs {
  intradayBars: Bar[];
  priorDailyBars: Bar[];
  historicalVIX: number;
  underlyingOpenPrice: number;
  riskFreeRate: number;
  tickerConfig: TickerConfig;
}

// ─── Greeks ──────────────────────────────────────────────────────────

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

// ─── Strike Chain ────────────────────────────────────────────────────

export interface Strike {
  strike: number;
  label: string;
}

export interface StrikeChain {
  calls: Strike[];
  puts: Strike[];
  atmStrike: number;
}

// ─── Expiry ──────────────────────────────────────────────────────────

export type ExpiryType = "0DTE" | "weekly";

export interface Expiry {
  date: Date;
  label: string;
  dte: number;
  type: ExpiryType;
}

// ─── Main Output ─────────────────────────────────────────────────────

export interface OptionPricingResult {
  bars: OptionBar[];
  greeksAtOpen: Greeks;
  ivUsed: number;
  classification: ContractClassification;
  strikeChain: StrikeChain;
  expiries: Expiry[];
}

export type OptionType = "call" | "put";
