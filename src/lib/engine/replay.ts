/**
 * Generate the full contract replay — price path, P/L series,
 * metrics, and key moments.
 */

import type {
  SelectedContract,
  TimePoint,
  ReplayMetrics,
  KeyMoment,
  ReplayResult,
} from "./types";
import {
  getUnderlyingPrice,
  estimatePremium,
  getImpliedVol,
  generateUnderlyingPath,
} from "./pricing";
import { getExpirationDays } from "./chain";

/**
 * Replay a selected contract from entry to expiration.
 */
export function replayContract(contract: SelectedContract): ReplayResult {
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
  const basePrice = getUnderlyingPrice(ticker, date, entryTime);
  const expirationDays = getExpirationDays(date, expiration);
  const baseVol = 0.22;

  // Generate underlying price path
  const path = generateUnderlyingPath(
    ticker,
    date,
    entryTime,
    expirationDays,
    basePrice,
    baseVol
  );

  // Compute option premium at each time point
  const totalPoints = path.prices.length;
  const allPoints: TimePoint[] = [];

  for (let i = 0; i < totalPoints; i++) {
    const S = path.prices[i];
    const dayIndex = path.dayIndices[i];

    // Time remaining decreases with each point
    const pointsRemaining = totalPoints - 1 - i;
    const T = Math.max(pointsRemaining * (15 / (252 * 390)), 0.0001);

    const iv = getImpliedVol(S, strike, baseVol);
    const est = estimatePremium(S, strike, T, isCall, iv);
    let premium = est.premium;

    // At expiration (last point), use intrinsic value
    if (i === totalPoints - 1) {
      premium = isCall
        ? Math.max(S - strike, 0)
        : Math.max(strike - S, 0);
      premium = +premium.toFixed(2);
    }

    const plDollar = +((premium - entryPremium) * 100).toFixed(0);
    const plPct = +(((premium - entryPremium) / entryPremium) * 100).toFixed(1);

    allPoints.push({
      time: path.times[i],
      label: path.labels[i],
      price: premium,
      pl_dollar: plDollar,
      pl_pct: plPct,
      dayIndex,
    });
  }

  // Split into same-day and full series
  const sameDayPoints = allPoints.filter((p) => p.dayIndex === 0);
  const toExpirationPoints = allPoints;

  // Compute metrics
  const metrics = computeMetrics(allPoints, entryPremium);

  // Generate key moments
  const keyMoments = detectKeyMoments(allPoints, sameDayPoints, entryPremium);

  return {
    contract,
    sameDayPoints,
    toExpirationPoints,
    metrics,
    keyMoments,
  };
}

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

  // Optimal exit: first point with ≥50% gain, OR peak before -30% retrace
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

function detectKeyMoments(
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
  });

  // Find peak and trough
  let peakIdx = 0;
  let troughIdx = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].pl_dollar > pts[peakIdx].pl_dollar) peakIdx = i;
    if (pts[i].pl_dollar < pts[troughIdx].pl_dollar) troughIdx = i;
  }

  // 2. First significant move (±15%)
  for (let i = 1; i < pts.length; i++) {
    if (Math.abs(pts[i].pl_pct) >= 15) {
      moments.push({
        time: pts[i].label,
        label: pts[i].pl_pct > 0 ? "Momentum surge" : "Momentum drop",
        reason: `Contract moved ${pts[i].pl_pct > 0 ? "+" : ""}${pts[i].pl_pct.toFixed(0)}% — initial directional move.`,
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
    });
  }

  // 4. Trough (MAE)
  if (pts[troughIdx].pl_pct < -10) {
    moments.push({
      time: pts[troughIdx].label,
      label: "Max drawdown (MAE)",
      reason: `Max adverse excursion: ${pts[troughIdx].pl_pct.toFixed(0)}% ($${pts[troughIdx].pl_dollar}).`,
    });
  }

  // 5. Detect support/resistance-like moments — direction reversals
  for (let i = 2; i < pts.length - 2; i++) {
    const prev = pts[i - 2].pl_dollar;
    const curr = pts[i].pl_dollar;
    const next = pts[i + 2].pl_dollar;

    // Local minimum (support)
    if (curr < prev && curr < next && curr - prev < -20 && next - curr > 20) {
      if (!moments.some((m) => m.label === "Support held")) {
        moments.push({
          time: pts[i].label,
          label: "Support held",
          reason: `Price bounced from $${pts[i].price.toFixed(2)} — potential support level in underlying.`,
        });
      }
    }

    // Local maximum (resistance)
    if (curr > prev && curr > next && curr - prev > 20 && next - curr < -20) {
      if (!moments.some((m) => m.label === "Resistance hit")) {
        moments.push({
          time: pts[i].label,
          label: "Resistance hit",
          reason: `Premium peaked at $${pts[i].price.toFixed(2)} before pulling back — possible resistance in underlying.`,
        });
      }
    }
  }

  // 6. Theta decay observation (for multi-day)
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
  });

  // Cap at 8 moments, keep entry and close
  if (moments.length > 8) {
    const entry = moments[0];
    const close = moments[moments.length - 1];
    const middle = moments.slice(1, -1).slice(0, 6);
    return [entry, ...middle, close];
  }

  return moments;
}
