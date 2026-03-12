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

    const result = await generateOptionPricing({
      ticker,
      replayDate: new Date(replayDate),
      strike: Number(strike),
      expiry: new Date(expiry),
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

    return NextResponse.json(serialized);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/pricing] Error:", message);
    return NextResponse.json(
      { error: "Pricing engine failed", details: message },
      { status: 500 }
    );
  }
}
