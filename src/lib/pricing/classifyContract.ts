/**
 * Contract classification: DTE bucket, liquidity class, moneyness,
 * and approximate delta for routing decisions.
 */

import type {
  ContractClassification,
  DteBucket,
  LiquidityClass,
  MoneynessClass,
  OptionType,
  TickerConfig,
} from "./types";
import { getTopTickers, isKnownTicker } from "./config/tickers";

// ─── Simple BS delta for classification only ─────────────────────────

function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * z);
  const y =
    1.0 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z));
  return 0.5 * (1.0 + sign * y);
}

function approxDelta(
  spot: number,
  strike: number,
  dte: number,
  optionType: OptionType
): number {
  const T = Math.max(dte / 365, 0.0001);
  const sigma = 0.3; // placeholder for classification
  const r = 0.045;

  if (spot <= 0 || strike <= 0) return optionType === "call" ? 0.5 : -0.5;

  const d1 =
    (Math.log(spot / strike) + (r + 0.5 * sigma * sigma) * T) /
    (sigma * Math.sqrt(T));

  const callDelta = normalCDF(d1);
  return optionType === "call" ? callDelta : callDelta - 1;
}

// ─── Top 50 tickers cache ────────────────────────────────────────────

let _top50Set: Set<string> | null = null;
function getTop50Set(): Set<string> {
  if (!_top50Set) {
    _top50Set = new Set(getTopTickers(50).map((t) => t.ticker));
  }
  return _top50Set;
}

// ─── Main classifier ────────────────────────────────────────────────

export function classifyContract(params: {
  ticker: string;
  spot: number;
  strike: number;
  dte: number;
  optionType: OptionType;
  tickerConfig: TickerConfig;
}): ContractClassification {
  const { ticker, spot, strike, dte, optionType, tickerConfig } = params;

  // DTE bucket
  let dteBucket: DteBucket;
  if (dte === 0) dteBucket = "0DTE";
  else if (dte <= 7) dteBucket = "weekly";
  else if (dte <= 21) dteBucket = "short";
  else if (dte <= 60) dteBucket = "standard";
  else dteBucket = "long";

  // Approximate delta
  const delta = approxDelta(spot, strike, dte, optionType);
  const absDelta = Math.abs(delta);

  // Moneyness class
  let moneynessClass: MoneynessClass;
  if (absDelta >= 0.85) moneynessClass = "deep_itm";
  else if (absDelta >= 0.6) moneynessClass = "itm";
  else if (absDelta >= 0.4) moneynessClass = "atm";
  else if (absDelta >= 0.15) moneynessClass = "otm";
  else moneynessClass = "deep_otm";

  // Liquidity class
  const top50 = getTop50Set();
  const isTop50 = top50.has(ticker.toUpperCase());
  const isInUniverse = isKnownTicker(ticker);
  const isATMOrITM =
    moneynessClass === "atm" ||
    moneynessClass === "itm" ||
    moneynessClass === "deep_itm";

  let liquidityClass: LiquidityClass;
  if (isTop50 && isATMOrITM && dte <= 30) {
    liquidityClass = "liquid";
  } else if (
    isInUniverse &&
    dte <= 60 &&
    moneynessClass !== "deep_otm"
  ) {
    liquidityClass = "semi_liquid";
  } else {
    liquidityClass = "illiquid";
  }

  return {
    dteBucket,
    liquidityClass,
    moneynessClass,
    delta: +delta.toFixed(4),
  };
}
