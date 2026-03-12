/**
 * IV estimation using a weighted ensemble of 4 methods:
 *
 *   1. Yang-Zhang realized volatility (from intraday bars)
 *   2. VIX-anchored IV (historical VIX × vol multiplier)
 *   3. GARCH(1,1) forward variance
 *   4. Historical percentile anchor
 *
 * Weights vary by DTE bucket and liquidity class.
 */

import type {
  PricingInputs,
  ContractClassification,
  Bar,
} from "./types";

// ─── Method 1: Yang-Zhang Realized Volatility ───────────────────────

function yangZhangRV(bars: Bar[]): number | null {
  if (bars.length < 5) return null;

  const n = bars.length;

  // Overnight returns: log(open_i / close_{i-1})
  // For first bar, we use open as proxy (no prior close)
  const overnightReturns: number[] = [];
  for (let i = 1; i < n; i++) {
    const prevClose = bars[i - 1].close;
    if (prevClose > 0 && bars[i].open > 0) {
      overnightReturns.push(Math.log(bars[i].open / prevClose));
    }
  }

  // Open-to-close returns
  const ocReturns: number[] = [];
  for (let i = 0; i < n; i++) {
    if (bars[i].open > 0 && bars[i].close > 0) {
      ocReturns.push(Math.log(bars[i].close / bars[i].open));
    }
  }

  // Rogers-Satchell variance from OHLC
  const rsReturns: number[] = [];
  for (let i = 0; i < n; i++) {
    const { open: o, high: h, low: l, close: c } = bars[i];
    if (o > 0 && h > 0 && l > 0 && c > 0) {
      const logHC = Math.log(h / c);
      const logHO = Math.log(h / o);
      const logLC = Math.log(l / c);
      const logLO = Math.log(l / o);
      rsReturns.push(logHC * logHO + logLC * logLO);
    }
  }

  if (ocReturns.length < 3 || rsReturns.length < 3) return null;

  // Variance calculations
  const meanOC = ocReturns.reduce((s, r) => s + r, 0) / ocReturns.length;
  const varOC =
    ocReturns.reduce((s, r) => s + (r - meanOC) ** 2, 0) /
    (ocReturns.length - 1);

  let varOvernight = 0;
  if (overnightReturns.length > 1) {
    const meanON =
      overnightReturns.reduce((s, r) => s + r, 0) / overnightReturns.length;
    varOvernight =
      overnightReturns.reduce((s, r) => s + (r - meanON) ** 2, 0) /
      (overnightReturns.length - 1);
  }

  const varRS = rsReturns.reduce((s, r) => s + r, 0) / rsReturns.length;

  // Yang-Zhang combination
  const k = 0.34 / (1.34 + (n + 1) / (n - 1));
  const yzVariance = varOvernight + k * varOC + (1 - k) * varRS;

  if (yzVariance <= 0) return null;

  // Annualize: intraday bars are 5-min, 78 bars per day, 252 trading days
  return Math.sqrt(Math.max(yzVariance, 0) * 252 * 78);
}

// ─── Method 2: VIX-Anchored IV ──────────────────────────────────────

function vixAnchoredIV(inputs: PricingInputs): number {
  return (inputs.historicalVIX / 100) * inputs.tickerConfig.volMultiplier;
}

// ─── Method 3: GARCH(1,1) ───────────────────────────────────────────

function garchIV(dailyBars: Bar[]): number | null {
  if (dailyBars.length < 5) return null;

  // Compute log returns
  const returns: number[] = [];
  for (let i = 1; i < dailyBars.length; i++) {
    if (dailyBars[i].close > 0 && dailyBars[i - 1].close > 0) {
      returns.push(Math.log(dailyBars[i].close / dailyBars[i - 1].close));
    }
  }

  if (returns.length < 3) return null;

  // GARCH(1,1) parameters
  const omega = 0.000002;
  const alpha = 0.1;
  const beta = 0.85;

  // Initialize variance with sample variance
  const meanR = returns.reduce((s, r) => s + r, 0) / returns.length;
  let h =
    returns.reduce((s, r) => s + (r - meanR) ** 2, 0) / returns.length;

  // Run GARCH recursion
  for (let i = 0; i < returns.length; i++) {
    h = omega + alpha * returns[i] * returns[i] + beta * h;
  }

  if (h <= 0) return null;

  // Annualize
  return Math.sqrt(h * 252);
}

// ─── Method 4: Historical Percentile Anchor ─────────────────────────

function historicalPercentileIV(
  dailyBars: Bar[],
  currentRV: number | null
): number | null {
  if (dailyBars.length < 25) return null;

  // Compute 21-day rolling realized vol for each window
  const rollingVols: number[] = [];
  for (let end = 21; end <= dailyBars.length; end++) {
    const window = dailyBars.slice(end - 21, end);
    const returns: number[] = [];
    for (let i = 1; i < window.length; i++) {
      if (window[i].close > 0 && window[i - 1].close > 0) {
        returns.push(
          Math.log(window[i].close / window[i - 1].close)
        );
      }
    }
    if (returns.length >= 10) {
      const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
      const variance =
        returns.reduce((s, r) => s + (r - mean) ** 2, 0) /
        (returns.length - 1);
      if (variance > 0) {
        rollingVols.push(Math.sqrt(variance * 252));
      }
    }
  }

  if (rollingVols.length < 3) return null;

  // Sort for percentile calculation
  const sorted = [...rollingVols].sort((a, b) => a - b);
  const medianVol = sorted[Math.floor(sorted.length / 2)];

  // Find percentile of current RV within distribution
  const reference = currentRV ?? medianVol;
  const belowCount = sorted.filter((v) => v <= reference).length;
  const percentile = belowCount / sorted.length;

  // Map percentile to IV: elevated regime → higher IV
  return medianVol * (1 + 0.5 * (percentile - 0.5));
}

// ─── Ensemble weights ────────────────────────────────────────────────

type WeightKey =
  | "0DTE"
  | "weekly_liquid"
  | "weekly_other"
  | "standard_liquid"
  | "illiquid_any";

const ENSEMBLE_WEIGHTS: Record<WeightKey, [number, number, number, number]> = {
  "0DTE": [0.55, 0.3, 0.1, 0.05],
  weekly_liquid: [0.4, 0.35, 0.15, 0.1],
  weekly_other: [0.3, 0.3, 0.25, 0.15],
  standard_liquid: [0.4, 0.35, 0.15, 0.1],
  illiquid_any: [0.2, 0.25, 0.35, 0.2],
};

function getWeightKey(classification: ContractClassification): WeightKey {
  const { dteBucket, liquidityClass } = classification;

  if (dteBucket === "0DTE") return "0DTE";

  if (liquidityClass === "illiquid") return "illiquid_any";

  if (dteBucket === "weekly") {
    return liquidityClass === "liquid" ? "weekly_liquid" : "weekly_other";
  }

  if (
    dteBucket === "standard" ||
    dteBucket === "short" ||
    dteBucket === "long"
  ) {
    return liquidityClass === "liquid" ? "standard_liquid" : "weekly_other";
  }

  return "weekly_other";
}

// ─── Main IV estimator ──────────────────────────────────────────────

export function estimateIV(
  inputs: PricingInputs,
  classification: ContractClassification
): number {
  // Compute all 4 methods
  const m1 = yangZhangRV(inputs.intradayBars);
  const m2 = vixAnchoredIV(inputs);
  const m3 = garchIV(inputs.priorDailyBars);
  const m4 = historicalPercentileIV(inputs.priorDailyBars, m1);
  console.log(`[estimateIV] Methods: YZ-RV=${m1?.toFixed(4) ?? "null"}, VIX-anchor=${m2.toFixed(4)}, GARCH=${m3?.toFixed(4) ?? "null"}, HistPctl=${m4?.toFixed(4) ?? "null"} (intradayBars=${inputs.intradayBars.length}, dailyBars=${inputs.priorDailyBars.length}, VIX=${inputs.historicalVIX})`);

  // Get base weights
  const key = getWeightKey(classification);
  const baseWeights = [...ENSEMBLE_WEIGHTS[key]];

  // Track available methods and their values
  const methods: (number | null)[] = [m1, m2, m3, m4];
  const availableValues: number[] = [];
  const availableWeights: number[] = [];

  // m2 (VIX-anchored) is always available, so redistribute null weights
  let totalDroppedWeight = 0;
  for (let i = 0; i < 4; i++) {
    if (methods[i] === null || methods[i] === undefined) {
      totalDroppedWeight += baseWeights[i];
      baseWeights[i] = 0;
    }
  }

  // Redistribute dropped weight proportionally among available methods
  const totalAvailable = baseWeights.reduce((s, w) => s + w, 0);
  if (totalAvailable > 0 && totalDroppedWeight > 0) {
    const scale = 1 / totalAvailable;
    for (let i = 0; i < 4; i++) {
      baseWeights[i] *= scale;
    }
  }

  // Compute weighted sum
  let iv = 0;
  for (let i = 0; i < 4; i++) {
    if (methods[i] !== null && methods[i] !== undefined) {
      iv += baseWeights[i] * (methods[i] as number);
    }
  }

  // If somehow everything failed, use VIX-based fallback
  if (iv <= 0) {
    iv = m2 > 0 ? m2 : 0.25;
  }

  // Hard cap: [0.05, 3.00]
  const finalIV = Math.max(0.05, Math.min(3.0, iv));
  console.log(`[estimateIV] Final ensemble IV: ${finalIV.toFixed(4)} (key=${key})`);
  return finalIV;
}
