/**
 * GET /api/options
 *
 * Fetches real options data from Yahoo Finance and returns it
 * normalized for the dual-confirmation backtesting engine.
 *
 * Query parameters:
 *   symbol      (required)  — e.g. SPY, QQQ, AAPL, BTCUSD
 *   expiration  (optional)  — YYYY-MM-DD, defaults to nearest
 *   strike      (optional)  — filter to a single strike
 *   right       (optional)  — "call" or "put"
 *
 * Examples:
 *   /api/options?symbol=SPY
 *   /api/options?symbol=SPY&expiration=2026-03-20
 *   /api/options?symbol=SPY&expiration=2026-03-20&strike=520&right=call
 */

import { NextRequest, NextResponse } from "next/server";
import {
  fetchNormalizedChain,
  getExpirations,
  getContract,
} from "@/lib/services/yahoo-finance";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const expiration = searchParams.get("expiration") ?? undefined;
  const strikeParam = searchParams.get("strike");
  const rightParam = searchParams.get("right") as "call" | "put" | null;

  // ── Validate required params ──────────────────────────────────────
  if (!symbol) {
    return NextResponse.json(
      { error: "Missing required parameter: symbol" },
      { status: 400 }
    );
  }

  // ── Validate optional params ──────────────────────────────────────
  if (rightParam && rightParam !== "call" && rightParam !== "put") {
    return NextResponse.json(
      { error: "Parameter 'right' must be 'call' or 'put'" },
      { status: 400 }
    );
  }

  if (strikeParam && isNaN(Number(strikeParam))) {
    return NextResponse.json(
      { error: "Parameter 'strike' must be a number" },
      { status: 400 }
    );
  }

  try {
    // ── Single contract lookup ────────────────────────────────────
    if (strikeParam && expiration && rightParam) {
      const contract = await getContract(
        symbol,
        expiration,
        Number(strikeParam),
        rightParam
      );

      if (!contract) {
        return NextResponse.json(
          {
            error: "Contract not found",
            symbol: symbol.toUpperCase(),
            details: `No ${rightParam} at strike ${strikeParam} for ${expiration}`,
          },
          { status: 404 }
        );
      }

      return NextResponse.json({ contract });
    }

    // ── Expirations-only request (no expiration param) ────────────
    if (!expiration && !strikeParam && !rightParam) {
      // Return full chain for nearest expiration + list of all expirations
      const [chain, summary] = await Promise.all([
        fetchNormalizedChain(symbol),
        getExpirations(symbol),
      ]);

      return NextResponse.json({
        ...chain,
        availableExpirations: summary.expirations,
      });
    }

    // ── Full chain for specific expiration ─────────────────────────
    const chain = await fetchNormalizedChain(symbol, expiration);

    // Optionally filter by right
    if (rightParam) {
      const filtered = {
        ...chain,
        calls: rightParam === "call" ? chain.calls : [],
        puts: rightParam === "put" ? chain.puts : [],
      };
      return NextResponse.json(filtered);
    }

    return NextResponse.json(chain);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error";

    // Detect common failure modes
    if (message.includes("Not Found") || message.includes("no data")) {
      return NextResponse.json(
        {
          error: "Symbol not found",
          symbol: symbol.toUpperCase(),
          details: message,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to fetch options data",
        symbol: symbol.toUpperCase(),
        details: message,
      },
      { status: 500 }
    );
  }
}
