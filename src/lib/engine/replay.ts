/**
 * Generate the full contract replay — price path, P/L series,
 * metrics, and key insights.
 *
 * Premium reconstruction uses 5 factors at each 5-minute bar:
 *   1. Delta movement  — ΔS × delta (underlying price change)
 *   2. Theta decay     — time-based erosion (accelerates near expiry)
 *   3. Gamma accel     — 0.5 × gamma × ΔS² (convexity adjustment)
 *   4. Vega / IV noise — small deterministic IV fluctuations
 *   5. SABR skew       — volatility smile shifts with moneyness
 *
 * When real Polygon intraday bars are available, uses REAL underlying
 * prices. Falls back to improved synthetic path with microstructure.
 */

import type {
  SelectedContract,
  TimePoint,
  ReplayMetrics,
  KeyMoment,
  ReplayResult,
} from "./types";
import type { IntradayBar } from "@/lib/services/polygon";
import {
  getUnderlyingPrice,
  getImpliedVol,
  computeDelta,
  BASE_VOLATILITY,
  seedFromMoment,
  blackScholesPrice,
  blackScholesTheta,
  blackScholesGamma,
  blackScholesVega,
  getSABRSkewedIV,
  getIVNoise,
} from "./pricing";
import { getExpirationDays } from "./chain";

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Replay a selected contract from entry to expiration.
 * Pass real intraday bars for the underlying to get realistic pricing.
 */
export function replayContract(
  contract: SelectedContract,
  intradayBars?: IntradayBar[]
): ReplayResult {
  const {
    ticker,
    date,
    entryTime,
    expiration,
    strike,
    right,
  } = contract;

  const isCall = right === "call";
  const expirationDays = getExpirationDays(date, expiration);
  const baseVol = BASE_VOLATILITY[ticker] ?? 0.22;
  const r = 0.05;
  const hasRealData = intradayBars && intradayBars.length >= 5;

  // Seeded PRNG for deterministic IV noise
  const ivRng = seedFromMoment(ticker, date, entryTime, 99);

  let allPoints: TimePoint[];
  let entryIV: number;
  let entryDelta: number;

  if (hasRealData) {
    // ── REAL DATA PATH: Use actual underlying prices + 5-factor model ──
    const entryMinutes = parseTimeMinutes(entryTime);
    const filtered = intradayBars.filter(
      (b) => parseTimeMinutes(b.time) >= entryMinutes
    );
    const bars = filtered.length >= 3 ? filtered : intradayBars;

    // Entry bar: compute initial IV with SABR skew
    const entryUnderlying = bars[0].close;
    const rawIV = getImpliedVol(entryUnderlying, strike, baseVol);
    entryIV = getSABRSkewedIV(entryUnderlying, strike, computeT(bars[0].time, expirationDays), rawIV, isCall);

    // Entry T and delta
    const entryT = computeT(bars[0].time, expirationDays);
    entryDelta = computeDelta(entryUnderlying, strike, entryT, isCall, entryIV, r);

    // Compute entry premium via full BS
    const entryBSPremium = blackScholesPrice(entryUnderlying, strike, entryT, isCall, entryIV, r);

    allPoints = [];
    let prevPremium = entryBSPremium;
    let prevS = entryUnderlying;
    let currentIV = entryIV;

    for (let i = 0; i < bars.length; i++) {
      const S = bars[i].close;
      const T = computeT(bars[i].time, expirationDays);

      if (i === 0) {
        // Entry point — use full BS price
        prevPremium = entryBSPremium;
        prevS = S;
        allPoints.push({
          time: bars[i].time,
          label: bars[i].label,
          price: +Math.max(entryBSPremium, 0.01).toFixed(2),
          pl_dollar: 0,
          pl_pct: 0,
          dayIndex: 0,
        });
        continue;
      }

      // ── Factor 1: Delta movement ─────────────────────────────
      const delta = computeDelta(prevS, strike, T, isCall, currentIV, r);
      const deltaS = S - prevS;
      const deltaPnL = delta * deltaS;

      // ── Factor 2: Theta decay ────────────────────────────────
      // Time elapsed = 5 minutes = 5/(390*252) years
      const theta = blackScholesTheta(prevS, strike, T, isCall, currentIV, r);
      const thetaPnL = theta * (5 / (60 * 24)); // theta is per calendar day, 5 min fraction

      // ── Factor 3: Gamma acceleration ─────────────────────────
      const gamma = blackScholesGamma(prevS, strike, T, currentIV, r);
      const gammaPnL = 0.5 * gamma * deltaS * deltaS;

      // ── Factor 4: Vega / IV noise ───────────────────────────
      const ivNoiseMult = getIVNoise(ivRng, i, 0.015);
      const newIV = currentIV * ivNoiseMult;
      const vega = blackScholesVega(prevS, strike, T, currentIV, r);
      const ivChange = (newIV - currentIV) * 100; // vega is per 1% change
      const vegaPnL = vega * ivChange;

      // ── Factor 5: SABR skew adjustment ──────────────────────
      // Re-compute skewed IV at the new spot and time
      const sabrIV = getSABRSkewedIV(S, strike, T, baseVol, isCall);
      // Blend: 80% previous IV path + 20% SABR recalculation
      currentIV = 0.8 * newIV + 0.2 * sabrIV;

      // ── Combine all factors ─────────────────────────────────
      let premium = prevPremium + deltaPnL + thetaPnL + gammaPnL + vegaPnL;

      // Sanity: re-anchor to full BS every 12 bars (~1 hour) to prevent drift
      if (i % 12 === 0) {
        const bsFull = blackScholesPrice(S, strike, T, isCall, currentIV, r);
        premium = 0.7 * premium + 0.3 * bsFull; // soft anchor
      }

      // Last bar for 0DTE: use intrinsic value
      if (i === bars.length - 1 && expirationDays === 0) {
        premium = isCall
          ? Math.max(S - strike, 0)
          : Math.max(strike - S, 0);
      }

      premium = Math.max(premium, 0.01);

      allPoints.push({
        time: bars[i].time,
        label: bars[i].label,
        price: +premium.toFixed(2),
        pl_dollar: 0,
        pl_pct: 0,
        dayIndex: 0,
      });

      prevPremium = premium;
      prevS = S;
    }
  } else {
    // ── SYNTHETIC PATH: Generate realistic underlying + 5-factor pricing ──
    const path = generateRealisticPath(
      ticker, date, entryTime, expirationDays, baseVol
    );

    const totalMinutesRemaining = expirationDays === 0
      ? minutesUntilClose(entryTime)
      : expirationDays * 390 + minutesUntilClose(entryTime);

    const entryUnderlying = path.prices[0];
    const rawIV = getImpliedVol(entryUnderlying, strike, baseVol);
    const entryT = Math.max(totalMinutesRemaining / (252 * 390), 0.0001);
    entryIV = getSABRSkewedIV(entryUnderlying, strike, entryT, rawIV, isCall);
    entryDelta = computeDelta(entryUnderlying, strike, entryT, isCall, entryIV, r);

    const entryBSPremium = blackScholesPrice(entryUnderlying, strike, entryT, isCall, entryIV, r);

    allPoints = [];
    let prevPremium = entryBSPremium;
    let prevS = entryUnderlying;
    let currentIV = entryIV;

    for (let i = 0; i < path.prices.length; i++) {
      const S = path.prices[i];
      const fraction = i / Math.max(path.prices.length - 1, 1);
      const minutesLeft = totalMinutesRemaining * (1 - fraction);
      const T = Math.max(minutesLeft / (252 * 390), 0.0001);

      if (i === 0) {
        prevPremium = entryBSPremium;
        prevS = S;
        allPoints.push({
          time: path.times[i],
          label: path.labels[i],
          price: +Math.max(entryBSPremium, 0.01).toFixed(2),
          pl_dollar: 0,
          pl_pct: 0,
          dayIndex: path.dayIndices[i],
        });
        continue;
      }

      // ── Factor 1: Delta ──
      const delta = computeDelta(prevS, strike, T, isCall, currentIV, r);
      const deltaS = S - prevS;
      const deltaPnL = delta * deltaS;

      // ── Factor 2: Theta ──
      const theta = blackScholesTheta(prevS, strike, T, isCall, currentIV, r);
      const stepMinutes = totalMinutesRemaining / Math.max(path.prices.length - 1, 1);
      const thetaPnL = theta * (stepMinutes / (60 * 24));

      // ── Factor 3: Gamma ──
      const gamma = blackScholesGamma(prevS, strike, T, currentIV, r);
      const gammaPnL = 0.5 * gamma * deltaS * deltaS;

      // ── Factor 4: Vega / IV noise ──
      const ivNoiseMult = getIVNoise(ivRng, i, 0.015);
      const newIV = currentIV * ivNoiseMult;
      const vega = blackScholesVega(prevS, strike, T, currentIV, r);
      const ivChange = (newIV - currentIV) * 100;
      const vegaPnL = vega * ivChange;

      // ── Factor 5: SABR skew ──
      const sabrIV = getSABRSkewedIV(S, strike, T, baseVol, isCall);
      currentIV = 0.8 * newIV + 0.2 * sabrIV;

      // ── Combine ──
      let premium = prevPremium + deltaPnL + thetaPnL + gammaPnL + vegaPnL;

      // Soft re-anchor every ~1 hour equivalent
      if (i % 12 === 0) {
        const bsFull = blackScholesPrice(S, strike, T, isCall, currentIV, r);
        premium = 0.7 * premium + 0.3 * bsFull;
      }

      if (i === path.prices.length - 1 && expirationDays === 0) {
        premium = isCall
          ? Math.max(S - strike, 0)
          : Math.max(strike - S, 0);
      }

      premium = Math.max(premium, 0.01);

      allPoints.push({
        time: path.times[i],
        label: path.labels[i],
        price: +premium.toFixed(2),
        pl_dollar: 0,
        pl_pct: 0,
        dayIndex: path.dayIndices[i],
      });

      prevPremium = premium;
      prevS = S;
    }
  }

  // ── Anchor to real or BS entry premium ────────────────────────────
  const bsEntry = allPoints[0]?.price ?? 0.01;
  const chainPremium = contract.entryPremium;

  // Use real chain premium if it looks like a valid option price
  const chainLooksValid = chainPremium > 0.02
    && (bsEntry > 0.01 ? (chainPremium / bsEntry) < 5 && (chainPremium / bsEntry) > 0.2 : true);

  let entryPremium: number;
  if (chainLooksValid && chainPremium > 0.02) {
    entryPremium = chainPremium;
    const scaleFactor = bsEntry > 0.01 ? chainPremium / bsEntry : 1;
    for (const pt of allPoints) {
      pt.price = +Math.max(pt.price * scaleFactor, 0.01).toFixed(2);
    }
  } else {
    entryPremium = bsEntry;
  }

  // Compute P/L relative to entry premium
  for (let i = 0; i < allPoints.length; i++) {
    const premium = allPoints[i].price;
    allPoints[i].pl_dollar = +((premium - entryPremium) * 100).toFixed(0);
    allPoints[i].pl_pct = entryPremium > 0.01
      ? +(((premium - entryPremium) / entryPremium) * 100).toFixed(1)
      : 0;
  }

  // Force first point to exact entry
  if (allPoints.length > 0) {
    allPoints[0].price = entryPremium;
    allPoints[0].pl_dollar = 0;
    allPoints[0].pl_pct = 0;
  }

  // Split into same-day and full series
  const sameDayPoints = allPoints.filter((p) => p.dayIndex === 0);
  const toExpirationPoints = allPoints;

  // Compute metrics
  const metrics = computeMetrics(allPoints, entryPremium, entryIV, entryDelta);

  // Generate trade insights (key moments in price action)
  const keyMoments = detectTradeInsights(allPoints, sameDayPoints, entryPremium);

  return {
    contract: { ...contract, entryPremium },
    sameDayPoints,
    toExpirationPoints,
    metrics,
    keyMoments,
  };
}

// ─── T calculation helper ────────────────────────────────────────────

/**
 * Compute T (time to expiration in years) for a given bar time.
 * Uses trading time: T = tradingMinutesRemaining / (252 * 390)
 */
function computeT(barTime: string, expirationDays: number): number {
  const barMinutes = parseTimeMinutes(barTime);
  const tradingMinLeft = Math.max(960 - barMinutes, 1) + expirationDays * 390;
  return Math.max(tradingMinLeft / (252 * 390), 0.0001);
}

// ─── Improved synthetic path ─────────────────────────────────────────

/**
 * Generates a much more realistic synthetic underlying path that includes:
 * - Opening volatility burst
 * - Mid-session mean reversion / consolidation
 * - Power hour momentum
 * - Random support/resistance bounces
 * - Microstructure noise on every tick
 */
function generateRealisticPath(
  ticker: string,
  date: string,
  entryTime: string,
  expirationDays: number,
  sigma: number
): { times: string[]; labels: string[]; prices: number[]; dayIndices: number[] } {
  const basePrice = getUnderlyingPrice(ticker, date, entryTime);

  const rng = seedFromMoment(ticker, date, entryTime, 77);
  const dt = 5 / (252 * 390); // 5-minute steps

  const times: string[] = [];
  const labels: string[] = [];
  const prices: number[] = [];
  const dayIndices: number[] = [];

  let S = basePrice;

  const entryHour = parseInt(entryTime.split(":")[0]);
  const entryMin = parseInt(entryTime.split(":")[1]);
  const entryBucket = ((entryHour - 9) * 60 + entryMin - 30) / 5; // 5-min buckets from 9:30

  for (let day = 0; day <= expirationDays; day++) {
    const startBucket = day === 0 ? Math.max(0, Math.floor(entryBucket)) : 0;
    const endBucket = 78; // 09:30 to 16:00 = 78 five-minute buckets

    // Day trend — slight directional bias
    const dayBias = (rng() - 0.48) * 0.002;

    for (let b = startBucket; b <= endBucket; b++) {
      const totalMinutes = b * 5 + 30; // minutes after 9:00
      const hour = 9 + Math.floor(totalMinutes / 60);
      const minute = totalMinutes % 60;
      const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

      // 12-hour label
      let h12 = hour;
      const suffix = h12 >= 12 ? "PM" : "AM";
      if (h12 === 0) h12 = 12;
      else if (h12 > 12) h12 -= 12;
      const timeLabel = `${h12}:${minute.toString().padStart(2, "0")} ${suffix}`;

      if (day === 0 && b === startBucket) {
        // Entry point
      } else {
        // ── Intraday volatility regime ──────────────────────────
        let localVol = sigma;
        const sessionProgress = b / endBucket; // 0→1 through the day

        // Opening 30 min: elevated volatility (1.5x)
        if (sessionProgress < 0.06) {
          localVol *= 1.5 + rng() * 0.5;
        }
        // Mid-day lull (11:30-14:00): compressed vol (0.6-0.8x)
        else if (sessionProgress > 0.25 && sessionProgress < 0.58) {
          localVol *= 0.6 + rng() * 0.2;
        }
        // Power hour (15:00-16:00): elevated vol (1.2-1.6x)
        else if (sessionProgress > 0.85) {
          localVol *= 1.2 + rng() * 0.4;
        }

        // ── Mean reversion component ────────────────────────────
        const deviation = (S - basePrice) / basePrice;
        const reversion = -deviation * 0.02;

        // ── Momentum / trend component ──────────────────────────
        const momentum = dayBias * (1 + sessionProgress);

        // ── Random jumps (1% chance per tick of larger move) ────
        const jumpChance = rng();
        const jump = jumpChance < 0.01
          ? (rng() - 0.5) * sigma * 4
          : 0;

        // ── GBM with all components ─────────────────────────────
        const u1 = Math.max(rng(), 1e-10);
        const u2 = rng();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

        const drift = reversion + momentum;
        S = S * Math.exp(
          (drift - (localVol * localVol) / 2) * dt +
          localVol * Math.sqrt(dt) * z +
          jump
        );
      }

      const dayLabel = day === 0 ? "Today" : `Day +${day}`;

      times.push(timeStr);
      labels.push(day === 0 ? timeLabel : `${dayLabel} ${timeLabel}`);
      prices.push(+S.toFixed(S < 1 ? 4 : 2));
      dayIndices.push(day);
    }

    // Overnight gap for multi-day
    if (day < expirationDays) {
      const gapDirection = rng() - 0.5;
      S = S * (1 + gapDirection * sigma * 0.5);
    }
  }

  return { times, labels, prices, dayIndices };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function parseTimeMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesUntilClose(entryTime: string): number {
  const close = 16 * 60; // 16:00
  const entry = parseTimeMinutes(entryTime);
  return Math.max(close - entry, 15);
}

// ─── Metrics ─────────────────────────────────────────────────────────

function computeMetrics(
  points: TimePoint[],
  entryPremium: number,
  ivAtEntry: number,
  deltaAtEntry: number
): ReplayMetrics {
  let maxProfitPt = points[0];
  let maxDrawdownPt = points[0];

  for (const pt of points) {
    if (pt.pl_dollar > maxProfitPt.pl_dollar) maxProfitPt = pt;
    if (pt.pl_dollar < maxDrawdownPt.pl_dollar) maxDrawdownPt = pt;
  }

  const lastPoint = points[points.length - 1];

  // Optimal exit: first point with >= 50% gain, OR peak before -30% retrace
  let optimalPt = lastPoint;
  let optimalReason = "held to close";
  let peak = points[0];
  for (const pt of points) {
    if (pt.pl_pct >= 50) {
      optimalPt = pt;
      optimalReason = "hit +50% profit target";
      break;
    }
    if (pt.pl_dollar > peak.pl_dollar) {
      peak = pt;
    }
    if (peak.pl_pct > 10 && pt.pl_pct < peak.pl_pct - 30) {
      optimalPt = peak;
      optimalReason = "peak before 30% retrace";
      break;
    }
  }

  return {
    entryPremium,
    exitPremium: lastPoint.price,
    exitAtClosePL: lastPoint.pl_dollar,
    exitAtClosePLPct: lastPoint.pl_pct,
    maxProfit: maxProfitPt.pl_dollar,
    maxProfitPct: maxProfitPt.pl_pct,
    maxProfitTime: maxProfitPt.label,
    maxDrawdown: maxDrawdownPt.pl_dollar,
    maxDrawdownPct: maxDrawdownPt.pl_pct,
    maxDrawdownTime: maxDrawdownPt.label,
    optimalExitTime: optimalPt.label,
    optimalExitPL: optimalPt.pl_dollar,
    optimalExitPLPct: optimalPt.pl_pct,
    optimalExitPremium: optimalPt.price,
    optimalExitReason: optimalReason,
    ivAtEntry,
    deltaAtEntry,
  };
}

// ─── Trade insights ──────────────────────────────────────────────────

function detectTradeInsights(
  allPoints: TimePoint[],
  sameDayPoints: TimePoint[],
  entryPremium: number
): KeyMoment[] {
  const moments: KeyMoment[] = [];
  const pts = allPoints;
  if (pts.length < 3) return moments;

  // 1. Entry
  moments.push({
    time: pts[0].label,
    label: "Entry",
    reason: `Entered at $${entryPremium.toFixed(2)} per share · $${(entryPremium * 100).toFixed(2)} per contract.`,
    type: "trade",
  });

  // Find peak and trough
  let peakIdx = 0;
  let troughIdx = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].pl_dollar > pts[peakIdx].pl_dollar) peakIdx = i;
    if (pts[i].pl_dollar < pts[troughIdx].pl_dollar) troughIdx = i;
  }

  // 2. First significant move (+/-15%)
  for (let i = 1; i < pts.length; i++) {
    if (Math.abs(pts[i].pl_pct) >= 15) {
      moments.push({
        time: pts[i].label,
        label: pts[i].pl_pct > 0 ? "Momentum surge" : "Momentum drop",
        reason: `Contract moved ${pts[i].pl_pct > 0 ? "+" : ""}${pts[i].pl_pct.toFixed(0)}% — initial directional move.`,
        type: "trade",
      });
      break;
    }
  }

  // 3. Peak (MFE)
  if (pts[peakIdx].pl_pct > 5) {
    moments.push({
      time: pts[peakIdx].label,
      label: "Peak profit (MFE)",
      reason: `Max favorable excursion: +${pts[peakIdx].pl_pct.toFixed(0)}% — $${(pts[peakIdx].pl_dollar / 100).toFixed(2)} per share · $${pts[peakIdx].pl_dollar.toFixed(2)} per contract.`,
      type: "trade",
    });
  }

  // 4. Trough (MAE)
  if (pts[troughIdx].pl_pct < -10) {
    moments.push({
      time: pts[troughIdx].label,
      label: "Max drawdown (MAE)",
      reason: `Max adverse excursion: ${pts[troughIdx].pl_pct.toFixed(0)}% — $${(pts[troughIdx].pl_dollar / 100).toFixed(2)} per share · $${pts[troughIdx].pl_dollar.toFixed(2)} per contract.`,
      type: "trade",
    });
  }

  // 5. Support/resistance-like moments
  const step = Math.max(2, Math.floor(pts.length / 40));
  for (let i = step; i < pts.length - step; i++) {
    const prev = pts[i - step].pl_dollar;
    const curr = pts[i].pl_dollar;
    const next = pts[i + step].pl_dollar;

    if (curr < prev && curr < next && curr - prev < -20 && next - curr > 20) {
      if (!moments.some((m) => m.label === "Support held")) {
        moments.push({
          time: pts[i].label,
          label: "Support held",
          reason: `Price bounced from $${pts[i].price.toFixed(2)} per share · $${(pts[i].price * 100).toFixed(2)} per contract — potential support level in underlying.`,
          type: "trade",
        });
      }
    }

    if (curr > prev && curr > next && curr - prev > 20 && next - curr < -20) {
      if (!moments.some((m) => m.label === "Resistance hit")) {
        moments.push({
          time: pts[i].label,
          label: "Resistance hit",
          reason: `Premium peaked at $${pts[i].price.toFixed(2)} per share · $${(pts[i].price * 100).toFixed(2)} per contract before pulling back — possible resistance in underlying.`,
          type: "trade",
        });
      }
    }
  }

  // 6. Theta decay overnight (multi-day)
  if (allPoints.length > sameDayPoints.length) {
    const day1Close = allPoints.filter((p) => p.dayIndex === 0);
    const day2Open = allPoints.find((p) => p.dayIndex === 1);
    if (day1Close.length && day2Open) {
      const overnight = day2Open.pl_dollar - day1Close[day1Close.length - 1].pl_dollar;
      if (overnight < -10) {
        moments.push({
          time: day2Open.label,
          label: "Theta decay overnight",
          reason: `Premium dropped $${(Math.abs(overnight) / 100).toFixed(2)} per share · $${Math.abs(overnight).toFixed(2)} per contract overnight due to time decay.`,
          type: "trade",
        });
      }
    }
  }

  // 7. Close
  const last = pts[pts.length - 1];
  moments.push({
    time: last.label,
    label: last.pl_pct >= 0 ? "Profitable close" : "Loss at close",
    reason: `Closed at ${last.pl_pct >= 0 ? "+" : ""}${last.pl_pct.toFixed(0)}% — $${(last.pl_dollar / 100).toFixed(2)} per share · $${last.pl_dollar.toFixed(2)} per contract.`,
    type: "trade",
  });

  // Cap at 8 items
  if (moments.length > 8) {
    const entry = moments[0];
    const close = moments[moments.length - 1];
    const middle = moments.slice(1, -1).slice(0, 6);
    return [entry, ...middle, close];
  }

  return moments;
}
