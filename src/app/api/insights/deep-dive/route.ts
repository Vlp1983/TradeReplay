/**
 * POST /api/insights/deep-dive
 *
 * Deep Dive analysis — fetches context from Polygon, Finnhub, and Alpha Vantage,
 * then generates a structured analysis via Claude API.
 */

import { NextRequest, NextResponse } from "next/server";

interface DeepDiveRequest {
  ticker: string;
  date: string;
  strike: number;
  expiration: string;
  direction: "call" | "put";
  entryTime: string;
  pnl: number;
  entryPremium: number;
  exitPremium: number;
  strategy: string;
}

interface DeepDiveResponse {
  summary: string;
  bullets: string[];
  catalysts: string[];
  earningsContext: string;
  technicalContext: string;
  strategyNote: string;
  sentiment: "bullish" | "bearish" | "neutral" | "mixed";
  confidence: "high" | "medium" | "low";
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

async function fetchPolygonNews(
  ticker: string,
  date: string
): Promise<string[]> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return [];

  try {
    const from = addDays(date, -2);
    const to = addDays(date, 1);
    const url = `https://api.polygon.io/v2/reference/news?ticker=${ticker}&published_utc.gte=${from}&published_utc.lte=${to}&limit=5&apiKey=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map(
      (r: { title?: string }) => r.title ?? ""
    ).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchFinnhubEarnings(
  ticker: string,
  date: string
): Promise<{ date?: string; symbol?: string }[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return [];

  try {
    const from = addDays(date, -7);
    const to = addDays(date, 7);
    const url = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&symbol=${ticker}&token=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.earningsCalendar ?? [];
  } catch {
    return [];
  }
}

async function fetchAlphaVantageSentiment(
  ticker: string,
  date: string
): Promise<string[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return [];

  try {
    const timeFrom = `${date.replace(/-/g, "")}T0000`;
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${ticker}&time_from=${timeFrom}&limit=5&apikey=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.feed ?? []).map(
      (item: { title?: string }) => item.title ?? ""
    ).filter(Boolean);
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  let body: DeepDiveRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    ticker, date, strike, expiration, direction,
    entryTime, pnl, entryPremium, exitPremium, strategy,
  } = body;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 503 }
    );
  }

  // Fetch all external data in parallel
  const [newsHeadlines, earningsData, sentimentHeadlines] = await Promise.all([
    fetchPolygonNews(ticker, date),
    fetchFinnhubEarnings(ticker, date),
    fetchAlphaVantageSentiment(ticker, date),
  ]);

  const allHeadlines = Array.from(new Set([...newsHeadlines, ...sentimentHeadlines]));
  const earningsNearby = earningsData.length > 0
    ? earningsData.map((e) => `${e.symbol ?? ticker} earnings on ${e.date ?? "unknown date"}`).join("; ")
    : "No earnings events found within +/- 7 days.";

  const userPrompt = `Analyze this options trade:

Ticker: ${ticker}
Date: ${date}
Direction: ${direction.toUpperCase()}
Strike: ${strike}
Expiration: ${expiration}
Entry Time: ${entryTime} ET
Entry Premium: $${entryPremium.toFixed(2)}
Exit Premium: $${exitPremium.toFixed(2)}
P&L: $${pnl.toFixed(2)} per contract

Nearby News Headlines:
${allHeadlines.length > 0 ? allHeadlines.map((h) => `- ${h}`).join("\n") : "- No news found"}

Earnings Proximity:
${earningsNearby}

Strategy Filter: ${strategy}

Return this exact JSON structure:
{
  "summary": "2-3 sentence plain English overview of what drove this move",
  "bullets": ["bullet 1", "bullet 2", "bullet 3", "bullet 4", "bullet 5", "bullet 6"],
  "catalysts": ["event or news item 1", "event or news item 2"],
  "earningsContext": "string — was there an earnings event nearby? When?",
  "technicalContext": "string — what the broader market or sector was doing",
  "strategyNote": "string — analysis specifically framed through the ${strategy} lens",
  "sentiment": "bullish | bearish | neutral | mixed",
  "confidence": "high | medium | low"
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: "You are a professional options trade analyst. Analyze the provided trade data and market context. Return ONLY valid JSON with no preamble, no markdown, no backticks.",
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Claude API error ${response.status}:`, errText);
      return NextResponse.json(
        { error: "AI analysis failed" },
        { status: 502 }
      );
    }

    const result = await response.json();
    const text = result.content?.[0]?.text ?? "";

    // Parse JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 502 }
      );
    }

    const analysis: DeepDiveResponse = JSON.parse(jsonMatch[0]);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Deep dive analysis error:", error);
    return NextResponse.json(
      { error: "Analysis failed" },
      { status: 500 }
    );
  }
}
