/**
 * POST /api/pricing
 *
 * Server-side wrapper for the synthetic pricing engine.
 * Accepts ticker, replayDate, strike, expiry, optionType
 * and returns the full OptionPricingResult.
 *
 * Dates are serialized as ISO strings in JSON and reconstructed here.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateOptionPricing } from "@/lib/pricing";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticker, replayDate, strike, expiry, optionType } = body;

    if (!ticker || !replayDate || strike == null || !expiry || !optionType) {
      return NextResponse.json(
        { error: "Missing required fields: ticker, replayDate, strike, expiry, optionType" },
        { status: 400 }
      );
    }

    // optionType
    if (optionType !== "call" && optionType !== "put") {
      return NextResponse.json({ error: "Invalid optionType" }, { status: 400 });
    }

    // strike
    const strikeNum = Number(strike);
    if (isNaN(strikeNum) || strikeNum < 0) {
      return NextResponse.json({ error: "Invalid strike" }, { status: 400 });
    }

    // ticker — only allow alphanumeric and dot, max 10 chars
    if (!/^[A-Z0-9.]{1,10}$/.test(String(ticker).toUpperCase())) {
      return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
    }

    // replayDate and expiry
    const parsedReplayDate = new Date(replayDate);
    const parsedExpiry = new Date(expiry);
    if (isNaN(parsedReplayDate.getTime()) || isNaN(parsedExpiry.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }

    const result = await generateOptionPricing({
      ticker,
      replayDate: parsedReplayDate,
      strike: strikeNum,
      expiry: parsedExpiry,
      optionType,
    });

    // Serialize Expiry dates to ISO strings for JSON transport
    const serialized = {
      ...result,
      expiries: result.expiries.map((e) => ({
        ...e,
        date: e.date.toISOString(),
      })),
    };

    return NextResponse.json(serialized, {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("[/api/pricing] Error:", err);
    return NextResponse.json(
      { error: "Pricing unavailable. Please try again." },
      { status: 500 }
    );
  }
}
