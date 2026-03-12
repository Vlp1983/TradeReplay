/**
 * Strike chain generation: ATM + 5 OTM strikes for calls and puts.
 *
 * Strike spacing based on spot price:
 *   < $20:   $0.50
 *   $20-50:  $1
 *   $50-100: $1
 *   $100-200: $2
 *   $200-500: $5
 *   > $500:  $10
 *
 * OTM strikes at ~[0.5%, 1.5%, 3%, 5%, 8%] from ATM,
 * snapped to nearest valid interval.
 */

import type { Strike, StrikeChain } from "./types";

// ─── Strike spacing ─────────────────────────────────────────────────

function getStrikeSpacing(spot: number): number {
  if (spot < 20) return 0.5;
  if (spot < 50) return 1;
  if (spot < 100) return 1;
  if (spot < 200) return 2;
  if (spot < 500) return 5;
  return 10;
}

function roundToStrike(price: number, spacing: number): number {
  const precision = spacing < 1 ? 2 : 0;
  return +(Math.round(price / spacing) * spacing).toFixed(precision);
}

// ─── Percentage targets ──────────────────────────────────────────────

const OTM_PERCENTAGES = [0.005, 0.015, 0.03, 0.05, 0.08];

// ─── Main generator ─────────────────────────────────────────────────

export function generateStrikeChain(
  spot: number,
  replayDate: Date
): StrikeChain {
  const spacing = getStrikeSpacing(spot);
  const atmStrike = roundToStrike(spot, spacing);

  // Generate call strikes: ATM + 5 OTM (above ATM)
  const calls: Strike[] = [
    { strike: atmStrike, label: "ATM" },
  ];
  for (const pct of OTM_PERCENTAGES) {
    const target = atmStrike * (1 + pct);
    const strike = roundToStrike(target, spacing);
    if (strike !== atmStrike && !calls.some((s) => s.strike === strike)) {
      const actualPct = ((strike - atmStrike) / atmStrike) * 100;
      calls.push({
        strike,
        label: `+${actualPct.toFixed(1)}%`,
      });
    }
  }

  // Also add 5 ITM calls (below ATM)
  const callITM: Strike[] = [];
  for (const pct of OTM_PERCENTAGES) {
    const target = atmStrike * (1 - pct);
    const strike = roundToStrike(target, spacing);
    if (strike !== atmStrike && !callITM.some((s) => s.strike === strike)) {
      const actualPct = ((strike - atmStrike) / atmStrike) * 100;
      callITM.push({
        strike,
        label: `${actualPct.toFixed(1)}%`,
      });
    }
  }

  // Generate put strikes: ATM + 5 OTM (below ATM)
  const puts: Strike[] = [
    { strike: atmStrike, label: "ATM" },
  ];
  for (const pct of OTM_PERCENTAGES) {
    const target = atmStrike * (1 - pct);
    const strike = roundToStrike(target, spacing);
    if (strike !== atmStrike && !puts.some((s) => s.strike === strike)) {
      const actualPct = ((strike - atmStrike) / atmStrike) * 100;
      puts.push({
        strike,
        label: `${actualPct.toFixed(1)}%`,
      });
    }
  }

  // Also add 5 ITM puts (above ATM)
  const putITM: Strike[] = [];
  for (const pct of OTM_PERCENTAGES) {
    const target = atmStrike * (1 + pct);
    const strike = roundToStrike(target, spacing);
    if (strike !== atmStrike && !putITM.some((s) => s.strike === strike)) {
      const actualPct = ((strike - atmStrike) / atmStrike) * 100;
      putITM.push({
        strike,
        label: `+${actualPct.toFixed(1)}%`,
      });
    }
  }

  // Combine: ITM + ATM + OTM for each side, sorted by strike
  const allCalls = [...callITM.reverse(), ...calls].sort(
    (a, b) => a.strike - b.strike
  );
  const allPuts = [...puts, ...putITM].sort(
    (a, b) => a.strike - b.strike
  );

  return {
    calls: allCalls,
    puts: allPuts,
    atmStrike,
  };
}
