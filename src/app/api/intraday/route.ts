/**
 * GET /api/intraday
 *
 * Fetches real intraday price bars from Polygon.io aggregates API.
 *
 * Query parameters:
 *   symbol  (required) — e.g. SPY, AAPL, ES
 *   date    (required) — YYYY-MM-DD
 *
 * Returns: { symbol, date, bars: IntradayBar[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getIntradayBars } from "@/lib/services/polygon";

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
    const bars = await getIntradayBars(symbol, date);
    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      date,
      bars,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const code = (err as Error & { code?: string }).code;

    if (code === "LOOKBACK_EXCEEDED") {
      return NextResponse.json(
        {
          error: "Date exceeds 60-day lookback limit",
          code: "LOOKBACK_EXCEEDED",
          symbol: symbol.toUpperCase(),
          date,
        },
        { status: 422 }
      );
    }

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
