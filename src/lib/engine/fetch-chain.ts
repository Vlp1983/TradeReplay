/**
 * Client-side bridge: calls the synthetic pricing engine via /api/pricing
 * and adapts the result into the existing ChainData / ReplayResult types.
 *
 * Also retains AI insights fetching (unchanged).
 */

import type {
  Ticker,
  Expiration,
  ChainData,
  ChainRow,
  SelectedContract,
  ReplayResult,
  TimePoint,
  ReplayMetrics,
  KeyMoment,
} from "./types";
import type {
  OptionPricingResult,
  OptionBar,
  Greeks,
  StrikeChain,
  Expiry,
} from "@/lib/pricing/types";

// ─── Serialized types from API response ─────────────────────────────

interface SerializedExpiry {
  date: string; // ISO string
  label: string;
  dte: number;
  type: "0DTE" | "weekly";
}

interface PricingAPIResponse extends Omit<OptionPricingResult, "expiries"> {
  expiries: SerializedExpiry[];
}

// ─── Core pricing call ──────────────────────────────────────────────

/**
 * Call the synthetic pricing engine for a specific contract.
 * Returns the raw OptionPricingResult (with expiry dates deserialized).
 */
export async function fetchPricing(params: {
  ticker: string;
  replayDate: string;   // YYYY-MM-DD
  strike: number;
  expiry: Date;
  optionType: "call" | "put";
}): Promise<OptionPricingResult> {
  const res = await fetch("/api/pricing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ticker: params.ticker,
      replayDate: new Date(params.replayDate + "T10:00:00").toISOString(),
      strike: params.strike,
      expiry: params.expiry.toISOString(),
      optionType: params.optionType,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Pricing API ${res.status}: ${body}`);
  }

  const data: PricingAPIResponse = await res.json();

  // Deserialize expiry dates
  return {
    ...data,
    expiries: data.expiries.map((e) => ({
      ...e,
      date: new Date(e.date),
    })),
  };
}

// ─── Resolve default expiry date ────────────────────────────────────

/**
 * For a given replay date, determine the best default expiry:
 * - If it's a Friday → 0DTE (same day)
 * - Otherwise → next Friday
 */
export function resolveDefaultExpiry(replayDate: string): Date {
  const d = new Date(replayDate + "T12:00:00Z");
  const dayOfWeek = d.getUTCDay(); // 0=Sun, 5=Fri

  if (dayOfWeek === 5) {
    return d;
  }

  const daysToFriday = (5 - dayOfWeek + 7) % 7 || 7;
  const friday = new Date(d);
  friday.setUTCDate(friday.getUTCDate() + daysToFriday);
  return friday;
}

// ─── Adapt pricing result → ChainData ───────────────────────────────

/**
 * Convert the pricing engine's StrikeChain + Greeks into ChainData
 * that the ChainSnapshot component expects.
 */
export function pricingToChainData(
  ticker: Ticker,
  date: string,
  entryTime: string,
  pricing: OptionPricingResult,
  spot: number
): ChainData {
  const expiration: Expiration = pricing.classification.dteBucket === "0DTE" ? "0dte" : "friday";
  const atmPremium = pricing.bars.length > 0 ? pricing.bars[0].open : 1.0;

  const calls: ChainRow[] = pricing.strikeChain.calls.map((s) => {
    const isATM = s.strike === pricing.strikeChain.atmStrike;
    // Rough premium estimate: scale from ATM based on distance
    const moneyness = Math.abs(s.strike - pricing.strikeChain.atmStrike) / pricing.strikeChain.atmStrike;
    const premium = isATM
      ? atmPremium
      : Math.max(0.01, atmPremium * Math.max(0.1, 1 - moneyness * 8));
    return {
      strike: s.strike,
      premium: +premium.toFixed(2),
      confidence: "Med" as const,
      isATM,
      greeks: isATM
        ? {
            delta: pricing.greeksAtOpen.delta,
            gamma: pricing.greeksAtOpen.gamma,
            theta: pricing.greeksAtOpen.theta,
            vega: pricing.greeksAtOpen.vega,
          }
        : undefined,
      impliedVolatility: pricing.ivUsed,
    };
  });

  const puts: ChainRow[] = pricing.strikeChain.puts.map((s) => {
    const isATM = s.strike === pricing.strikeChain.atmStrike;
    const moneyness = Math.abs(s.strike - pricing.strikeChain.atmStrike) / pricing.strikeChain.atmStrike;
    const premium = isATM
      ? atmPremium
      : Math.max(0.01, atmPremium * Math.max(0.1, 1 - moneyness * 8));
    return {
      strike: s.strike,
      premium: +premium.toFixed(2),
      confidence: "Med" as const,
      isATM,
      greeks: isATM
        ? {
            delta: -Math.abs(pricing.greeksAtOpen.delta),
            gamma: pricing.greeksAtOpen.gamma,
            theta: pricing.greeksAtOpen.theta,
            vega: pricing.greeksAtOpen.vega,
          }
        : undefined,
      impliedVolatility: pricing.ivUsed,
    };
  });

  return {
    ticker,
    date,
    entryTime,
    expiration,
    underlyingPrice: spot,
    calls,
    puts,
    source: "synthetic",
  };
}

// ─── Convert bars to TimePoints ─────────────────────────────────────

/**
 * Convert OptionBar[] to TimePoint[], computing P&L relative to a given
 * entryPremium. Exported so multi-day views can reuse this with the
 * original entry premium from Day 1.
 */
export function barsToTimePoints(
  bars: OptionBar[],
  entryPremium: number,
  dayIndex: number = 0
): TimePoint[] {
  const points: TimePoint[] = bars.map((bar) => {
    const premium = bar.close;
    const plDollar = +((premium - entryPremium) * 100).toFixed(0);
    const plPct = entryPremium > 0.01
      ? +(((premium - entryPremium) / entryPremium) * 100).toFixed(1)
      : 0;

    // Derive time label from timestamp
    const d = new Date(bar.timestamp);
    const hour = d.getUTCHours() - 5; // approximate ET
    const minute = d.getUTCMinutes();
    let h12 = hour;
    const suffix = h12 >= 12 ? "PM" : "AM";
    if (h12 === 0) h12 = 12;
    else if (h12 > 12) h12 -= 12;
    const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
    const label = `${h12}:${minute.toString().padStart(2, "0")} ${suffix}`;

    return {
      time: timeStr,
      label,
      price: +premium.toFixed(2),
      pl_dollar: plDollar,
      pl_pct: plPct,
      dayIndex,
    };
  });

  return points;
}

// ─── Filter bars at entry time ──────────────────────────────────────

/**
 * Filter bars to only include those at or after the given entry time.
 * Entry time is in ET (e.g. "10:00"), bar timestamps are UTC.
 */
function filterBarsAtEntryTime(bars: OptionBar[], entryTime: string): OptionBar[] {
  const [eH, eM] = entryTime.split(":").map(Number);
  const entryET = eH * 60 + eM;

  return bars.filter((bar) => {
    const d = new Date(bar.timestamp);
    const barET = (d.getUTCHours() - 5) * 60 + d.getUTCMinutes();
    return barET >= entryET;
  });
}

// ─── Adapt pricing result → ReplayResult ────────────────────────────

/**
 * Convert OptionBar[] from the pricing engine into a full ReplayResult
 * compatible with the existing ContractReplay component.
 *
 * Filters bars to only include those from the entry time onward.
 */
export function pricingToReplayResult(
  contract: SelectedContract,
  pricing: OptionPricingResult
): ReplayResult {
  let bars = pricing.bars;
  if (bars.length === 0) {
    return emptyReplayResult(contract, pricing);
  }

  // Filter bars to start from entry time (not 9:30 AM open)
  if (contract.entryTime) {
    bars = filterBarsAtEntryTime(bars, contract.entryTime);
    if (bars.length === 0) {
      return emptyReplayResult(contract, pricing);
    }
  }

  const entryPremium = bars[0].open;

  // Build TimePoint[] from OptionBar[]
  const allPoints = barsToTimePoints(bars, entryPremium);

  // Force first point to exact entry
  if (allPoints.length > 0) {
    allPoints[0].price = +entryPremium.toFixed(2);
    allPoints[0].pl_dollar = 0;
    allPoints[0].pl_pct = 0;
  }

  // Compute DTE
  const msPerDay = 86400000;
  const replayDate = new Date(contract.date + "T12:00:00Z");
  const expiryDate = contract.expiration === "0dte"
    ? replayDate
    : resolveDefaultExpiry(contract.date);
  const dte = Math.max(0, Math.round((expiryDate.getTime() - replayDate.getTime()) / msPerDay));

  const metrics = computeMetrics(allPoints, entryPremium, pricing, dte);
  const keyMoments = detectKeyMoments(allPoints, entryPremium);

  return {
    contract: { ...contract, entryPremium: +entryPremium.toFixed(2) },
    sameDayPoints: allPoints,
    toExpirationPoints: allPoints,
    metrics,
    keyMoments,
  };
}

function computeMetrics(
  points: TimePoint[],
  entryPremium: number,
  pricing: OptionPricingResult,
  dte: number
): ReplayMetrics {
  let peakPt = points[0];
  let troughPt = points[0];

  for (const pt of points) {
    if (pt.pl_dollar > peakPt.pl_dollar) peakPt = pt;
    if (pt.pl_dollar < troughPt.pl_dollar) troughPt = pt;
  }

  const last = points[points.length - 1];

  let optimalPt = last;
  let optimalReason = "held to close";
  let peak = points[0];
  for (const pt of points) {
    if (pt.pl_pct >= 50) {
      optimalPt = pt;
      optimalReason = "hit +50% profit target";
      break;
    }
    if (pt.pl_dollar > peak.pl_dollar) peak = pt;
    if (peak.pl_pct > 10 && pt.pl_pct < peak.pl_pct - 30) {
      optimalPt = peak;
      optimalReason = "peak before 30% retrace";
      break;
    }
  }

  return {
    entryPremium: +entryPremium.toFixed(2),
    exitPremium: last.price,
    exitAtClosePL: last.pl_dollar,
    exitAtClosePLPct: last.pl_pct,
    maxProfit: peakPt.pl_dollar,
    maxProfitPct: peakPt.pl_pct,
    maxProfitTime: peakPt.label,
    maxDrawdown: troughPt.pl_dollar,
    maxDrawdownPct: troughPt.pl_pct,
    maxDrawdownTime: troughPt.label,
    optimalExitTime: optimalPt.label,
    optimalExitPL: optimalPt.pl_dollar,
    optimalExitPLPct: optimalPt.pl_pct,
    optimalExitPremium: optimalPt.price,
    optimalExitReason: optimalReason,
    ivAtEntry: pricing.ivUsed,
    deltaAtEntry: pricing.greeksAtOpen.delta,
    gammaAtEntry: pricing.greeksAtOpen.gamma,
    thetaAtEntry: pricing.greeksAtOpen.theta,
    vegaAtEntry: pricing.greeksAtOpen.vega,
    dteAtEntry: dte,
  };
}

function detectKeyMoments(
  points: TimePoint[],
  entryPremium: number
): KeyMoment[] {
  const moments: KeyMoment[] = [];
  if (points.length < 2) return moments;

  moments.push({
    time: points[0].label,
    label: "Entry",
    reason: `Entered at $${entryPremium.toFixed(2)} per share.`,
    type: "trade",
  });

  let peakIdx = 0;
  let troughIdx = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].pl_dollar > points[peakIdx].pl_dollar) peakIdx = i;
    if (points[i].pl_dollar < points[troughIdx].pl_dollar) troughIdx = i;
  }

  for (let i = 1; i < points.length; i++) {
    if (Math.abs(points[i].pl_pct) >= 15) {
      moments.push({
        time: points[i].label,
        label: points[i].pl_pct > 0 ? "Momentum surge" : "Momentum drop",
        reason: `Contract moved ${points[i].pl_pct > 0 ? "+" : ""}${points[i].pl_pct.toFixed(0)}%.`,
        type: "trade",
      });
      break;
    }
  }

  if (points[peakIdx].pl_pct > 5) {
    moments.push({
      time: points[peakIdx].label,
      label: "Peak profit (MFE)",
      reason: `Max favorable excursion: +${points[peakIdx].pl_pct.toFixed(0)}%.`,
      type: "trade",
    });
  }

  if (points[troughIdx].pl_pct < -10) {
    moments.push({
      time: points[troughIdx].label,
      label: "Max drawdown (MAE)",
      reason: `Max adverse excursion: ${points[troughIdx].pl_pct.toFixed(0)}%.`,
      type: "trade",
    });
  }

  const last = points[points.length - 1];
  moments.push({
    time: last.label,
    label: last.pl_pct >= 0 ? "Profitable close" : "Loss at close",
    reason: `Closed at ${last.pl_pct >= 0 ? "+" : ""}${last.pl_pct.toFixed(0)}%.`,
    type: "trade",
  });

  return moments;
}

function emptyReplayResult(
  contract: SelectedContract,
  pricing: OptionPricingResult
): ReplayResult {
  return {
    contract,
    sameDayPoints: [],
    toExpirationPoints: [],
    metrics: {
      entryPremium: 0,
      exitPremium: 0,
      exitAtClosePL: 0,
      exitAtClosePLPct: 0,
      maxProfit: 0,
      maxProfitPct: 0,
      maxProfitTime: "",
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      maxDrawdownTime: "",
      optimalExitTime: "",
      optimalExitPL: 0,
      optimalExitPLPct: 0,
      optimalExitPremium: 0,
      optimalExitReason: "",
      ivAtEntry: pricing.ivUsed,
      deltaAtEntry: pricing.greeksAtOpen.delta,
      gammaAtEntry: pricing.greeksAtOpen.gamma,
      thetaAtEntry: pricing.greeksAtOpen.theta,
      vegaAtEntry: pricing.greeksAtOpen.vega,
      dteAtEntry: 0,
    },
    keyMoments: [],
  };
}

// ─── Trading day helpers ────────────────────────────────────────────

/**
 * Get all trading days (Mon-Fri) between two dates inclusive.
 */
export function getTradingDaysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const s = new Date(start + "T12:00:00Z");
  const e = new Date(end + "T12:00:00Z");
  const d = new Date(s);
  while (d <= e) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      days.push(d.toISOString().slice(0, 10));
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

// ─── AI insights (unchanged) ─────────────────────────────────────────

export interface InsightsResult {
  insights: string[];
  source: "ai" | "data-driven";
}

export async function fetchInsights(payload: {
  ticker: string;
  date: string;
  entryTime: string;
  strike: number;
  right: "call" | "put";
  entryPremium: number;
  exitPL: number;
  exitPLPct: number;
  maxProfit: number;
  maxProfitPct: number;
  maxProfitTime: string;
  maxDrawdown: number;
  maxDrawdownPct: number;
  underlyingStart: number;
  underlyingEnd: number;
  underlyingHigh: number;
  underlyingLow: number;
}): Promise<InsightsResult> {
  try {
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("[fetchInsights] Failed:", err);
    return { insights: [], source: "data-driven" };
  }
}
