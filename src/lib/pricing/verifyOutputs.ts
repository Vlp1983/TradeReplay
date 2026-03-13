/**
 * Post-hoc verification and correction of option bars.
 *
 * Silently fixes:
 *   1. Intrinsic value floor violations
 *   2. Deep ITM price caps
 *   3. Bar-to-bar continuity breaks (> 50% move when underlying < 2%)
 *   4. Price minimum ($0.01)
 */

import type { OptionBar, Bar, OptionType } from "./types";

export function verifyOutputs(
  bars: OptionBar[],
  strike: number,
  optionType: OptionType,
  intradayBars: Bar[]
): OptionBar[] {
  if (bars.length === 0) return bars;

  const corrected = bars.map((bar, i) => {
    const underlying = i < intradayBars.length ? intradayBars[i] : undefined;
    const underlyingClose = underlying?.close ?? 0;

    let { open, high, low, close } = bar;

    // Only apply intrinsic/ITM checks when we have real underlying data
    if (underlyingClose > 0) {
      // 1. Intrinsic floor
      const intrinsic =
        optionType === "call"
          ? Math.max(0, underlyingClose - strike)
          : Math.max(0, strike - underlyingClose);

      close = Math.max(close, intrinsic, 0.01);

      // 2. Deep ITM cap
      if (optionType === "call" && underlyingClose > strike) {
        const maxPrice = 0.99 * (underlyingClose - strike) + strike * 0.1;
        close = Math.min(close, maxPrice);
      }
      if (optionType === "put" && strike > underlyingClose) {
        const maxPrice = 0.99 * (strike - underlyingClose) + underlyingClose * 0.1;
        close = Math.min(close, maxPrice);
      }
    }

    // Enforce $0.01 floor on all OHLC
    open = Math.max(open, 0.01);
    high = Math.max(high, 0.01);
    low = Math.max(low, 0.01);
    close = Math.max(close, 0.01);

    // Ensure high >= max(open, close) and low <= min(open, close)
    high = Math.max(high, open, close);
    low = Math.min(low, open, close);
    low = Math.max(low, 0.01);

    return {
      timestamp: bar.timestamp,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
    };
  });

  // 3. Bar-to-bar continuity check
  for (let i = 1; i < corrected.length - 1; i++) {
    const prev = corrected[i - 1].close;
    const curr = corrected[i].close;

    if (prev <= 0.01) continue;

    const optionMove = Math.abs(curr - prev) / prev;
    const underlyingBar = intradayBars[i];
    const underlyingMove = underlyingBar?.open > 0
      ? Math.abs(underlyingBar.close - underlyingBar.open) / underlyingBar.open
      : 0;

    // If option moved > 50% but underlying moved < 2%, interpolate
    if (optionMove > 0.5 && underlyingMove < 0.02) {
      const next = corrected[i + 1]?.close ?? curr;
      corrected[i] = {
        ...corrected[i],
        close: +((prev + next) / 2).toFixed(2),
      };
      // Recompute high/low
      corrected[i].high = +Math.max(
        corrected[i].open,
        corrected[i].close
      ).toFixed(2);
      corrected[i].low = +Math.max(
        0.01,
        Math.min(corrected[i].open, corrected[i].close)
      ).toFixed(2);
    }
  }

  return corrected;
}
