/**
 * Synthetic option pricing engine.
 *
 * Dual-path estimation:
 *   Path A — Simplified Black-Scholes (volatility-based)
 *   Path B — Delta/momentum approximation
 * Consensus: average of both with confidence from agreement.
 *
 * All data is synthetic and labeled "Estimated (MVP)".
 */

import type { Confidence } from "./types";

// ---------- helpers ----------

function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1 / (1 + p * absX);
  const y =
    1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);
  return 0.5 * (1 + sign * y);
}

// ---------- seeded PRNG (deterministic per moment) ----------

export function seedFromMoment(
  ticker: string,
  date: string,
  time: string,
  extra = 0
): () => number {
  let hash = 0;
  const str = `${ticker}${date}${time}${extra}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  // Simple mulberry32
  let s = (hash >>> 0) || 1;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- base underlying prices ----------

const BASE_PRICES: Record<string, number> = {
  SPY: 510,
  QQQ: 445,
};

/** Generate a deterministic underlying price for a given moment. */
export function getUnderlyingPrice(
  ticker: string,
  date: string,
  time: string
): number {
  const rng = seedFromMoment(ticker, date, time);
  const base = BASE_PRICES[ticker] ?? 500;
  // ±3% variation from base
  return +(base * (1 + (rng() - 0.5) * 0.06)).toFixed(2);
}

// ---------- Black-Scholes Path A ----------

function blackScholesCall(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number
): number {
  if (T <= 0) return Math.max(S - K, 0);
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
}

function blackScholesPut(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number
): number {
  if (T <= 0) return Math.max(K - S, 0);
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
}

// ---------- Path B: delta-momentum approximation ----------

function deltaMomentumPrice(
  S: number,
  K: number,
  T: number,
  isCall: boolean
): number {
  const intrinsic = isCall ? Math.max(S - K, 0) : Math.max(K - S, 0);
  const moneyness = isCall ? (S - K) / S : (K - S) / S;
  // Approximate time value
  const timeValue = Math.max(0, S * 0.04 * Math.sqrt(Math.max(T, 0.001)) * Math.exp(-Math.abs(moneyness) * 8));
  return intrinsic + timeValue;
}

// ---------- consensus pricing ----------

export interface PriceEstimate {
  premium: number;
  confidence: Confidence;
  pathA: number;
  pathB: number;
}

export function estimatePremium(
  S: number,
  K: number,
  T: number, // in years
  isCall: boolean,
  sigma: number = 0.25,
  r: number = 0.05
): PriceEstimate {
  const pathA = isCall
    ? blackScholesCall(S, K, T, r, sigma)
    : blackScholesPut(S, K, T, r, sigma);
  const pathB = deltaMomentumPrice(S, K, T, isCall);

  const premium = (pathA + pathB) / 2;
  const agreement = pathA > 0.01 ? Math.abs(pathA - pathB) / pathA : 0;

  let confidence: Confidence = "High";
  if (agreement > 0.4) confidence = "Low";
  else if (agreement > 0.15) confidence = "Med";

  return {
    premium: +Math.max(premium, 0.01).toFixed(2),
    confidence,
    pathA: +Math.max(pathA, 0.01).toFixed(2),
    pathB: +Math.max(pathB, 0.01).toFixed(2),
  };
}

// ---------- implied volatility by moneyness ----------

export function getImpliedVol(
  S: number,
  K: number,
  baseVol: number = 0.22
): number {
  const moneyness = Math.abs(S - K) / S;
  // Volatility smile: OTM options have higher IV
  return baseVol * (1 + moneyness * 3);
}

// ---------- generate underlying path (GBM) ----------

export interface PricePath {
  times: string[];
  labels: string[];
  prices: number[];
  dayIndices: number[];
}

/**
 * Generate a synthetic underlying price path from entry to expiration.
 * Uses Geometric Brownian Motion with the seeded PRNG.
 */
export function generateUnderlyingPath(
  ticker: string,
  date: string,
  entryTime: string,
  expirationDays: number, // 0 = same day, 1..5 = days to Friday
  basePrice: number,
  sigma: number = 0.22
): PricePath {
  const rng = seedFromMoment(ticker, date, entryTime, 42);
  const dt = 15 / (252 * 390); // 15 minutes as fraction of year (252 days * 390 min/day)
  const mu = 0.0; // drift ≈ 0 for short term

  const times: string[] = [];
  const labels: string[] = [];
  const prices: number[] = [];
  const dayIndices: number[] = [];

  let S = basePrice;

  // Trading hours: 09:30 to 16:00 => 26 fifteen-minute buckets
  // Entry could be any bucket from 09:30 to 15:45
  const entryHour = parseInt(entryTime.split(":")[0]);
  const entryMin = parseInt(entryTime.split(":")[1]);
  const entryBucket = (entryHour - 9) * 4 + Math.floor(entryMin / 15) - 2; // 09:30 = bucket 0

  for (let day = 0; day <= expirationDays; day++) {
    const startBucket = day === 0 ? entryBucket : 0;
    const endBucket = 26; // 16:00

    for (let b = startBucket; b <= endBucket; b++) {
      const hour = 9 + Math.floor((b + 2) / 4);
      const minute = ((b + 2) % 4) * 15;
      const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

      if (day === 0 && b === startBucket) {
        // Entry point — use base price
      } else {
        // Box-Muller for normal random
        const u1 = Math.max(rng(), 1e-10);
        const u2 = rng();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        S = S * Math.exp((mu - (sigma * sigma) / 2) * dt + sigma * Math.sqrt(dt) * z);
      }

      const dayLabel = day === 0 ? "Today" : `Day +${day}`;

      times.push(timeStr);
      labels.push(day === 0 ? timeStr : `${dayLabel} ${timeStr}`);
      prices.push(+S.toFixed(2));
      dayIndices.push(day);
    }
  }

  return { times, labels, prices, dayIndices };
}
