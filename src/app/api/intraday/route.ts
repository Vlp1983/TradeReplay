/**
 * GET /api/intraday
 *
 * Fetches real intraday price bars from Yahoo Finance chart API.
 *
 * Query parameters:
 *   symbol  (required) — e.g. SPY, AAPL, BTC-USD, ES=F
 *   date    (required) — YYYY-MM-DD
 *
 * Returns: { symbol, date, bars: IntradayBar[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getIntradayChart } from "@/lib/services/yahoo-finance";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const date = searchParams.get("date");

  if (!symbol) {
    return NextResponse.json(
      { error: "Missing required parameter: symbol" },
      { status: 400 }
    );
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Missing or invalid parameter: date (must be YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  try {
    const bars = await getIntradayChart(symbol, date);
    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      date,
      bars,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to fetch intraday data",
        symbol: symbol.toUpperCase(),
        date,
        details: message,
      },
      { status: 500 }
    );
  }
}
