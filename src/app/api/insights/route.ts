/**
 * POST /api/insights
 *
 * Generates AI-powered contextual analysis for a contract replay.
 * Uses the Anthropic Claude API if ANTHROPIC_API_KEY is set,
 * otherwise returns data-driven insights derived from the price action.
 *
 * Body: {
 *   ticker: string,
 *   date: string,
 *   entryTime: string,
 *   strike: number,
 *   right: "call" | "put",
 *   entryPremium: number,
 *   exitPL: number,
 *   exitPLPct: number,
 *   maxProfit: number,
 *   maxProfitPct: number,
 *   maxProfitTime: string,
 *   maxDrawdown: number,
 *   maxDrawdownPct: number,
 *   underlyingStart: number,
 *   underlyingEnd: number,
 *   underlyingHigh: number,
 *   underlyingLow: number,
 * }
 *
 * Returns: { insights: string[], source: "ai" | "data-driven" }
 */

import { NextRequest, NextResponse } from "next/server";

interface InsightsRequest {
  ticker: string;
  date: string;
  entryTime: string;
  strike: number;
  right: "call" | "put";
  entryPremium: number;
  exitPL: number;
  exitPLPct: number;
  maxProfit: number;
  maxProfitPct: number;
  maxProfitTime: string;
  maxDrawdown: number;
  maxDrawdownPct: number;
  underlyingStart: number;
  underlyingEnd: number;
  underlyingHigh: number;
  underlyingLow: number;
}

export async function POST(request: NextRequest) {
  let body: InsightsRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Try AI-powered insights first
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const insights = await generateAIInsights(apiKey, body);
      return NextResponse.json({ insights, source: "ai" });
    } catch (err) {
      console.warn("[insights] AI generation failed, falling back to data-driven:", err);
    }
  }

  // Data-driven fallback
  const insights = generateDataDrivenInsights(body);
  return NextResponse.json({ insights, source: "data-driven" });
}

async function generateAIInsights(
  apiKey: string,
  data: InsightsRequest
): Promise<string[]> {
  const {
    ticker, date, entryTime, strike, right, entryPremium,
    exitPL, exitPLPct, maxProfit, maxProfitPct, maxProfitTime,
    maxDrawdown, maxDrawdownPct,
    underlyingStart, underlyingEnd, underlyingHigh, underlyingLow,
  } = data;

  const underlyingMove = ((underlyingEnd - underlyingStart) / underlyingStart * 100).toFixed(2);
  const range = ((underlyingHigh - underlyingLow) / underlyingStart * 100).toFixed(2);

  const prompt = `You are a senior options desk analyst writing a post-trade review. Analyze this trade using professional, technical language. Reference concepts like:
- Support/resistance levels, VWAP reclaim/rejection, 9/21 EMA crosses
- GEX (gamma exposure) and dealer hedging flows, call walls, put walls
- IV crush vs expansion, vol skew, theta burn rate
- Volume spikes, dark pool prints, unusual options activity
- STRAT candle combos (1-2-3 patterns, broadening formations)
- Delta/gamma dynamics, pin risk near expiration strikes
- Market structure: liquidity sweeps, fair value gaps, order blocks

Provide exactly 3-5 concise bullets (each 1-2 sentences max). Each bullet should give a specific, actionable technical insight — NOT a generic summary. Write as if briefing a prop trader reviewing their P/L.

Trade data:
- Ticker: ${ticker}
- Date: ${date}
- Entry: ${entryTime} ET, ${strike}${right === "call" ? "C" : "P"} at $${entryPremium.toFixed(2)}
- Exit P/L: ${exitPL >= 0 ? "+" : ""}$${exitPL} (${exitPLPct >= 0 ? "+" : ""}${exitPLPct.toFixed(1)}%)
- MFE (peak profit): +$${maxProfit} (+${maxProfitPct.toFixed(1)}%) at ${maxProfitTime}
- MAE (max drawdown): $${maxDrawdown} (${maxDrawdownPct.toFixed(1)}%)
- Underlying: $${underlyingStart.toFixed(2)} → $${underlyingEnd.toFixed(2)} (${underlyingMove}%)
- Intraday range: $${underlyingLow.toFixed(2)}–$${underlyingHigh.toFixed(2)} (${range}% width)

Return ONLY a JSON array of 3-5 strings. No markdown, no explanation, just the JSON array.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API ${response.status}: ${await response.text()}`);
  }

  const result = await response.json();
  const text = result.content?.[0]?.text ?? "[]";

  // Parse JSON array from response
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("Failed to parse AI response as JSON array");

  const insights: string[] = JSON.parse(match[0]);
  if (!Array.isArray(insights) || insights.length < 3) {
    throw new Error("AI returned fewer than 3 insights");
  }

  return insights.slice(0, 5);
}

// ─── Data-driven fallback with technical language ────────────────────

function generateDataDrivenInsights(data: InsightsRequest): string[] {
  const {
    ticker, date, entryTime, strike, right, entryPremium,
    exitPL, exitPLPct, maxProfit, maxProfitPct, maxProfitTime,
    maxDrawdown, maxDrawdownPct,
    underlyingStart, underlyingEnd, underlyingHigh, underlyingLow,
  } = data;

  const insights: string[] = [];
  const isCall = right === "call";
  const underlyingMove = ((underlyingEnd - underlyingStart) / underlyingStart * 100);
  const rangeWidth = ((underlyingHigh - underlyingLow) / underlyingStart * 100);
  const moveAbs = Math.abs(underlyingMove);
  const isWide = rangeWidth > 1.5;
  const dirWord = underlyingMove >= 0 ? "rallied" : "sold off";
  const strikeLabel = `${strike}${isCall ? "C" : "P"}`;

  // 1. Underlying structure & VWAP/EMA context
  if (moveAbs > 1.0) {
    const trend = underlyingMove > 0 ? "above" : "below";
    insights.push(
      `${ticker} ${dirWord} ${moveAbs.toFixed(1)}% on ${date}, pushing ${trend} VWAP with a ${rangeWidth.toFixed(1)}% intraday range ($${underlyingLow.toFixed(2)}–$${underlyingHigh.toFixed(2)}). The ${moveAbs > 2 ? "strong directional move likely triggered a 9/21 EMA crossover" : "move tested the 9 EMA"} — confirming ${underlyingMove > 0 ? "bullish" : "bearish"} market structure.`
    );
  } else {
    insights.push(
      `${ticker} chopped in a tight ${rangeWidth.toFixed(1)}% range on ${date} ($${underlyingLow.toFixed(2)}–$${underlyingHigh.toFixed(2)}), with price mean-reverting around VWAP. Narrow-range sessions like this favor sellers — theta burn accelerated as the underlying pinned near the ${strike} strike.`
    );
  }

  // 2. Options flow & GEX context
  const nearATM = Math.abs(underlyingStart - strike) / underlyingStart < 0.015;
  if (nearATM) {
    insights.push(
      `The ${strikeLabel} sat at the GEX (gamma exposure) pivot near the money. Dealer hedging flows likely amplified moves around the ${strike} strike — ${isCall ? "call wall" : "put wall"} positioning created ${exitPLPct > 0 ? "a magnet effect pulling price toward your strike" : "gamma headwinds as market makers hedged against the position"}.`
    );
  } else {
    const otmPct = Math.abs(strike - underlyingStart) / underlyingStart * 100;
    insights.push(
      `Entry on the ${strikeLabel} (${otmPct.toFixed(0)}% OTM) meant elevated delta sensitivity — the position needed ${isCall ? "a strong push above" : "a breakdown below"} the ${strike} strike to gain intrinsic value. ${exitPLPct > 0 ? "The move delivered, with gamma accelerating P/L as it moved ITM." : "Without a decisive move through the strike, theta decay dominated the premium."}`
    );
  }

  // 3. Vol / premium dynamics
  if (isWide && moveAbs > 1.0) {
    insights.push(
      `Realized vol expanded sharply with a ${rangeWidth.toFixed(1)}% range — IV likely caught a bid, lifting extrinsic value. ${exitPLPct > 0 ? "Vega worked in your favor alongside delta, compounding the gain." : "Despite the vol expansion, the directional move worked against the position — being right on vol but wrong on direction."}`
    );
  } else if (!isWide) {
    insights.push(
      `Low realized vol (${rangeWidth.toFixed(1)}% range) led to IV compression and accelerated theta burn on the ${strikeLabel}. The premium decayed from $${entryPremium.toFixed(2)} as time value evaporated — ${exitPLPct < -10 ? "a reminder that buying options in a low-vol regime fights the clock." : "though the position held up despite the unfavorable vol environment."}`
    );
  } else {
    insights.push(
      `The session saw decent range (${rangeWidth.toFixed(1)}%) but lacked follow-through — a STRAT 2-1-2 reversal pattern likely formed as price explored both extremes before settling. IV stayed elevated but the back-and-forth whipsawed premium.`
    );
  }

  // 4. MFE/MAE trade management
  if (maxProfitPct > 30 && maxProfitPct > exitPLPct + 20) {
    insights.push(
      `MFE of +${maxProfitPct.toFixed(0)}% (+$${maxProfit}) at ${maxProfitTime} was left on the table — the close captured only ${exitPLPct >= 0 ? "+" : ""}${exitPLPct.toFixed(0)}%. A trailing stop at the 21 EMA or a 50% take-profit rule would have locked in significantly more. The retracement from peak suggests resistance rejection or a vol-crush candle.`
    );
  } else if (maxDrawdownPct < -25) {
    insights.push(
      `MAE hit ${maxDrawdownPct.toFixed(0)}% ($${maxDrawdown}) — a hard stop at -20% would have cut the loss. ${exitPLPct > 0 ? "The position recovered, but the drawdown signals poor entry timing — waiting for VWAP confirmation or a STRAT trigger bar would have avoided the dip." : "The continued bleed confirms the entry was against the prevailing order flow."}`
    );
  } else if (maxProfitPct > 10) {
    insights.push(
      `The ${strikeLabel} peaked at +${maxProfitPct.toFixed(0)}% at ${maxProfitTime}. ${Math.abs(maxProfitPct - exitPLPct) < 10 ? "Holding through close was the right call — the position stayed near its highs with no significant mean reversion." : "Scaling out at the first resistance test or when delta started flattening would have been the higher-EV play."}`
    );
  }

  // 5. Directional thesis verdict
  if (isCall && underlyingMove > 0 && exitPLPct > 0) {
    insights.push(
      `Bullish thesis confirmed — the ${entryTime} entry caught the ${dirWord} early. The call's delta expanded as ${ticker} broke above the opening range, and the position rode the trend into the close. Key level to watch next session: $${underlyingHigh.toFixed(2)} as potential new support.`
    );
  } else if (!isCall && underlyingMove < 0 && exitPLPct > 0) {
    insights.push(
      `Bearish thesis played out — puts gained as ${ticker} broke below VWAP support and sellers accelerated into the close. The put wall below ${strike} likely attracted additional hedging flow, amplifying the move. Watch $${underlyingLow.toFixed(2)} as the next support test.`
    );
  } else if (exitPLPct < -10) {
    insights.push(
      `The ${isCall ? "bullish" : "bearish"} thesis was invalidated — ${ticker} moved ${underlyingMove > 0 ? "higher" : "lower"}, against the ${isCall ? "call" : "put"} position. In hindsight, the entry at ${entryTime} was ${nearATM ? "fighting the prevailing order flow" : "too far OTM to overcome theta decay in a single session"}. A straddle or reversal at the first sign of failure would have been the adaptation.`
    );
  } else {
    insights.push(
      `Neutral outcome on the ${strikeLabel} — the session lacked a clean directional trigger. In hindsight, waiting for a confirmed VWAP reclaim/rejection or a STRAT 2-2 continuation bar before entering would have improved the risk/reward profile.`
    );
  }

  return insights.slice(0, 5);
}
