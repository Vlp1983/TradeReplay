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

// ─── Synthetic underlying bar generator ─────────────────────────────

/**
 * When Polygon returns < 2 bars, generate 78 synthetic 5-min underlying
 * bars using spot as anchor with seeded Brownian-style walk.
 * This ensures the chart always has meaningful movement.
 */
function generateSyntheticUnderlyingBars(
  spot: number,
  iv: number,
  replayDate: Date,
  rng: () => number
): Bar[] {
  const n = 78; // full trading day of 5-min bars
  const bars: Bar[] = [];
  // 9:30 AM ET = 14:30 UTC
  const marketOpenMs = new Date(replayDate).setUTCHours(14, 30, 0, 0);

  // Per-bar volatility: annualized IV → 5-min vol
  // σ_bar = IV * sqrt(5 / (252 * 390))
  const barVol = iv * Math.sqrt(5 / (252 * 390));

  let currentSpot = spot;

  for (let i = 0; i < n; i++) {
    const timestamp = marketOpenMs + i * 5 * 60 * 1000;
    const barOpen = currentSpot;

    // Brownian increment with slight mean-reversion toward spot
    const noise = seededNoise(rng);
    const meanReversion = -0.05 * (currentSpot - spot) / spot;
    const move = currentSpot * (barVol * noise + meanReversion * barVol);

    const barClose = Math.max(barOpen * 0.95, barOpen + move);
    const barHigh = Math.max(barOpen, barClose) * (1 + Math.abs(seededNoise(rng)) * barVol * 0.5);
    const barLow = Math.min(barOpen, barClose) * (1 - Math.abs(seededNoise(rng)) * barVol * 0.5);

    bars.push({
      timestamp,
      open: barOpen,
      high: barHigh,
      low: Math.max(0.01, barLow),
      close: barClose,
      volume: 1000000,
    });

    currentSpot = barClose;
  }

  return bars;
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
  let { intradayBars } = params;

  console.log(
    `[generateIntradayBars] optionType=${optionType} spot=${spot} strike=${strike} dte=${computeDTE(replayDate, expiry)} iv=${iv.toFixed(4)} dteBucket=${dteBucket} ` +
    `underlyingBars=${intradayBars.length} firstBar=${intradayBars[0]?.open ?? "N/A"} lastBar=${intradayBars[intradayBars.length - 1]?.close ?? "N/A"}`
  );

  // Seed deterministic RNG (do this BEFORE synthetic bar generation so seed is consistent)
  const seedStr = `${tickerConfig.ticker}${replayDate.toISOString()}${strike}${expiry.toISOString()}`;
  const rng = createLCG(simpleHash(seedStr));

  // If fewer than 2 bars, generate synthetic underlying bars for a full trading day
  if (intradayBars.length < 2) {
    console.warn(
      `[generateIntradayBars] Only ${intradayBars.length} underlying bars — generating synthetic 78-bar underlying array`
    );
    intradayBars = generateSyntheticUnderlyingBars(spot, iv, replayDate, rng);
  }

  const n = intradayBars.length;
  const totalBarsInDay = 78; // 5-min bars in a trading day

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
  let zeroDeltaCount = 0;

  for (let i = 0; i < n; i++) {
    const bar = intradayBars[i];

    // Compute remaining DTE fraction: decrease through the day
    const dayFraction = Math.min(i / Math.max(n - 1, 1), 1);
    const remainingDTE = Math.max(dte - dayFraction / 365, 1e-8);

    // Get the current underlying spot for Greeks computation
    const currentSpot = i === 0 ? spot : intradayBars[Math.max(0, i - 1)].close;

    // Get Greeks at current state
    const greeks = computeGreeks(
      currentSpot,
      strike,
      remainingDTE,
      iv,
      riskFreeRate,
      optionType
    );

    if (i === 0) {
      // First bar: use theoretical price, but allow movement within this bar
      const underlyingDollarMove = bar.close - bar.open;
      const firstBarDelta = greeks.delta * underlyingDollarMove;
      const barOpen = openPrice;
      const barClose = Math.max(0.01, openPrice + firstBarDelta);
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

    // Underlying dollar move for this bar (NOT percentage — delta is dOption/dSpot)
    const underlyingDollarMove = bar.close - bar.open;
    const underlyingReturn =
      bar.open > 0 ? underlyingDollarMove / bar.open : 0;

    // ── Factor 1: Delta component ──
    // Delta = dOption/dSpot, so option dollar change = delta * spot dollar change
    const deltaMove = greeks.delta * underlyingDollarMove;

    if (deltaMove === 0 && i <= 5) {
      zeroDeltaCount++;
    }

    // ── Factor 2: Gamma component ──
    // Gamma = d²Option/dSpot², so contribution = 0.5 * gamma * (spotMove)²
    const gammaMove = 0.5 * greeks.gamma * underlyingDollarMove * underlyingDollarMove;

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

  // Warn if first 5 bars all had zero delta movement
  if (zeroDeltaCount >= 5) {
    console.warn(
      `[generateIntradayBars] WARNING: First ${zeroDeltaCount} bars all had deltaMove === 0. ` +
      `Check that underlying bars have actual price movement.`
    );
  }

  console.log(`[generateIntradayBars] Output: ${optionBars.length} bars, first open=${optionBars[0]?.open}, last close=${optionBars[optionBars.length - 1]?.close}`);

  // Sanity check: verify put/call directional behavior
  if (optionBars.length >= 2 && intradayBars.length >= 2) {
    const firstBarClose = optionBars[0].close;
    const lastBarClose = optionBars[optionBars.length - 1].close;
    const optionMove = lastBarClose - firstBarClose;
    const underlyingMove = intradayBars[intradayBars.length - 1].close - intradayBars[0].open;
    console.log('[sanity check]', {
      optionType,
      underlyingMoveTotal: underlyingMove.toFixed(2),
      optionMoveTotal: optionMove.toFixed(4),
      expectedDirection: optionType === 'call' ? 'same as underlying' : 'opposite',
    });
  }

  return optionBars;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function computeDTE(replayDate: Date, expiry: Date): number {
  const msPerDay = 86400000;
  const diff = expiry.getTime() - replayDate.getTime();
  return Math.max(0, Math.round(diff / msPerDay));
}
