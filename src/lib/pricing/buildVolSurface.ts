/**
 * Volatility surface: maps ATM IV to strike-specific IV using
 * SABR smirk (dte >= 2) or symmetric smile (dte === 0),
 * with interpolation for dte === 1.
 */

import type { TickerConfig, OptionType } from "./types";

/**
 * Returns the skew-adjusted IV for a specific strike/dte/type.
 */
export function buildVolSurface(
  atmIV: number,
  strike: number,
  spot: number,
  dte: number,
  optionType: OptionType,
  tickerConfig: TickerConfig
): number {
  if (spot <= 0 || strike <= 0) return atmIV;

  const moneyness = Math.log(strike / spot);

  if (dte === 0) {
    return clampIV(symmetricSmile(atmIV, moneyness));
  }

  if (dte === 1) {
    // Interpolate: 70% smile / 30% smirk
    const smile = symmetricSmile(atmIV, moneyness);
    const smirk = sabrSmirk(atmIV, moneyness, tickerConfig);
    return clampIV(0.7 * smile + 0.3 * smirk);
  }

  // dte >= 2: SABR smirk
  return clampIV(sabrSmirk(atmIV, moneyness, tickerConfig));
}

// ─── SABR Smirk (dte >= 2) ──────────────────────────────────────────

function sabrSmirk(
  atmIV: number,
  moneyness: number,
  tickerConfig: TickerConfig
): number {
  const rho = tickerConfig.sabrRho; // negative, e.g. -0.35
  const nu = 0.4; // vol of vol

  // Simplified SABR approximation:
  // sigma(K) = atmIV * (1 + rho*nu*m + (nu²/4 + rho²/3)*m²)
  const linear = rho * nu * moneyness;
  const quadratic =
    (nu * nu / 4 + (rho * rho) / 3) * moneyness * moneyness;

  return atmIV * (1 + linear + quadratic);
}

// ─── Symmetric Smile (0DTE) ─────────────────────────────────────────

function symmetricSmile(atmIV: number, moneyness: number): number {
  // Quadratic smile: both OTM calls and OTM puts get higher IV
  const smileConvexity = 2.5;
  return atmIV * (1 + smileConvexity * moneyness * moneyness);
}

// ─── Clamp ──────────────────────────────────────────────────────────

function clampIV(iv: number): number {
  return Math.max(0.05, Math.min(3.0, iv));
}
