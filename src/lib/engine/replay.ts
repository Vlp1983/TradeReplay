/**
 * Generate the full contract replay — price path, P/L series,
 * metrics, and key insights.
 *
 * When real Yahoo intraday bars are available, uses REAL underlying
 * prices and Black-Scholes to estimate option premiums at each tick.
 * Falls back to an improved synthetic path with realistic microstructure.
 */

import type {
  SelectedContract,
  TimePoint,
  ReplayMetrics,
  KeyMoment,
  ReplayResult,
} from "./types";
import type { IntradayBar } from "@/lib/services/yahoo-finance";
import {
  getUnderlyingPrice,
  estimatePremium,
  getImpliedVol,
  BASE_VOLATILITY,
  seedFromMoment,
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
    entryPremium,
  } = contract;

  const isCall = right === "call";
  const expirationDays = getExpirationDays(date, expiration);
  const baseVol = BASE_VOLATILITY[ticker] ?? 0.22;

  // ── Build underlying price series ──────────────────────────────────
  let underlyingPrices: number[];
  let labels: string[];
  let times: string[];
  let dayIndices: number[];

  const hasRealData = intradayBars && intradayBars.length >= 5;

  if (hasRealData) {
    // Use REAL Yahoo intraday data — filter from entry time onward
    const entryMinutes = parseTimeMinutes(entryTime);
    const filtered = intradayBars.filter((b) => {
      return parseTimeMinutes(b.time) >= entryMinutes;
    });

    // Need at least a few points
    const bars = filtered.length >= 3 ? filtered : intradayBars;

    underlyingPrices = bars.map((b) => b.close);
    labels = bars.map((b) => b.label);
    times = bars.map((b) => b.time);
    dayIndices = bars.map(() => 0);
  } else {
    // Improved synthetic path with realistic microstructure
    const path = generateRealisticPath(
      ticker, date, entryTime, expirationDays, baseVol
    );
    underlyingPrices = path.prices;
    labels = path.labels;
    times = path.times;
    dayIndices = path.dayIndices;
  }

  // ── Compute option premium at each point via Black-Scholes ─────────
  const totalPoints = underlyingPrices.length;
  const totalMinutesRemaining = expirationDays === 0
    ? minutesUntilClose(entryTime)
    : expirationDays * 390 + minutesUntilClose(entryTime);

  const allPoints: TimePoint[] = [];

  for (let i = 0; i < totalPoints; i++) {
    const S = underlyingPrices[i];
    const fraction = i / Math.max(totalPoints - 1, 1);
    const minutesLeft = totalMinutesRemaining * (1 - fraction);
    const T = Math.max(minutesLeft / (252 * 390), 0.0001);

    const iv = getImpliedVol(S, strike, baseVol);
    const est = estimatePremium(S, strike, T, isCall, iv);
    let premium = est.premium;

    // At expiration (last point), use intrinsic value
    if (i === totalPoints - 1 && expirationDays === 0) {
      premium = isCall
        ? Math.max(S - strike, 0)
        : Math.max(strike - S, 0);
      premium = +premium.toFixed(2);
    }

    allPoints.push({
      time: times[i],
      label: labels[i],
      price: premium,
      pl_dollar: 0,
      pl_pct: 0,
      dayIndex: dayIndices[i],
    });
  }

  // ── Anchor to actual entry premium ─────────────────────────────────
  // Scale the entire premium path proportionally so the first point
  // matches the real entry premium. This preserves the shape/direction
  // while anchoring to reality.
  const rawEntry = allPoints[0]?.price ?? entryPremium;
  const scaleFactor = rawEntry > 0.01 ? entryPremium / rawEntry : 1;

  for (let i = 0; i < allPoints.length; i++) {
    // Blend scale toward 1.0 at expiration so intrinsic value is preserved
    const t = i / Math.max(allPoints.length - 1, 1);
    const blendedScale = scaleFactor + (1 - scaleFactor) * t * 0.5;
    const premium = Math.max(+(allPoints[i].price * blendedScale).toFixed(2), 0.01);

    allPoints[i].price = premium;
    allPoints[i].pl_dollar = +((premium - entryPremium) * 100).toFixed(0);
    allPoints[i].pl_pct = +(((premium - entryPremium) / entryPremium) * 100).toFixed(1);
  }

  // Force first point to exact entry (avoid rounding drift)
  if (allPoints.length > 0) {
    allPoints[0].price = entryPremium;
    allPoints[0].pl_dollar = 0;
    allPoints[0].pl_pct = 0;
  }

  // Split into same-day and full series
  const sameDayPoints = allPoints.filter((p) => p.dayIndex === 0);
  const toExpirationPoints = allPoints;

  // Compute metrics
  const metrics = computeMetrics(allPoints, entryPremium);

  // Generate trade insights (key moments in price action)
  const keyMoments = detectTradeInsights(allPoints, sameDayPoints, entryPremium);

  return {
    contract,
    sameDayPoints,
    toExpirationPoints,
    metrics,
    keyMoments,
  };
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
  const dt = 5 / (252 * 390); // 5-minute steps (more granular than 15m)

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
  entryPremium: number
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
  let peak = points[0];
  for (const pt of points) {
    if (pt.pl_pct >= 50) {
      optimalPt = pt;
      break;
    }
    if (pt.pl_dollar > peak.pl_dollar) {
      peak = pt;
    }
    if (peak.pl_pct > 10 && pt.pl_pct < peak.pl_pct - 30) {
      optimalPt = peak;
      break;
    }
  }

  return {
    entryPremium,
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
    reason: `Entered at $${entryPremium.toFixed(2)} premium.`,
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
      reason: `Max favorable excursion: +${pts[peakIdx].pl_pct.toFixed(0)}% ($${pts[peakIdx].pl_dollar}).`,
      type: "trade",
    });
  }

  // 4. Trough (MAE)
  if (pts[troughIdx].pl_pct < -10) {
    moments.push({
      time: pts[troughIdx].label,
      label: "Max drawdown (MAE)",
      reason: `Max adverse excursion: ${pts[troughIdx].pl_pct.toFixed(0)}% ($${pts[troughIdx].pl_dollar}).`,
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
          reason: `Price bounced from $${pts[i].price.toFixed(2)} — potential support level in underlying.`,
          type: "trade",
        });
      }
    }

    if (curr > prev && curr > next && curr - prev > 20 && next - curr < -20) {
      if (!moments.some((m) => m.label === "Resistance hit")) {
        moments.push({
          time: pts[i].label,
          label: "Resistance hit",
          reason: `Premium peaked at $${pts[i].price.toFixed(2)} before pulling back — possible resistance in underlying.`,
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
          reason: `Premium dropped $${Math.abs(overnight)} overnight due to time decay.`,
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
    reason: `Closed at ${last.pl_pct >= 0 ? "+" : ""}${last.pl_pct.toFixed(0)}% ($${last.pl_dollar}).`,
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
