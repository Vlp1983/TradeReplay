/**
 * Option pricing: Black-Scholes for dte >= 1, Merton jump-diffusion for 0DTE.
 * Also provides Greeks computation.
 */

import type { Greeks, OptionType } from "./types";

// ─── Normal distribution ─────────────────────────────────────────────

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

function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// ─── Core Black-Scholes ──────────────────────────────────────────────

function bsPrice(
  S: number,
  K: number,
  T: number,
  sigma: number,
  r: number,
  optionType: OptionType
): number {
  if (T <= 0) {
    return optionType === "call"
      ? Math.max(0, S - K)
      : Math.max(0, K - S);
  }
  if (sigma <= 0 || S <= 0 || K <= 0) return 0;

  const sqrtT = Math.sqrt(T);
  const d1 =
    (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  if (optionType === "call") {
    return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
  } else {
    return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
  }
}

// ─── American put early exercise correction ──────────────────────────

function americanPutCorrection(
  S: number,
  K: number,
  dte: number,
  bsPutPrice: number
): number {
  // Only for puts where dte <= 21 AND ITM (moneyness < -0.05)
  if (dte > 21 || S <= 0 || K <= 0) return 0;

  const moneyness = Math.log(S / K); // negative for ITM puts
  if (moneyness >= -0.05) return 0;

  const intrinsic = Math.max(0, K - S);
  const correction = Math.max(0, intrinsic - bsPutPrice);

  // Simplified Kim integral approximation
  const earlyExerciseProb =
    0.15 * (1 - dte / 21) * Math.min(1, (Math.abs(moneyness) - 0.05) / 0.2);

  return correction * Math.max(0, earlyExerciseProb);
}

// ─── Merton Jump-Diffusion (0DTE) ───────────────────────────────────

function mertonPrice(
  S: number,
  K: number,
  T: number,
  sigma: number,
  r: number,
  optionType: OptionType
): number {
  if (T <= 0) {
    return optionType === "call"
      ? Math.max(0, S - K)
      : Math.max(0, K - S);
  }

  const lambda = 3.0; // jump intensity
  const muJ = -0.02; // mean jump size (slight negative bias)
  const sigmaJ = 0.03; // jump volatility
  const lambdaT = lambda * T;

  let price = 0;

  for (let n = 0; n <= 10; n++) {
    // Poisson weight
    const poissonWeight = Math.exp(-lambdaT) * Math.pow(lambdaT, n) / factorial(n);

    // Adjusted sigma for n jumps
    const sigmaN = Math.sqrt(
      Math.max(sigma * sigma + (n * sigmaJ * sigmaJ) / Math.max(T, 1e-10), 1e-10)
    );

    // Adjusted drift for n jumps
    const rN = r - lambda * muJ + (n * Math.log(1 + muJ)) / Math.max(T, 1e-10);

    price += poissonWeight * bsPrice(S, K, T, sigmaN, rN, optionType);
  }

  return price;
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

// ─── Main pricing function ───────────────────────────────────────────

/**
 * Price a European/American option.
 *
 * Uses Merton jump-diffusion for 0DTE, Black-Scholes + American put
 * correction for all other DTE buckets.
 */
export function priceOption(
  spot: number,
  strike: number,
  dte: number,
  iv: number,
  riskFreeRate: number,
  optionType: OptionType,
  dteBucket: string
): number {
  const T = Math.max(dte / 365, 1e-8);

  let price: number;

  if (dteBucket === "0DTE" || dte === 0) {
    // For 0DTE: use remaining trading time as fraction of year
    // Approximate: if it's market open, ~6.5 hours = 390 min remaining
    // T already computed from dte/365, but for 0DTE use a more granular T
    const T0 = Math.max(dte / 365, 1 / (365 * 24)); // minimum ~1 hour worth
    price = mertonPrice(spot, strike, T0, iv, riskFreeRate, optionType);
  } else {
    price = bsPrice(spot, strike, T, iv, riskFreeRate, optionType);

    // American put early exercise correction
    if (optionType === "put") {
      price += americanPutCorrection(spot, strike, dte, price);
    }
  }

  return Math.max(0.01, price);
}

// ─── Greeks ──────────────────────────────────────────────────────────

/**
 * Compute BS Greeks for display and intraday bar generation.
 */
export function computeGreeks(
  spot: number,
  strike: number,
  dte: number,
  iv: number,
  riskFreeRate: number,
  optionType: OptionType
): Greeks {
  const T = Math.max(dte / 365, 1e-8);
  const r = riskFreeRate;
  const sigma = Math.max(iv, 0.001);

  if (spot <= 0 || strike <= 0 || T <= 0) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0 };
  }

  const sqrtT = Math.sqrt(T);
  const d1 =
    (Math.log(spot / strike) + (r + 0.5 * sigma * sigma) * T) /
    (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const nd1 = normalPDF(d1);

  // Delta
  let delta: number;
  if (optionType === "call") {
    delta = normalCDF(d1);
    delta = Math.max(0, Math.min(1, delta));
  } else {
    delta = normalCDF(d1) - 1;
    delta = Math.max(-1, Math.min(0, delta));
  }

  // Gamma (same for calls and puts)
  const gamma = nd1 / (spot * sigma * sqrtT);

  // Theta (per calendar day)
  const term1 = -(spot * nd1 * sigma) / (2 * sqrtT);
  let theta: number;
  if (optionType === "call") {
    theta = (term1 - r * strike * Math.exp(-r * T) * normalCDF(d2)) / 365;
  } else {
    theta = (term1 + r * strike * Math.exp(-r * T) * normalCDF(-d2)) / 365;
  }

  // Vega (per 1% IV change)
  const vega = spot * nd1 * sqrtT * 0.01;

  return { delta, gamma, theta, vega };
}
