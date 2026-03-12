/**
 * GET /api/historical-price
 *
 * Fetches the historical closing price of an underlying on a specific date.
 *
 * Query parameters:
 *   symbol  (required)  — e.g. SPY, QQQ, AAPL
 *   date    (required)  — YYYY-MM-DD
 */

import { NextRequest, NextResponse } from "next/server";
import { getHistoricalPrice } from "@/lib/services/polygon";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const date = searchParams.get("date");

  if (!symbol || !date) {
    return NextResponse.json(
      { error: "Missing required parameters: symbol, date" },
      { status: 400 }
    );
  }

  try {
    const price = await getHistoricalPrice(symbol, date);
    if (price === null) {
      return NextResponse.json(
        { error: "No price data available", symbol: symbol.toUpperCase(), date },
        { status: 404 }
      );
    }
    return NextResponse.json({ symbol: symbol.toUpperCase(), date, price });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch historical price", details: message },
      { status: 500 }
    );
  }
}
