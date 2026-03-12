/**
 * Synthetic options pricing engine — main entry point.
 *
 * Orchestrates the full pipeline:
 *   1. classifyContract
 *   2. collectInputs
 *   3. estimateIV (4-method weighted ensemble)
 *   4. buildVolSurface (SABR/smile skew)
 *   5. priceOption at open (anchor first bar)
 *   6. computeGreeks at open
 *   7. generateIntradayBars (5-factor model)
 *   8. applyLiquidityAdj
 *   9. verifyOutputs
 *  10. generateStrikeChain
 *  11. generateExpiries
 */

import type { OptionPricingResult, OptionType } from "./types";
import { classifyContract } from "./classifyContract";
import { collectInputs } from "./collectInputs";
import { estimateIV } from "./estimateIV";
import { buildVolSurface } from "./buildVolSurface";
import { priceOption, computeGreeks } from "./priceOption";
import { generateIntradayBars } from "./generateIntradayBars";
import { applyLiquidityAdj } from "./applyLiquidityAdj";
import { verifyOutputs } from "./verifyOutputs";
import { generateStrikeChain } from "./generateStrikeChain";
import { generateExpiries } from "./generateExpiries";
import { getTickerConfig } from "./config/tickers";

// Re-export all types for consumers
export type {
  OptionPricingResult,
  OptionBar,
  OptionType,
  Bar,
  Greeks,
  ContractClassification,
  StrikeChain,
  Strike,
  Expiry,
  ExpiryType,
  DteBucket,
  LiquidityClass,
  MoneynessClass,
  TickerConfig,
  PricingInputs,
} from "./types";

// Re-export individual modules for advanced usage
export { classifyContract } from "./classifyContract";
export { collectInputs } from "./collectInputs";
export { estimateIV } from "./estimateIV";
export { buildVolSurface } from "./buildVolSurface";
export { priceOption, computeGreeks } from "./priceOption";
export { generateIntradayBars } from "./generateIntradayBars";
export { applyLiquidityAdj } from "./applyLiquidityAdj";
export { verifyOutputs } from "./verifyOutputs";
export { generateStrikeChain } from "./generateStrikeChain";
export { generateExpiries } from "./generateExpiries";
export { getTickerConfig } from "./config/tickers";
export { getRiskFreeRate } from "./config/ratesTable";

/**
 * Generate full option pricing for a given contract.
 *
 * This is the primary entry point. Pass ticker, replay date, strike,
 * expiry, and option type — get back intraday option bars, Greeks,
 * IV used, classification, strike chain, and available expiries.
 */
export async function generateOptionPricing(params: {
  ticker: string;
  replayDate: Date;
  strike: number;
  expiry: Date;
  optionType: OptionType;
}): Promise<OptionPricingResult> {
  const { ticker, replayDate, strike, expiry, optionType } = params;

  try {
    // 1. Get ticker config (with defaults for unknown tickers)
    const tickerConfig = getTickerConfig(ticker);

    // 2. Collect all inputs from Polygon
    const inputs = await collectInputs(
      ticker,
      replayDate,
      strike,
      expiry,
      optionType
    );

    // Use actual open price if available, otherwise try daily bars, then strike as fallback
    let spot: number;
    if (inputs.underlyingOpenPrice > 0) {
      spot = inputs.underlyingOpenPrice;
    } else if (inputs.priorDailyBars.length > 0) {
      // Use the most recent daily bar close as fallback
      spot = inputs.priorDailyBars[inputs.priorDailyBars.length - 1].close;
      console.warn(`[generateOptionPricing] No intraday open price, using last daily close: ${spot}`);
    } else {
      // Last resort: use strike (assumes ATM) — much better than hardcoded 100
      spot = strike;
      console.warn(`[generateOptionPricing] No price data available, using strike as spot fallback: ${spot}`);
    }

    console.log(
      `[generateOptionPricing] ticker=${ticker} date=${replayDate.toISOString().slice(0, 10)} ` +
      `optionType=${optionType} strike=${strike} spot=${spot} ` +
      `underlyingOpenPrice=${inputs.underlyingOpenPrice} ` +
      `intradayBars=${inputs.intradayBars.length} dailyBars=${inputs.priorDailyBars.length} ` +
      `vix=${inputs.historicalVIX}`
    );

    // 3. Compute DTE
    const msPerDay = 86400000;
    const dte = Math.max(
      0,
      Math.round((expiry.getTime() - replayDate.getTime()) / msPerDay)
    );

    // 4. Classify the contract
    const classification = classifyContract({
      ticker,
      spot,
      strike,
      dte,
      optionType,
      tickerConfig,
    });

    // 5. Estimate ATM IV via 4-method ensemble
    const atmIV = estimateIV(inputs, classification);

    // 6. Build vol surface — get strike-specific IV
    const ivUsed = buildVolSurface(
      atmIV,
      strike,
      spot,
      dte,
      optionType,
      tickerConfig
    );

    // 7. Price option at open (anchor)
    const openPrice = priceOption(
      spot,
      strike,
      dte,
      ivUsed,
      inputs.riskFreeRate,
      optionType,
      classification.dteBucket
    );

    // 8. Compute Greeks at open
    const greeksAtOpen = computeGreeks(
      spot,
      strike,
      dte,
      ivUsed,
      inputs.riskFreeRate,
      optionType
    );

    // 9. Generate intraday option bars
    let bars = generateIntradayBars({
      intradayBars: inputs.intradayBars,
      strike,
      expiry,
      replayDate,
      optionType,
      iv: ivUsed,
      spot,
      riskFreeRate: inputs.riskFreeRate,
      dteBucket: classification.dteBucket,
      tickerConfig,
    });

    // 10. Apply liquidity adjustment
    bars = applyLiquidityAdj(bars, classification.liquidityClass);

    // 11. Verify and correct outputs
    bars = verifyOutputs(bars, strike, optionType, inputs.intradayBars);

    // 12. Generate strike chain and expiries
    const strikeChain = generateStrikeChain(spot, replayDate);
    const expiries = generateExpiries(replayDate);

    return {
      bars,
      greeksAtOpen,
      ivUsed,
      classification,
      strikeChain,
      expiries,
    };
  } catch (err) {
    // Never throw to user — return safe defaults
    console.error("[generateOptionPricing] Pipeline error:", err);

    const dte = Math.max(
      0,
      Math.round(
        (expiry.getTime() - replayDate.getTime()) / 86400000
      )
    );
    const fallbackPrice = 1.0;

    return {
      bars: [
        {
          timestamp: replayDate.getTime(),
          open: fallbackPrice,
          high: fallbackPrice,
          low: fallbackPrice,
          close: fallbackPrice,
        },
      ],
      greeksAtOpen: { delta: 0.5, gamma: 0, theta: 0, vega: 0 },
      ivUsed: 0.25,
      classification: {
        dteBucket: dte === 0 ? "0DTE" : "weekly",
        liquidityClass: "semi_liquid",
        moneynessClass: "atm",
        delta: optionType === "call" ? 0.5 : -0.5,
      },
      strikeChain: generateStrikeChain(100, replayDate),
      expiries: generateExpiries(replayDate),
    };
  }
}
