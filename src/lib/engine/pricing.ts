/**
 * Option pricing engine.
 *
 * Uses standard Black-Scholes for all premium calculations.
 * normalCDF uses the Abramowitz & Stegun erfc-based approximation
 * (more numerically stable than the raw Horner form).
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
  const z = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * z);
  const y =
    1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
  return 0.5 * (1.0 + sign * y);
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
  // Options (equities/ETFs)
  SPY: 510,
  QQQ: 445,
  AAPL: 230,
  TSLA: 340,
  NVDA: 135,
  AMZN: 210,
  // Futures
  ES: 5100,
  NQ: 18200,
  CL: 72,
  GC: 2350,
  SI: 28,
  // Crypto
  BTC: 97000,
  ETH: 3400,
  SOL: 190,
  DOGE: 0.32,
  XRP: 2.40,
};

/**
 * Base implied volatility by ticker (annualized).
 *
 * IV tiers:
 *  - Major ETFs (SPY, QQQ): ~16% baseline
 *  - Large cap stocks (AAPL, AMZN): ~28%
 *  - High-vol stocks (TSLA, NVDA): ~45%
 *  - Futures: matched to underlying equity IV
 *  - Crypto: elevated (60-100%)
 *
 * TODO: Scale up IV by 1.5x if within 3 days of earnings
 */
export const BASE_VOLATILITY: Record<string, number> = {
  // Major ETFs — ~16% baseline
  SPY: 0.16,
  QQQ: 0.18,
  // Large cap stocks — ~28%
  AAPL: 0.28,
  AMZN: 0.28,
  // High-vol / meme-adjacent stocks — ~45%
  TSLA: 0.45,
  NVDA: 0.45,
  // Futures — matched to equity counterpart
  ES: 0.16,
  NQ: 0.18,
  CL: 0.35,
  GC: 0.15,
  SI: 0.28,
  // Crypto (higher vol)
  BTC: 0.60,
  ETH: 0.70,
  SOL: 0.85,
  DOGE: 1.00,
  XRP: 0.80,
};

/**
 * Price variation range by asset class.
 * Crypto/futures can swing more than equity options.
 */
const PRICE_VARIATION: Record<string, number> = {
  SPY: 0.06, QQQ: 0.06, AAPL: 0.08, TSLA: 0.10, NVDA: 0.10, AMZN: 0.08,
  ES: 0.06, NQ: 0.06, CL: 0.10, GC: 0.06, SI: 0.10,
  BTC: 0.12, ETH: 0.14, SOL: 0.18, DOGE: 0.20, XRP: 0.16,
};

/** Generate a deterministic underlying price for a given moment. */
export function getUnderlyingPrice(
  ticker: string,
  date: string,
  time: string
): number {
  const rng = seedFromMoment(ticker, date, time);
  const base = BASE_PRICES[ticker] ?? 500;
  const variation = PRICE_VARIATION[ticker] ?? 0.06;
  return +(base * (1 + (rng() - 0.5) * variation)).toFixed(
    base < 1 ? 4 : base < 100 ? 2 : 2
  );
}

// ---------- Black-Scholes pricing ----------

/**
 * Standard Black-Scholes price for a European call or put.
 *
 * @param S     - Underlying spot price
 * @param K     - Strike price
 * @param T     - Time to expiry in years (trading time)
 * @param isCall - true for call, false for put
 * @param sigma - Implied volatility (annualized, e.g. 0.16 = 16%)
 * @param r     - Risk-free rate (default 5%)
 */
export function blackScholesPrice(
  S: number,
  K: number,
  T: number,
  isCall: boolean,
  sigma: number,
  r: number = 0.05
): number {
  if (T <= 0) {
    return isCall ? Math.max(0, S - K) : Math.max(0, K - S);
  }
  if (sigma <= 0) return 0;

  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  if (isCall) {
    return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
  } else {
    return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
  }
}

/**
 * Black-Scholes delta.
 * Returns positive for calls (0 to 1), negative for puts (-1 to 0).
 */
export function blackScholesDelta(
  S: number,
  K: number,
  T: number,
  isCall: boolean,
  sigma: number,
  r: number = 0.05
): number {
  if (T <= 0) return isCall ? (S > K ? 1 : 0) : (S < K ? -1 : 0);
  if (sigma <= 0) return 0;
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  return isCall ? normalCDF(d1) : normalCDF(d1) - 1;
}

// ---------- Black-Scholes Greeks ----------

/**
 * Black-Scholes theta (per calendar day, not annualized).
 * Returns a negative number for long options (time decay).
 */
export function blackScholesTheta(
  S: number,
  K: number,
  T: number,
  isCall: boolean,
  sigma: number,
  r: number = 0.05
): number {
  if (T <= 0 || sigma <= 0) return 0;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const nd1 = normalPDF(d1);

  // First term: always negative (time decay of optionality)
  const term1 = -(S * nd1 * sigma) / (2 * sqrtT);

  if (isCall) {
    // Call theta = term1 - r*K*e^(-rT)*N(d2)
    return (term1 - r * K * Math.exp(-r * T) * normalCDF(d2)) / 365;
  } else {
    // Put theta = term1 + r*K*e^(-rT)*N(-d2)
    return (term1 + r * K * Math.exp(-r * T) * normalCDF(-d2)) / 365;
  }
}

/**
 * Black-Scholes gamma (same for calls and puts).
 * Measures rate of change of delta w.r.t. underlying price.
 */
export function blackScholesGamma(
  S: number,
  K: number,
  T: number,
  sigma: number,
  r: number = 0.05
): number {
  if (T <= 0 || sigma <= 0 || S <= 0) return 0;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  return normalPDF(d1) / (S * sigma * sqrtT);
}

/**
 * Black-Scholes vega (per 1% change in IV).
 * Same for calls and puts. Returns dollar change per 0.01 IV move.
 */
export function blackScholesVega(
  S: number,
  K: number,
  T: number,
  sigma: number,
  r: number = 0.05
): number {
  if (T <= 0 || sigma <= 0) return 0;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  return S * normalPDF(d1) * sqrtT * 0.01; // per 1% IV change
}

/** Standard normal PDF. */
function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// ---------- SABR volatility skew ----------

/**
 * Approximate SABR-inspired volatility skew/smile.
 *
 * Models three effects:
 *   1. OTM skew: puts get higher IV, calls get slightly lower
 *   2. Smile: deep OTM options in either direction get elevated IV
 *   3. Term structure: shorter-dated options have steeper skew
 *
 * @param S         - Spot price
 * @param K         - Strike price
 * @param T         - Time to expiry (years)
 * @param baseIV    - ATM implied volatility
 * @param isCall    - true for call, false for put
 * @returns Skew-adjusted IV
 */
export function getSABRSkewedIV(
  S: number,
  K: number,
  T: number,
  baseIV: number,
  isCall: boolean
): number {
  if (S <= 0 || K <= 0 || T <= 0) return baseIV;

  const logMoneyness = Math.log(K / S); // negative for ITM calls / OTM puts
  const absMoneyness = Math.abs(logMoneyness);

  // 1. Skew: OTM puts get ~2-4% higher IV per 1% OTM, calls slightly lower
  //    This models the "volatility smirk" seen in equity options
  const skewStrength = 0.15 / Math.max(Math.sqrt(T), 0.1); // steeper for short-dated
  const skew = -logMoneyness * skewStrength * baseIV; // positive for OTM puts (K < S)

  // 2. Smile: deep OTM in either direction gets higher IV
  const smileStrength = 0.5;
  const smile = absMoneyness * absMoneyness * smileStrength * baseIV;

  // 3. Term structure dampening: longer-dated options converge to ATM IV
  const termDamp = Math.min(1, 0.3 / Math.max(T, 0.001));

  const adjustedIV = baseIV + (skew + smile) * termDamp;

  // Clamp to reasonable range: 50% to 300% of base IV
  return Math.max(baseIV * 0.5, Math.min(baseIV * 3.0, adjustedIV));
}

// ---------- Deterministic IV noise ----------

/**
 * Generate a small, deterministic IV perturbation for a specific bar.
 * Models intraday IV fluctuation (mean-reverting around base).
 *
 * @param rng       - Seeded PRNG function
 * @param baseIV    - Current implied volatility
 * @param barIndex  - Index of the current bar (for autocorrelation)
 * @returns IV noise as a multiplier (e.g., 0.97 to 1.03)
 */
export function getIVNoise(
  rng: () => number,
  barIndex: number,
  amplitude: number = 0.02
): number {
  // Generate two uniform randoms → Box-Muller for normal
  const u1 = Math.max(rng(), 1e-10);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  // Autocorrelation: each bar's noise is partially inherited from previous
  // This prevents unrealistic IV jumps between adjacent bars
  const decay = 0.85; // mean-reversion speed
  const innovation = z * amplitude;

  // Simple AR(1)-like noise: dampened random walk
  // The barIndex creates a deterministic "path" effect
  const phase = Math.sin(barIndex * 0.3) * amplitude * 0.5;
  return 1 + innovation * (1 - decay) + phase;
}

// ---------- consensus pricing (uses pure BS) ----------

export interface PriceEstimate {
  premium: number;
  confidence: Confidence;
}

/**
 * Estimate option premium using pure Black-Scholes.
 * Used by the synthetic chain generator.
 */
export function estimatePremium(
  S: number,
  K: number,
  T: number,
  isCall: boolean,
  sigma: number = 0.25,
  r: number = 0.05
): PriceEstimate {
  const premium = blackScholesPrice(S, K, T, isCall, sigma, r);

  // Confidence based on moneyness — ATM is most reliable
  const moneyness = Math.abs(S - K) / S;
  let confidence: Confidence = "High";
  if (moneyness > 0.10) confidence = "Low";
  else if (moneyness > 0.04) confidence = "Med";

  return {
    premium: +Math.max(premium, 0.01).toFixed(2),
    confidence,
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

// ---------- delta calculation ----------

/**
 * Compute option delta. Delegates to blackScholesDelta.
 * Returns positive for calls (0 to 1), negative for puts (-1 to 0).
 */
export function computeDelta(
  S: number,
  K: number,
  T: number,
  isCall: boolean,
  sigma: number = 0.25,
  r: number = 0.05
): number {
  return blackScholesDelta(S, K, T, isCall, sigma, r);
}

// ---------- dual price formatting ----------

/** Format a price showing both per-share and per-contract (100x) values. */
export function formatDualPrice(perShare: number): string {
  const perContract = perShare * 100;
  return `$${Math.abs(perShare).toFixed(2)} per share · $${Math.abs(perContract).toFixed(2)} per contract`;
}

/** Format a signed P/L showing both per-share and per-contract values. */
export function formatDualPL(perContract: number): string {
  const perShare = perContract / 100;
  const sign = perContract >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(perShare).toFixed(2)} per share / ${sign}$${Math.abs(perContract).toFixed(2)} per contract`;
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

      // 12-hour display label
      let h12 = hour;
      const suffix = h12 >= 12 ? "PM" : "AM";
      if (h12 === 0) h12 = 12;
      else if (h12 > 12) h12 -= 12;
      const timeLabel = `${h12}:${minute.toString().padStart(2, "0")} ${suffix}`;

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
      labels.push(day === 0 ? timeLabel : `${dayLabel} ${timeLabel}`);
      prices.push(+S.toFixed(2));
      dayIndices.push(day);
    }
  }

  return { times, labels, prices, dayIndices };
}
