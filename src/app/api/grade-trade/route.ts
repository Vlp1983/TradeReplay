/**
 * POST /api/grade-trade
 *
 * Grades a user's trade: runs the replay, scores it, and generates
 * AI teaching insights with technical analysis language.
 *
 * Body: TradeInput (ticker, date, entryTime, strike, right, entryPremium, exitPremium?, exitTime?)
 * Returns: { grade, replay (sameDayPoints, metrics), insights }
 */

import { NextRequest, NextResponse } from "next/server";
import type { TradeInput } from "@/lib/engine/grading";
import { gradeTrade } from "@/lib/engine/grading";
import { replayContract } from "@/lib/engine/replay";
import type { SelectedContract } from "@/lib/engine/types";

interface GradeRequest {
  ticker: string;
  date: string;
  entryTime: string;
  strike: number;
  right: "call" | "put";
  entryPremium: number;
  exitPremium?: number;
  exitTime?: string;
}

export async function POST(request: NextRequest) {
  let body: GradeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { ticker, date, entryTime, strike, right, entryPremium, exitPremium, exitTime } = body;

  if (!ticker || !date || !entryTime || !strike || !right || !entryPremium) {
    return NextResponse.json(
      { error: "Missing required fields: ticker, date, entryTime, strike, right, entryPremium" },
      { status: 400 }
    );
  }

  // Build contract and run replay
  const contract: SelectedContract = {
    ticker: ticker as SelectedContract["ticker"],
    date,
    entryTime,
    expiration: "0dte",
    strike,
    right,
    entryPremium,
    confidence: "Med",
  };

  const replay = replayContract(contract);

  // Grade the trade
  const tradeInput: TradeInput = {
    ticker, date, entryTime, strike, right, entryPremium, exitPremium, exitTime,
  };

  const grade = gradeTrade(tradeInput, replay.sameDayPoints, replay.metrics);

  // Generate AI teaching insights
  const apiKey = process.env.ANTHROPIC_API_KEY;
  let insights: string[] = [];
  let insightsSource: "ai" | "data-driven" = "data-driven";

  if (apiKey) {
    try {
      insights = await generateAITeachingInsights(apiKey, body, grade, replay.metrics);
      insightsSource = "ai";
    } catch (err) {
      console.warn("[grade-trade] AI insights failed:", err);
      insights = generateDataDrivenTeachingInsights(body, grade, replay.metrics);
    }
  } else {
    insights = generateDataDrivenTeachingInsights(body, grade, replay.metrics);
  }

  return NextResponse.json({
    grade,
    replay: {
      sameDayPoints: replay.sameDayPoints,
      toExpirationPoints: replay.toExpirationPoints,
      metrics: replay.metrics,
      keyMoments: replay.keyMoments,
    },
    insights,
    insightsSource,
  });
}

// ─── AI teaching insights ──────────────────────────────────────────

async function generateAITeachingInsights(
  apiKey: string,
  input: GradeRequest,
  grade: ReturnType<typeof gradeTrade>,
  metrics: ReturnType<typeof replayContract>["metrics"]
): Promise<string[]> {
  const {
    ticker, date, entryTime, strike, right, entryPremium,
    exitPremium, exitTime,
  } = input;

  const actualExit = exitPremium ?? metrics.exitAtClosePL / 100 + entryPremium;
  const actualPLPct = ((actualExit - entryPremium) / entryPremium * 100).toFixed(1);

  const dimSummary = grade.dimensions.map((d) => `${d.label}: ${d.grade} (${d.score}/100) — ${d.detail}`).join("\n");

  const prompt = `You are a senior options trading coach reviewing a student's trade. Write exactly 5 teaching insights as a post-trade debrief. Use professional trading terminology:
- Reference VWAP, 9/21 EMA, 50/200 SMA levels
- Call walls, put walls, GEX (gamma exposure), dealer positioning
- STRAT candle patterns (1-2-3 combos, broadening/narrowing formations)
- Delta/gamma/theta/vega Greeks dynamics
- Support/resistance, volume profile, dark pool levels
- IV rank, vol skew, theta burn rate
- MFE/MAE trade management

Each bullet should be 2-3 sentences. Be specific about what the trader should have done differently and what indicators would have signaled the right move. This is a TEACHING tool — explain concepts clearly while using pro terminology.

Trade data:
- ${ticker} ${strike}${right === "call" ? "C" : "P"} on ${date}
- Entry: ${entryTime} ET at $${entryPremium.toFixed(2)}
- Exit: ${exitTime ?? "Close"} at $${actualExit.toFixed(2)} (${actualPLPct}%)
- MFE: +${metrics.maxProfitPct.toFixed(1)}% at ${metrics.maxProfitTime}
- MAE: ${metrics.maxDrawdownPct.toFixed(1)}% at ${metrics.maxDrawdownTime}
- Overall grade: ${grade.letterGrade} (${grade.overall}/100)

Dimension scores:
${dimSummary}

Return ONLY a JSON array of exactly 5 strings. No markdown, no explanation.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API ${response.status}`);
  }

  const result = await response.json();
  const text = result.content?.[0]?.text ?? "[]";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("Failed to parse AI response");

  const insights: string[] = JSON.parse(match[0]);
  return insights.slice(0, 5);
}

// ─── Data-driven teaching fallback ──────────────────────────────────

function generateDataDrivenTeachingInsights(
  input: GradeRequest,
  grade: ReturnType<typeof gradeTrade>,
  metrics: ReturnType<typeof replayContract>["metrics"]
): string[] {
  const insights: string[] = [];
  const isCall = input.right === "call";
  const strikeLabel = `${input.strike}${isCall ? "C" : "P"}`;
  const actualExit = input.exitPremium ?? metrics.exitAtClosePL / 100 + input.entryPremium;
  const actualPLPct = (actualExit - input.entryPremium) / input.entryPremium * 100;

  // Find weakest dimension
  const dims = grade.dimensions;
  const weakest = dims.reduce((a, b) => (a.score < b.score ? a : b));
  const strongest = dims.reduce((a, b) => (a.score > b.score ? a : b));

  // 1. Entry analysis
  const entryDim = dims.find((d) => d.label === "Entry Timing")!;
  if (entryDim.score < 70) {
    insights.push(
      `Entry timing scored ${entryDim.grade} (${entryDim.score}/100). For the ${strikeLabel}, waiting for VWAP confirmation — price reclaiming VWAP from below for calls, or rejecting VWAP from above for puts — would have improved the entry by reducing premium paid. A STRAT 2-1 reversal bar on the 5-minute chart near ${input.entryTime} would have been the ideal trigger.`
    );
  } else {
    insights.push(
      `Strong entry at ${input.entryTime} — the ${strikeLabel} premium was near the session's low before the directional move began. The 9 EMA crossing above the 21 EMA on the 5-minute chart likely confirmed the entry window. ${entryDim.grade} on entry timing.`
    );
  }

  // 2. Exit analysis
  const exitDim = dims.find((d) => d.label === "Exit Timing")!;
  if (metrics.maxProfitPct > 20 && actualPLPct < metrics.maxProfitPct * 0.5) {
    insights.push(
      `MFE of +${metrics.maxProfitPct.toFixed(0)}% was reached at ${metrics.maxProfitTime}, but only ${actualPLPct.toFixed(0)}% was captured at exit. A trailing stop anchored to the 9 EMA on the 1-minute chart, or a 50% take-profit rule, would have locked in gains near the peak. When gamma is high on 0DTE, profits evaporate quickly — don't wait for the "perfect" exit.`
    );
  } else if (exitDim.score >= 80) {
    insights.push(
      `Exit timing was solid (${exitDim.grade}) — you captured a good portion of the available move. The key was recognizing when delta started flattening near the strike's resistance zone. On future trades, watch for the 9 EMA rolling over on the 1-min chart as an early exit signal.`
    );
  } else {
    insights.push(
      `Exit scored ${exitDim.grade}. The optimal exit window was near ${metrics.maxProfitTime} when the ${isCall ? "call" : "put"}'s gamma was peaking. Technical indicators to watch: price rejection at VWAP upper band, RSI divergence on the 5-minute, or a STRAT 2-2 reversal candle — any of these would have signaled the momentum shift.`
    );
  }

  // 3. Risk management lesson
  const riskDim = dims.find((d) => d.label === "Risk Management")!;
  if (riskDim.score < 60) {
    insights.push(
      `Risk management needs work (${riskDim.grade}). The position saw ${metrics.maxDrawdownPct.toFixed(0)}% drawdown — on a 0DTE ${strikeLabel}, a hard stop at -20% or 2x the entry premium protects capital. Consider sizing based on the options' theta decay rate: if theta > 10% of premium per hour, tighten stops. The GEX flip zone near the ${input.strike} strike likely amplified the drawdown as dealers hedged against you.`
    );
  } else {
    insights.push(
      `Solid risk control (${riskDim.grade}) — drawdown stayed manageable at ${metrics.maxDrawdownPct.toFixed(0)}%. To refine further, use the put wall below your strike as a natural stop level. If the underlying breaks below dealer support (visible on GEX charts), that's the signal to cut the position immediately rather than waiting for a premium-based stop.`
    );
  }

  // 4. What would have helped
  insights.push(
    `Key indicators that would have improved this trade: (1) Check the GEX profile before entry — the ${input.strike} strike's call wall / put wall positioning tells you where dealers will hedge for or against you. (2) Use the volume profile's Point of Control (POC) as a decision level — entries near POC have better risk/reward. (3) On 0DTE, theta accelerates after 2:00 PM ET — if your trade isn't working by then, cut it.`
  );

  // 5. Overall takeaway
  if (grade.overall >= 80) {
    insights.push(
      `Overall ${grade.letterGrade} — this was a well-executed trade. Your strongest dimension was ${strongest.label} (${strongest.grade}). To push into A territory, focus on ${weakest.label} (${weakest.grade}): ${weakest.detail} Small improvements in your weakest area compound over hundreds of trades into significantly better P/L.`
    );
  } else if (grade.overall >= 60) {
    insights.push(
      `${grade.letterGrade} trade — the thesis was reasonable but execution left money on the table. The biggest area for improvement is ${weakest.label} (${weakest.grade}). On the next similar setup, consider: (1) confirming direction with the STRAT combo before entering, (2) having a predefined exit plan (50% TP / -20% stop), and (3) watching the 9/21 EMA cross for timing.`
    );
  } else {
    insights.push(
      `${grade.letterGrade} trade — a learning opportunity. The main issue was ${weakest.label} (${weakest.grade}): ${weakest.detail} Before taking the next trade, ask yourself: Does the STRAT setup confirm? Is VWAP supporting the thesis? Is GEX positioning favorable? If all three align, you have a high-probability entry. If not, sit on your hands.`
    );
  }

  return insights.slice(0, 5);
}
