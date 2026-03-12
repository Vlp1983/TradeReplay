/**
 * Liquidity adjustment: widens high/low spread based on liquidity class.
 *
 * Spread widths (as fraction of midpoint):
 *   liquid:      0.8%
 *   semi_liquid: 3.5%
 *   illiquid:    10%
 *
 * Open and close are treated as midpoint estimates (unchanged).
 */

import type { OptionBar, LiquidityClass } from "./types";

const SPREAD_WIDTHS: Record<LiquidityClass, number> = {
  liquid: 0.008,
  semi_liquid: 0.035,
  illiquid: 0.1,
};

export function applyLiquidityAdj(
  bars: OptionBar[],
  liquidityClass: string
): OptionBar[] {
  const spreadWidth =
    SPREAD_WIDTHS[liquidityClass as LiquidityClass] ?? 0.035;

  return bars.map((bar) => ({
    timestamp: bar.timestamp,
    open: bar.open,
    close: bar.close,
    high: +Math.max(0.01, bar.high * (1 + spreadWidth / 2)).toFixed(2),
    low: +Math.max(0.01, bar.low * (1 - spreadWidth / 2)).toFixed(2),
  }));
}
