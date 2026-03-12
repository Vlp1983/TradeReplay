/**
 * GET /api/test-polygon
 *
 * Diagnostic route that tests the Polygon API connection.
 * Makes three raw fetch calls and returns all results + errors.
 */

import { NextResponse } from "next/server";

const POLYGON_BASE = "https://api.polygon.io";

interface TestResult {
  status: number;
  resultsCount: number;
  firstBar: unknown;
}

async function runTest(path: string, key: string): Promise<TestResult> {
  const url = `${POLYGON_BASE}${path}&apiKey=${key}`;
  const res = await fetch(url);
  const data = await res.json();
  return {
    status: res.status,
    resultsCount: Array.isArray(data.results) ? data.results.length : 0,
    firstBar: Array.isArray(data.results) && data.results.length > 0 ? data.results[0] : null,
  };
}

export async function GET() {
  const polygonKey = process.env.POLYGON_API_KEY;
  const publicKey = process.env.NEXT_PUBLIC_POLYGON_API_KEY;

  const keyName = polygonKey
    ? "POLYGON_API_KEY"
    : publicKey
      ? "NEXT_PUBLIC_POLYGON_API_KEY"
      : "NONE";
  const key = polygonKey ?? publicKey ?? "";
  const envKeyFound = key.length > 0;

  console.log(`[test-polygon] Key source: ${keyName}, found: ${envKeyFound}, length: ${key.length}`);

  if (!envKeyFound) {
    return NextResponse.json({
      envKeyFound: false,
      keyName,
      testA: null,
      testB: null,
      testC: null,
      rawErrors: "No Polygon API key found in environment variables",
    });
  }

  const rawErrors: unknown[] = [];
  let testA: TestResult | null = null;
  let testB: TestResult | null = null;
  let testC: TestResult | null = null;

  // Test A — Recent daily bars for SPY
  try {
    testA = await runTest(
      "/v2/aggs/ticker/SPY/range/1/day/2026-02-01/2026-03-01?adjusted=true&sort=asc",
      key
    );
    console.log("[test-polygon] Test A (SPY daily):", testA);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    rawErrors.push({ test: "A", error: msg });
    console.error("[test-polygon] Test A error:", msg);
  }

  // Test B — Intraday bars for SPY on 2026-03-10
  try {
    testB = await runTest(
      "/v2/aggs/ticker/SPY/range/5/minute/2026-03-10/2026-03-10?adjusted=true&sort=asc&limit=500",
      key
    );
    console.log("[test-polygon] Test B (SPY intraday):", testB);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    rawErrors.push({ test: "B", error: msg });
    console.error("[test-polygon] Test B error:", msg);
  }

  // Test C — VIX daily
  try {
    testC = await runTest(
      "/v2/aggs/ticker/I:VIX/range/1/day/2026-03-01/2026-03-10?adjusted=true&sort=asc",
      key
    );
    console.log("[test-polygon] Test C (VIX daily):", testC);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    rawErrors.push({ test: "C", error: msg });
    console.error("[test-polygon] Test C error:", msg);
  }

  return NextResponse.json({
    envKeyFound,
    keyName,
    testA,
    testB,
    testC,
    rawErrors: rawErrors.length > 0 ? rawErrors : null,
  });
}
