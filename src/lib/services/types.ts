/**
 * Types for the market data service (Polygon.io).
 * These represent real market data normalized for our
 * dual-confirmation backtesting engine.
 */

/** Raw contract data pulled from market data provider */
export interface MarketContract {
  contractSymbol: string;
  strike: number;
  expiration: string; // YYYY-MM-DD
  right: "call" | "put";
  bid: number;
  ask: number;
  lastPrice: number;
  impliedVolatility: number;
  openInterest: number;
  volume: number;
  /** (bid + ask) / 2 — only valid when both bid and ask > 0 */
  midPrice: number | null;
  /** (ask - bid) / midPrice — measures liquidity; null if midPrice is invalid */
  spreadPercent: number | null;
  /** Greeks from Polygon snapshot (may be null if unavailable) */
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
  };
}

/** Full options chain for a single expiration date */
export interface MarketChain {
  symbol: string;
  underlyingPrice: number;
  expiration: string; // YYYY-MM-DD
  fetchedAt: number; // Unix ms timestamp
  calls: MarketContract[];
  puts: MarketContract[];
}

/** All available expirations for a symbol */
export interface MarketChainSummary {
  symbol: string;
  underlyingPrice: number;
  expirations: string[]; // YYYY-MM-DD[]
  fetchedAt: number;
}

/**
 * Normalized contract output for the dual-confirmation engine.
 * Bridges real market data → our ChainRow / SelectedContract types.
 */
export interface NormalizedContract {
  contractSymbol: string;
  strike: number;
  expiration: string;
  right: "call" | "put";
  /** Best available price: midpoint > (bid+ask)/2 > day.close > BS estimate */
  premium: number;
  premiumSource: "mid" | "last" | "estimated";
  /** Confidence based on spread tightness + volume */
  confidence: "High" | "Med" | "Low";
  isATM: boolean;
  /** Raw market fields for transparency */
  market: {
    bid: number;
    ask: number;
    lastPrice: number;
    midPrice: number | null;
    spreadPercent: number | null;
    impliedVolatility: number;
    openInterest: number;
    volume: number;
  };
  /** Greeks from Polygon (may be undefined if not available) */
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
  };
}

/** Full normalized chain ready for the UI */
export interface NormalizedChain {
  symbol: string;
  underlyingPrice: number;
  expiration: string;
  fetchedAt: number;
  cached: boolean;
  calls: NormalizedContract[];
  puts: NormalizedContract[];
}

/** API error response */
export interface OptionsAPIError {
  error: string;
  symbol?: string;
  details?: string;
}

/** Query params for the /api/options endpoint */
export interface OptionsQuery {
  symbol: string;
  expiration?: string; // YYYY-MM-DD — if omitted, returns first available
  strike?: number; // filter to specific strike
  right?: "call" | "put"; // filter to calls or puts
}
