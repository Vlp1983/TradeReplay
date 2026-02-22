/**
 * Generate a synthetic option chain snapshot for a given moment.
 */

import type { Ticker, Expiration, ChainRow, ChainData } from "./types";
import {
  getUnderlyingPrice,
  estimatePremium,
  getImpliedVol,
  BASE_VOLATILITY,
} from "./pricing";

/**
 * Compute days-to-expiration in years for 0DTE or Friday weekly.
 */
function getDTE(
  date: string,
  entryTime: string,
  expiration: Expiration
): number {
  const entryHour = parseInt(entryTime.split(":")[0]);
  const entryMin = parseInt(entryTime.split(":")[1]);
  const minutesToClose = (16 - entryHour) * 60 - entryMin;

  if (expiration === "0dte") {
    return minutesToClose / (252 * 390); // fraction of year
  }

  // Friday weekly: find days to Friday from the given date
  const d = new Date(date + "T12:00:00");
  const dayOfWeek = d.getDay(); // 0=Sun, 5=Fri
  let daysToFriday = (5 - dayOfWeek + 7) % 7;
  if (daysToFriday === 0) daysToFriday = 0; // already Friday => 0DTE-ish behavior
  const totalMinutes = daysToFriday * 390 + minutesToClose;
  return totalMinutes / (252 * 390);
}

/**
 * Number of calendar days from the entry date to expiration.
 * For 0DTE = 0, for Friday weekly = days until Friday.
 */
export function getExpirationDays(
  date: string,
  expiration: Expiration
): number {
  if (expiration === "0dte") return 0;
  const d = new Date(date + "T12:00:00");
  const dayOfWeek = d.getDay();
  const daysToFriday = (5 - dayOfWeek + 7) % 7;
  return daysToFriday || 0;
}

/**
 * Strike spacing per ticker — wider for higher-priced underlyings.
 * Returns the dollar increment between strikes.
 */
function getStrikeSpacing(ticker: string, price: number): number {
  const spacingMap: Record<string, number> = {
    // Equities / ETFs — $1 increments
    SPY: 1, QQQ: 1, AAPL: 1, TSLA: 1, NVDA: 1, AMZN: 1,
    // Futures — vary by contract
    ES: 5,     // $5 per tick
    NQ: 25,    // $25 per tick
    CL: 0.50,  // $0.50 per tick
    GC: 5,     // $5 per tick
    SI: 0.25,  // $0.25 per tick
    // Crypto — scale with price
    BTC: 1000,
    ETH: 25,
    SOL: 2,
    DOGE: 0.005,
    XRP: 0.05,
  };
  return spacingMap[ticker] ?? (price > 1000 ? 10 : price > 100 ? 1 : 0.5);
}

/**
 * Round to nearest strike for the given ticker.
 */
function roundToStrike(price: number, spacing: number): number {
  return +(Math.round(price / spacing) * spacing).toFixed(
    spacing < 0.01 ? 4 : spacing < 1 ? 2 : 0
  );
}

/**
 * Generate the full chain snapshot (10 strikes around ATM for both calls and puts).
 */
export function generateChain(
  ticker: Ticker,
  date: string,
  entryTime: string,
  expiration: Expiration
): ChainData {
  const S = getUnderlyingPrice(ticker, date, entryTime);
  const T = getDTE(date, entryTime, expiration);
  const spacing = getStrikeSpacing(ticker, S);
  const baseVol = BASE_VOLATILITY[ticker] ?? 0.22;

  // ATM strike = nearest strike increment
  const atmStrike = roundToStrike(S, spacing);

  // 5 strikes below ATM, ATM, 4 strikes above (10 total)
  const strikesArr: number[] = [];
  for (let i = -5; i <= 4; i++) {
    const raw = atmStrike + i * spacing;
    strikesArr.push(+(raw.toFixed(spacing < 0.01 ? 4 : spacing < 1 ? 2 : 0)));
  }

  const calls: ChainRow[] = strikesArr.map((K) => {
    const iv = getImpliedVol(S, K, baseVol);
    const est = estimatePremium(S, K, T, true, iv);
    return {
      strike: K,
      premium: est.premium,
      confidence: est.confidence,
      isATM: K === atmStrike,
    };
  });

  const puts: ChainRow[] = strikesArr.map((K) => {
    const iv = getImpliedVol(S, K, baseVol);
    const est = estimatePremium(S, K, T, false, iv);
    return {
      strike: K,
      premium: est.premium,
      confidence: est.confidence,
      isATM: K === atmStrike,
    };
  });

  return {
    ticker,
    date,
    entryTime,
    expiration,
    underlyingPrice: S,
    calls,
    puts,
  };
}
