/**
 * POST /api/parse-trade
 *
 * Parses trade details from free-text or a broker screenshot.
 * Uses Claude vision API for images, text parsing for free-text.
 *
 * Body (JSON): { text: string } — free-text trade description
 * Body (FormData): file (image) — broker screenshot
 *
 * Returns: { parsed: TradeInput, confidence: "high" | "medium" | "low" }
 */

import { NextRequest, NextResponse } from "next/server";

interface ParsedTrade {
  ticker?: string;
  date?: string;
  entryTime?: string;
  strike?: number;
  right?: "call" | "put";
  entryPremium?: number;
  exitPremium?: number;
  exitTime?: string;
}

interface ParseResult {
  parsed: ParsedTrade;
  confidence: "high" | "medium" | "low";
  missingFields: string[];
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      return await handleScreenshot(request);
    } else {
      return await handleFreeText(request);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to parse trade", details: message },
      { status: 500 }
    );
  }
}

// ─── Free-text parsing ──────────────────────────────────────────────

async function handleFreeText(request: NextRequest): Promise<NextResponse> {
  const { text } = await request.json();
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Missing text field" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    return await parseWithAI(apiKey, text);
  }

  // Regex fallback
  const parsed = parseWithRegex(text);
  return NextResponse.json(parsed);
}

// ─── Screenshot parsing ─────────────────────────────────────────────

async function handleScreenshot(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Screenshot parsing requires ANTHROPIC_API_KEY" },
      { status: 501 }
    );
  }

  // Convert file to base64
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mediaType = file.type || "image/png";

  const prompt = `Analyze this broker screenshot and extract trade details. Return a JSON object with these fields (use null for any field you can't determine):

{
  "ticker": "SPY",          // stock/ETF/futures symbol
  "date": "2025-02-20",     // YYYY-MM-DD
  "entryTime": "10:30",     // HH:MM in ET (24-hour)
  "strike": 595,            // options strike price (number)
  "right": "call",          // "call" or "put"
  "entryPremium": 2.45,     // premium paid per contract (number)
  "exitPremium": 3.10,      // premium received at exit (number, null if not shown)
  "exitTime": "11:45"       // HH:MM in ET (null if not shown)
}

IMPORTANT: Return ONLY the JSON object. No markdown, no explanation.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          { type: "text", text: prompt },
        ],
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API ${response.status}`);
  }

  const result = await response.json();
  const text = result.content?.[0]?.text ?? "{}";

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Failed to parse AI response");

  const raw = JSON.parse(match[0]);
  const parsed = cleanParsed(raw);
  const missingFields = getMissingFields(parsed);
  const confidence = missingFields.length === 0 ? "high" : missingFields.length <= 2 ? "medium" : "low";

  return NextResponse.json({ parsed, confidence, missingFields });
}

// ─── AI text parsing ────────────────────────────────────────────────

async function parseWithAI(apiKey: string, text: string): Promise<NextResponse> {
  const prompt = `Parse this trade description and extract details. Return a JSON object with these fields (use null for any field you can't determine):

{
  "ticker": "SPY",
  "date": "2025-02-20",
  "entryTime": "10:30",
  "strike": 595,
  "right": "call",
  "entryPremium": 2.45,
  "exitPremium": 3.10,
  "exitTime": "11:45"
}

Trade description: "${text}"

Return ONLY the JSON object. No markdown.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API ${response.status}`);
  }

  const result = await response.json();
  const responseText = result.content?.[0]?.text ?? "{}";
  const match = responseText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Failed to parse AI response");

  const raw = JSON.parse(match[0]);
  const parsed = cleanParsed(raw);
  const missingFields = getMissingFields(parsed);
  const confidence = missingFields.length === 0 ? "high" : missingFields.length <= 2 ? "medium" : "low";

  return NextResponse.json({ parsed, confidence, missingFields });
}

// ─── Regex fallback ─────────────────────────────────────────────────

function parseWithRegex(text: string): ParseResult {
  const parsed: ParsedTrade = {};

  // Ticker — common pattern: bought/sold TSLA, or TSLA 595C
  const tickerMatch = text.match(/\b(SPY|QQQ|AAPL|TSLA|NVDA|AMZN|ES|NQ|CL|GC|SI|BTC|ETH|SOL|DOGE|XRP)\b/i);
  if (tickerMatch) parsed.ticker = tickerMatch[1].toUpperCase();

  // Strike + right — pattern: 595C, 595P, 595 call, 595 put
  const strikeMatch = text.match(/(\d{1,6}(?:\.\d{1,2})?)\s*([CP]|calls?|puts?)/i);
  if (strikeMatch) {
    parsed.strike = parseFloat(strikeMatch[1]);
    const r = strikeMatch[2].toLowerCase();
    parsed.right = r.startsWith("c") ? "call" : "put";
  }

  // Date — various formats
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/) ??
                     text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    if (dateMatch[0].startsWith("20")) {
      parsed.date = dateMatch[0];
    } else {
      const year = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
      parsed.date = `${year}-${dateMatch[1].padStart(2, "0")}-${dateMatch[2].padStart(2, "0")}`;
    }
  }

  // Premium — $2.45 or 2.45
  const premiumMatches = text.match(/\$?(\d{1,4}\.\d{1,2})/g);
  if (premiumMatches && premiumMatches.length >= 1) {
    parsed.entryPremium = parseFloat(premiumMatches[0].replace("$", ""));
    if (premiumMatches.length >= 2) {
      parsed.exitPremium = parseFloat(premiumMatches[1].replace("$", ""));
    }
  }

  // Time — 10:30, 10:30am, 10:30 AM
  const timeMatches = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/g);
  if (timeMatches && timeMatches.length >= 1) {
    parsed.entryTime = to24Hour(timeMatches[0]);
    if (timeMatches.length >= 2) {
      parsed.exitTime = to24Hour(timeMatches[1]);
    }
  }

  const missingFields = getMissingFields(parsed);
  const confidence = missingFields.length === 0 ? "high" : missingFields.length <= 2 ? "medium" : "low";

  return { parsed, confidence, missingFields };
}

// ─── Helpers ────────────────────────────────────────────────────────

function cleanParsed(raw: Record<string, unknown>): ParsedTrade {
  return {
    ticker: typeof raw.ticker === "string" ? raw.ticker.toUpperCase() : undefined,
    date: typeof raw.date === "string" ? raw.date : undefined,
    entryTime: typeof raw.entryTime === "string" ? raw.entryTime : undefined,
    strike: typeof raw.strike === "number" ? raw.strike : undefined,
    right: raw.right === "call" || raw.right === "put" ? raw.right : undefined,
    entryPremium: typeof raw.entryPremium === "number" ? raw.entryPremium : undefined,
    exitPremium: typeof raw.exitPremium === "number" ? raw.exitPremium : undefined,
    exitTime: typeof raw.exitTime === "string" ? raw.exitTime : undefined,
  };
}

function getMissingFields(parsed: ParsedTrade): string[] {
  const required: (keyof ParsedTrade)[] = ["ticker", "date", "entryTime", "strike", "right", "entryPremium"];
  return required.filter((k) => parsed[k] == null);
}

function to24Hour(time: string): string {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/);
  if (!match) return time;
  let h = parseInt(match[1]);
  const m = match[2];
  const period = match[3]?.toUpperCase();
  if (period === "PM" && h < 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return `${h.toString().padStart(2, "0")}:${m}`;
}
