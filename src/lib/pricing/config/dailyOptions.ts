/**
 * Tickers that have daily (Mon–Fri) options expirations.
 * These tickers support 0DTE trades on any trading day.
 */

export const DAILY_OPTIONS_TICKERS = new Set([
  "SPY", "QQQ", "IWM",
  "AAPL", "TSLA", "NVDA", "AMZN", "META", "MSFT", "GOOGL",
  "AMD", "COIN", "PLTR", "SOFI",
  "BA", "GS", "JPM", "BAC",
  "NFLX", "DIS", "UBER",
  "GLD", "SLV", "TLT",
  "XLF", "XLE", "XBI", "ARKK",
  "SMCI", "ARM", "MRVL",
]);

/** Check if a ticker has daily options expirations (supports 0DTE any day) */
export function hasDailyOptions(ticker: string): boolean {
  return DAILY_OPTIONS_TICKERS.has(ticker.toUpperCase());
}
