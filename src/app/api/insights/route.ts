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

  const {
    ticker, date, entryTime, strike, right, entryPremium,
    exitPL, exitPLPct, maxProfit, maxProfitPct, maxProfitTime,
    maxDrawdown, maxDrawdownPct,
    underlyingStart, underlyingEnd, underlyingHigh, underlyingLow,
  } = body;

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

  const prompt = `You are a professional options trading analyst. Based on the following trade data, provide exactly 3-5 concise insight bullets (each 1-2 sentences) that explain what happened and why. Focus on:
- What drove the underlying price action that day
- How the options pricing responded (premium, IV, theta)
- Whether this was a good or bad entry and why
- What a trader could learn from this outcome

Trade data:
- Ticker: ${ticker}
- Date: ${date}
- Entry time: ${entryTime} ET
- Contract: ${strike}${right === "call" ? "C" : "P"}
- Entry premium: $${entryPremium.toFixed(2)}
- Exit P/L: ${exitPL >= 0 ? "+" : ""}$${exitPL} (${exitPLPct >= 0 ? "+" : ""}${exitPLPct.toFixed(1)}%)
- Max profit: +$${maxProfit} (+${maxProfitPct.toFixed(1)}%) at ${maxProfitTime}
- Max drawdown: $${maxDrawdown} (${maxDrawdownPct.toFixed(1)}%)
- Underlying: $${underlyingStart.toFixed(2)} → $${underlyingEnd.toFixed(2)} (${underlyingMove}% move)
- Intraday range: $${underlyingLow.toFixed(2)} to $${underlyingHigh.toFixed(2)} (${range}% range)

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
  const direction = underlyingMove >= 0 ? "higher" : "lower";
  const directionWord = underlyingMove >= 0 ? "rallied" : "sold off";

  // 1. Underlying movement summary
  insights.push(
    `${ticker} ${directionWord} ${Math.abs(underlyingMove).toFixed(1)}% on ${date}, moving from $${underlyingStart.toFixed(2)} to $${underlyingEnd.toFixed(2)} with an intraday range of ${rangeWidth.toFixed(1)}%.`
  );

  // 2. Contract outcome
  if (exitPLPct >= 20) {
    insights.push(
      `The ${strike}${isCall ? "C" : "P"} entered at $${entryPremium.toFixed(2)} finished profitable at ${exitPLPct >= 0 ? "+" : ""}${exitPLPct.toFixed(0)}% ($${exitPL} per contract). The underlying moving ${direction} ${isCall ? "favored" : "worked against"} this ${isCall ? "call" : "put"} position.`
    );
  } else if (exitPLPct <= -20) {
    insights.push(
      `The ${strike}${isCall ? "C" : "P"} lost ${Math.abs(exitPLPct).toFixed(0)}% ($${Math.abs(exitPL)} per contract). ${isCall ? "Calls struggled" : "Puts suffered"} as the underlying moved ${direction}, ${isCall ? (underlyingMove < 0 ? "opposite to the bullish thesis." : "but not enough to overcome theta decay.") : (underlyingMove > 0 ? "opposite to the bearish thesis." : "but not enough to overcome theta decay.")}`
    );
  } else {
    insights.push(
      `The ${strike}${isCall ? "C" : "P"} finished near breakeven at ${exitPLPct >= 0 ? "+" : ""}${exitPLPct.toFixed(0)}% — the underlying's ${Math.abs(underlyingMove).toFixed(1)}% move was not decisive enough to produce a clear winner.`
    );
  }

  // 3. Optimal exit analysis
  if (maxProfitPct > 30 && maxProfitPct > exitPLPct + 20) {
    insights.push(
      `Peak profit of +${maxProfitPct.toFixed(0)}% (+$${maxProfit}) was reached at ${maxProfitTime}. A take-profit at 50% or trailing stop would have captured significantly more than the ${exitPLPct >= 0 ? "+" : ""}${exitPLPct.toFixed(0)}% closing result.`
    );
  } else if (maxProfitPct > 10) {
    insights.push(
      `The contract peaked at +${maxProfitPct.toFixed(0)}% at ${maxProfitTime}. ${maxProfitPct - exitPLPct < 10 ? "Holding through close captured most of the move." : "An earlier exit would have improved returns."}`
    );
  }

  // 4. Drawdown warning
  if (maxDrawdownPct < -25) {
    insights.push(
      `Maximum drawdown hit ${maxDrawdownPct.toFixed(0)}% ($${maxDrawdown}) — a stop-loss at -20% would have limited damage. ${exitPLPct > 0 ? "The position recovered, but the ride was rough." : "The loss worsened from there, reinforcing the importance of risk management."}`
    );
  }

  // 5. Strategy takeaway
  if (isCall && underlyingMove > 0 && exitPLPct > 0) {
    insights.push(
      `Directional bias was correct — entering a call when the underlying was trending ${direction} validated the thesis. Key learning: timing the entry near ${entryTime} captured the move well.`
    );
  } else if (!isCall && underlyingMove < 0 && exitPLPct > 0) {
    insights.push(
      `The bearish put thesis played out as expected with the underlying declining. Entry timing at ${entryTime} allowed the position to benefit from the sell-off.`
    );
  } else if (rangeWidth > 1.5) {
    insights.push(
      `High intraday volatility (${rangeWidth.toFixed(1)}% range) created opportunities on both sides. In choppy sessions like this, shorter holding periods and tighter stops tend to outperform.`
    );
  } else {
    insights.push(
      `Low volatility (${rangeWidth.toFixed(1)}% range) compressed option premiums through theta decay. In compressed-range sessions, selling premium tends to outperform buying.`
    );
  }

  return insights.slice(0, 5);
}
