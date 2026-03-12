/**
 * Generate synthetic option intraday bars from underlying 5-min bars.
 *
 * Uses a 5-factor model per bar:
 *   - Delta component (directional sensitivity)
 *   - Gamma component (convexity / 0DTE gamma explosion)
 *   - Theta decay (weighted by intraday profile)
 *   - Vega noise (deterministic, seeded)
 *   - Bar-to-bar jump limiter
 */

import type { Bar, OptionBar, TickerConfig } from "./types";
import { priceOption, computeGreeks } from "./priceOption";

// ─── Seeded LCG PRNG ────────────────────────────────────────────────

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0) || 1;
}

function createLCG(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    return (state >>> 0) / 4294967296;
  };
}

/** Returns value in [-1, 1] */
function seededNoise(rng: () => number): number {
  return rng() * 2 - 1;
}

// ─── Theta decay weight profiles ─────────────────────────────────────

function buildThetaWeights(n: number, dteBucket: string): number[] {
  const weights = new Array<number>(n);

  if (dteBucket === "0DTE") {
    // 0DTE: flat 30%, linear ramp 40%, exponential 30%
    for (let i = 0; i < n; i++) {
      const frac = i / n;
      if (frac < 0.3) {
        weights[i] = 0.5;
      } else if (frac < 0.7) {
        weights[i] = 0.5 + 2.0 * ((frac - 0.3) / 0.4);
      } else {
        const expFrac = (frac - 0.7) / 0.3;
        weights[i] = 2.5 + 3.0 * expFrac * expFrac;
      }
    }
  } else if (dteBucket === "weekly") {
    // Weekly: slightly back-weighted, more decay in final 2 hours
    for (let i = 0; i < n; i++) {
      const frac = i / n;
      if (frac < 0.75) {
        weights[i] = 0.8;
      } else {
        weights[i] = 0.8 + 2.0 * ((frac - 0.75) / 0.25);
      }
    }
  } else {
    // Standard/long: approximately linear
    for (let i = 0; i < n; i++) {
      weights[i] = 1.0;
    }
  }

  // Normalize so weights sum to 1.0
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum > 0) {
    for (let i = 0; i < n; i++) {
      weights[i] /= sum;
    }
  }

  return weights;
}

// ─── Main bar generator ──────────────────────────────────────────────

export function generateIntradayBars(params: {
  intradayBars: Bar[];
  strike: number;
  expiry: Date;
  replayDate: Date;
  optionType: "call" | "put";
  iv: number;
  spot: number;
  riskFreeRate: number;
  dteBucket: string;
  tickerConfig: TickerConfig;
}): OptionBar[] {
  const {
    intradayBars,
    strike,
    expiry,
    replayDate,
    optionType,
    iv,
    spot,
    riskFreeRate,
    dteBucket,
    tickerConfig,
  } = params;

  console.log(
    `[generateIntradayBars] optionType=${optionType} spot=${spot} strike=${strike} dte=${computeDTE(replayDate, expiry)} iv=${iv.toFixed(4)} dteBucket=${dteBucket} ` +
    `underlyingBars=${intradayBars.length} firstBar=${intradayBars[0]?.open ?? "N/A"} lastBar=${intradayBars[intradayBars.length - 1]?.close ?? "N/A"}`
  );

  if (intradayBars.length === 0) {
    // No bars: return flat line at theoretical price
    const theoretical = priceOption(spot, strike, computeDTE(replayDate, expiry), iv, riskFreeRate, optionType, dteBucket);
    console.warn("[generateIntradayBars] No intraday bars, returning synthetic flat line");
    return [{
      timestamp: replayDate.getTime(),
      open: theoretical,
      high: theoretical,
      low: theoretical,
      close: theoretical,
    }];
  }

  const n = intradayBars.length;
  const totalBarsInDay = 78; // 5-min bars in a trading day

  // Seed deterministic RNG
  const seedStr = `${tickerConfig.ticker}${replayDate.toISOString()}${strike}${expiry.toISOString()}`;
  const rng = createLCG(simpleHash(seedStr));

  // Build theta decay weights
  const thetaWeights = buildThetaWeights(n, dteBucket);

  // Compute DTE for the day
  const dte = computeDTE(replayDate, expiry);

  // Price the option at the open to anchor the first bar
  const openPrice = priceOption(
    spot,
    strike,
    dte,
    iv,
    riskFreeRate,
    optionType,
    dteBucket
  );
  console.log(`[generateIntradayBars] spot=${spot}, strike=${strike}, dte=${dte}, iv=${iv.toFixed(4)}, openPrice=${openPrice.toFixed(4)}, bars=${n}`);

  const optionBars: OptionBar[] = [];
  let currentPrice = openPrice;

  for (let i = 0; i < n; i++) {
    const bar = intradayBars[i];
    const barSpot = bar.close;

    // Compute remaining DTE fraction: decrease through the day
    const dayFraction = Math.min(i / Math.max(n - 1, 1), 1);
    const remainingDTE = Math.max(dte - dayFraction / 365, 1e-8);

    // Get Greeks at current state
    const greeks = computeGreeks(
      i === 0 ? spot : intradayBars[Math.max(0, i - 1)].close,
      strike,
      remainingDTE,
      iv,
      riskFreeRate,
      optionType
    );

    if (i === 0) {
      // First bar: open at theoretical price
      const barOpen = openPrice;
      const barClose = openPrice;
      optionBars.push({
        timestamp: bar.timestamp,
        open: +barOpen.toFixed(2),
        high: +Math.max(barOpen, barClose).toFixed(2),
        low: +Math.max(0.01, Math.min(barOpen, barClose)).toFixed(2),
        close: +barClose.toFixed(2),
      });
      currentPrice = barClose;
      continue;
    }

    const barOpen = currentPrice;
    const underlyingReturn =
      bar.open > 0 ? (bar.close - bar.open) / bar.open : 0;

    // ── Factor 1: Delta component ──
    const deltaMove = greeks.delta * underlyingReturn * currentPrice;

    // ── Factor 2: Gamma component ──
    // For 0DTE near ATM, gamma becomes dominant — intentionally large
    const spotMove = underlyingReturn * (i === 0 ? spot : intradayBars[i - 1].close);
    const gammaMove =
      currentPrice > 0
        ? (0.5 * greeks.gamma * spotMove * spotMove) / Math.max(currentPrice, 0.01)
        : 0;

    // ── Factor 3: Theta decay ──
    // theta is per calendar day, thetaWeights distribute across intraday
    const thetaDecay = greeks.theta * thetaWeights[i] * (1 / totalBarsInDay) * n;

    // ── Factor 4: Vega noise ──
    const vegaNoise = greeks.vega * seededNoise(rng) * 0.02;

    // ── Combine ──
    let barClose = currentPrice + deltaMove + gammaMove + thetaDecay + vegaNoise;

    // ── Bar-to-bar jump limiter ──
    const maxMove = Math.abs(underlyingReturn) > 0.015 ? 0.8 : 0.4;
    if (barOpen > 0.01) {
      const barReturn = (barClose - barOpen) / barOpen;
      if (Math.abs(barReturn) > maxMove) {
        barClose = barOpen * (1 + Math.sign(barReturn) * maxMove);
      }
    }

    // Floor
    barClose = Math.max(0.01, barClose);

    // OHLC
    const high =
      Math.max(barOpen, barClose) * (1 + Math.abs(seededNoise(rng)) * 0.003);
    const low =
      Math.min(barOpen, barClose) * (1 - Math.abs(seededNoise(rng)) * 0.003);

    optionBars.push({
      timestamp: bar.timestamp,
      open: +barOpen.toFixed(2),
      high: +Math.max(0.01, high).toFixed(2),
      low: +Math.max(0.01, low).toFixed(2),
      close: +barClose.toFixed(2),
    });

    currentPrice = barClose;
  }

  console.log(`[generateIntradayBars] Output: ${optionBars.length} bars, first open=${optionBars[0]?.open}, last close=${optionBars[optionBars.length - 1]?.close}`);
  return optionBars;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function computeDTE(replayDate: Date, expiry: Date): number {
  const msPerDay = 86400000;
  const diff = expiry.getTime() - replayDate.getTime();
  return Math.max(0, Math.round(diff / msPerDay));
}
