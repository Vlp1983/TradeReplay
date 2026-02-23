/**
 * Trade grading engine — scores a user's trade across 5 dimensions
 * and produces an overall letter grade.
 *
 * Dimensions:
 *  1. Entry Timing   — proximity to optimal entry relative to the day's move
 *  2. Exit Timing    — how well the exit captured the move (vs holding to close)
 *  3. Risk Mgmt      — MAE exposure, drawdown relative to premium paid
 *  4. Direction       — was the call/put thesis correct given underlying move
 *  5. Profit Capture  — what % of MFE was actually realized
 */

import type { TimePoint, ReplayMetrics } from "./types";

// ─── Types ──────────────────────────────────────────────────────────

export interface TradeInput {
  ticker: string;
  date: string;
  entryTime: string;
  strike: number;
  right: "call" | "put";
  entryPremium: number;
  exitPremium?: number;   // optional — if absent, we assume held to close
  exitTime?: string;      // optional
}

export interface DimensionScore {
  label: string;
  score: number;       // 0-100
  grade: string;       // A+ to F
  detail: string;      // one-line explanation
}

export interface TradeGrade {
  overall: number;        // 0-100 weighted average
  letterGrade: string;    // A+ to F
  dimensions: DimensionScore[];
  summary: string;        // one-line headline
}

// ─── Grading constants ──────────────────────────────────────────────

const WEIGHTS = {
  entryTiming: 0.20,
  exitTiming: 0.25,
  riskMgmt: 0.20,
  direction: 0.15,
  profitCapture: 0.20,
};

// ─── Letter grade conversion ────────────────────────────────────────

function toLetterGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}

// ─── Core grading function ──────────────────────────────────────────

export function gradeTrade(
  input: TradeInput,
  points: TimePoint[],
  metrics: ReplayMetrics
): TradeGrade {
  if (points.length < 3) {
    return {
      overall: 50,
      letterGrade: "F",
      dimensions: [],
      summary: "Insufficient data to grade this trade.",
    };
  }

  const isCall = input.right === "call";
  const entryPremium = input.entryPremium;
  const exitPremium = input.exitPremium ?? points[points.length - 1].price;
  const actualPL = (exitPremium - entryPremium) * 100;
  const actualPLPct = ((exitPremium - entryPremium) / entryPremium) * 100;

  // Find the user's exit point index (if exitTime provided)
  let exitIdx = points.length - 1;
  if (input.exitTime) {
    const exitMin = parseTimeMinutes(input.exitTime);
    for (let i = 0; i < points.length; i++) {
      if (parseTimeMinutes(points[i].time) >= exitMin) {
        exitIdx = i;
        break;
      }
    }
  }

  // ── 1. Entry Timing (0-100) ───────────────────────────────────────
  // How close was the entry to the optimal entry point?
  // Optimal entry = the lowest premium before MFE (for profitable direction)
  const entryScore = scoreEntryTiming(points, exitIdx, isCall, entryPremium, metrics);

  // ── 2. Exit Timing (0-100) ────────────────────────────────────────
  // How close was the exit to the MFE peak?
  const exitScore = scoreExitTiming(points, exitIdx, metrics);

  // ── 3. Risk Management (0-100) ────────────────────────────────────
  // How much drawdown was endured relative to the premium paid?
  const riskScore = scoreRiskManagement(points, exitIdx, entryPremium, metrics);

  // ── 4. Direction (0-100) ──────────────────────────────────────────
  // Was the call/put thesis correct?
  const directionScore = scoreDirection(points, isCall, actualPLPct);

  // ── 5. Profit Capture (0-100) ─────────────────────────────────────
  // What % of the MFE was actually captured?
  const captureScore = scoreProfitCapture(actualPLPct, metrics);

  const dimensions: DimensionScore[] = [
    { label: "Entry Timing", score: entryScore.score, grade: toLetterGrade(entryScore.score), detail: entryScore.detail },
    { label: "Exit Timing", score: exitScore.score, grade: toLetterGrade(exitScore.score), detail: exitScore.detail },
    { label: "Risk Management", score: riskScore.score, grade: toLetterGrade(riskScore.score), detail: riskScore.detail },
    { label: "Direction", score: directionScore.score, grade: toLetterGrade(directionScore.score), detail: directionScore.detail },
    { label: "Profit Capture", score: captureScore.score, grade: toLetterGrade(captureScore.score), detail: captureScore.detail },
  ];

  const overall = Math.round(
    entryScore.score * WEIGHTS.entryTiming +
    exitScore.score * WEIGHTS.exitTiming +
    riskScore.score * WEIGHTS.riskMgmt +
    directionScore.score * WEIGHTS.direction +
    captureScore.score * WEIGHTS.profitCapture
  );

  const letterGrade = toLetterGrade(overall);

  const summary = generateSummary(letterGrade, actualPLPct, dimensions);

  return { overall, letterGrade, dimensions, summary };
}

// ─── Dimension scorers ──────────────────────────────────────────────

function scoreEntryTiming(
  points: TimePoint[],
  exitIdx: number,
  _isCall: boolean,
  entryPremium: number,
  metrics: ReplayMetrics
): { score: number; detail: string } {
  // Compare entry premium to the range of premiums in the session
  // Best case: entered at the session low (for calls) or high (for puts)
  const subset = points.slice(0, exitIdx + 1);
  const prices = subset.map((p) => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice;

  if (range < 0.01) {
    return { score: 75, detail: "Flat session — entry timing was neutral." };
  }

  // How close to the best possible entry?
  // For any direction: the best entry is the lowest premium if the trade was profitable
  const mfePct = metrics.maxProfitPct;

  if (mfePct > 0) {
    // Trade had positive MFE — best entry would have been at the lowest premium
    const entryRank = (entryPremium - minPrice) / range; // 0 = perfect, 1 = worst
    const score = Math.round(Math.max(0, Math.min(100, (1 - entryRank) * 100)));
    const detail = entryRank < 0.2
      ? "Excellent entry — near session low premium before the move."
      : entryRank < 0.5
        ? "Decent entry — captured a good portion of the range."
        : "Late entry — premium was already elevated when you entered.";
    return { score, detail };
  } else {
    // Trade had no positive MFE — wrong direction, entry timing is less relevant
    return { score: 40, detail: "Direction was wrong — entry timing had limited impact." };
  }
}

function scoreExitTiming(
  points: TimePoint[],
  exitIdx: number,
  metrics: ReplayMetrics
): { score: number; detail: string } {
  // How close was exit to the MFE peak?
  const exitPL = points[exitIdx].pl_pct;
  const mfePct = metrics.maxProfitPct;

  if (mfePct <= 0) {
    // No positive MFE — exiting at any point was damage control
    if (exitPL > mfePct) {
      const saved = Math.abs(exitPL - metrics.maxDrawdownPct);
      const totalRange = Math.abs(metrics.maxDrawdownPct);
      const ratio = totalRange > 0 ? saved / totalRange : 0;
      const score = Math.round(50 + ratio * 50);
      return { score, detail: "No winning moment — but exit limited the damage." };
    }
    return { score: 30, detail: "Held through the worst of it — earlier exit would have saved capital." };
  }

  // Positive MFE existed — how close did exit get?
  const captureRatio = exitPL / mfePct; // 1.0 = exited at exact peak
  if (captureRatio >= 0.9) {
    return { score: 97, detail: "Near-perfect exit — captured almost all of the peak." };
  }
  if (captureRatio >= 0.7) {
    const score = Math.round(80 + (captureRatio - 0.7) * 85);
    return { score, detail: `Solid exit — captured ${(captureRatio * 100).toFixed(0)}% of the peak move.` };
  }
  if (captureRatio >= 0.4) {
    const score = Math.round(60 + (captureRatio - 0.4) * 66);
    return { score, detail: `Left gains on the table — exited at ${(captureRatio * 100).toFixed(0)}% of peak.` };
  }
  if (captureRatio >= 0) {
    const score = Math.round(40 + captureRatio * 50);
    return { score, detail: "Most of the move was given back before exit." };
  }
  // Negative capture — exited at a loss despite having a profitable peak
  const score = Math.round(Math.max(10, 40 + captureRatio * 40));
  return { score, detail: `Exited at a loss despite +${mfePct.toFixed(0)}% MFE — exit discipline needed.` };
}

function scoreRiskManagement(
  points: TimePoint[],
  exitIdx: number,
  entryPremium: number,
  metrics: ReplayMetrics
): { score: number; detail: string } {
  // Worst drawdown during the hold period
  const subset = points.slice(0, exitIdx + 1);
  let worstPLPct = 0;
  for (const pt of subset) {
    if (pt.pl_pct < worstPLPct) worstPLPct = pt.pl_pct;
  }

  const drawdownAbs = Math.abs(worstPLPct);

  if (drawdownAbs < 5) {
    return { score: 97, detail: "Minimal drawdown — excellent position management." };
  }
  if (drawdownAbs < 15) {
    return { score: 85, detail: `Controlled risk — max drawdown was ${worstPLPct.toFixed(0)}%.` };
  }
  if (drawdownAbs < 30) {
    return { score: 70, detail: `Moderate drawdown of ${worstPLPct.toFixed(0)}% — a -20% stop would have helped.` };
  }
  if (drawdownAbs < 50) {
    return { score: 50, detail: `Heavy drawdown of ${worstPLPct.toFixed(0)}% — consider tighter stops or smaller size.` };
  }
  return { score: 25, detail: `Severe ${worstPLPct.toFixed(0)}% drawdown — risk exceeded acceptable levels.` };
}

function scoreDirection(
  points: TimePoint[],
  isCall: boolean,
  actualPLPct: number
): { score: number; detail: string } {
  // Was the underlying moving in the direction of the trade?
  const first = points[0];
  const last = points[points.length - 1];
  const priceMove = last.price - first.price;
  const directionCorrect = isCall ? priceMove > 0 : priceMove < 0;

  if (actualPLPct >= 50) {
    return { score: 98, detail: "Thesis was spot-on — strong directional conviction paid off." };
  }
  if (actualPLPct >= 20) {
    return { score: 90, detail: "Correct read on direction — the underlying cooperated." };
  }
  if (actualPLPct > 0) {
    return { score: 80, detail: "Direction was right, but the move was modest." };
  }
  if (directionCorrect && actualPLPct > -10) {
    return { score: 65, detail: "Direction was correct but theta decay eroded the gain." };
  }
  if (actualPLPct > -20) {
    return { score: 45, detail: "Slight miss on direction — the move wasn't strong enough." };
  }
  return { score: 20, detail: "Wrong side of the trade — thesis was invalidated by price action." };
}

function scoreProfitCapture(
  actualPLPct: number,
  metrics: ReplayMetrics
): { score: number; detail: string } {
  const mfePct = metrics.maxProfitPct;

  if (mfePct <= 0) {
    // No profit opportunity existed
    if (actualPLPct > mfePct) {
      return { score: 60, detail: "No winning moment existed — but you minimized the loss." };
    }
    return { score: 30, detail: "No profit opportunity — and the loss wasn't cut early." };
  }

  const captureRatio = actualPLPct / mfePct;
  if (captureRatio >= 0.8) {
    return { score: 95, detail: `Captured ${(captureRatio * 100).toFixed(0)}% of the max profit — strong execution.` };
  }
  if (captureRatio >= 0.5) {
    const score = Math.round(70 + (captureRatio - 0.5) * 83);
    return { score, detail: `Captured ${(captureRatio * 100).toFixed(0)}% of peak — room for tighter exit discipline.` };
  }
  if (captureRatio >= 0.2) {
    const score = Math.round(50 + (captureRatio - 0.2) * 66);
    return { score, detail: `Only ${(captureRatio * 100).toFixed(0)}% of peak captured — the move happened but gains weren't locked in.` };
  }
  if (captureRatio >= 0) {
    const score = Math.round(30 + captureRatio * 100);
    return { score, detail: "Minimal profit captured despite a winning move being available." };
  }
  // Negative — lost money despite positive MFE
  const score = Math.round(Math.max(5, 30 + captureRatio * 30));
  return { score, detail: `Lost money despite +${mfePct.toFixed(0)}% MFE — the gain was never locked in.` };
}

// ─── Helpers ────────────────────────────────────────────────────────

function parseTimeMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function generateSummary(
  letterGrade: string,
  actualPLPct: number,
  dimensions: DimensionScore[]
): string {
  const best = dimensions.reduce((a, b) => (a.score > b.score ? a : b));
  const worst = dimensions.reduce((a, b) => (a.score < b.score ? a : b));

  const outcome = actualPLPct >= 0
    ? `+${actualPLPct.toFixed(0)}% winner`
    : `${actualPLPct.toFixed(0)}% loss`;

  return `${letterGrade} trade — ${outcome}. Strongest: ${best.label} (${best.grade}). Work on: ${worst.label} (${worst.grade}).`;
}
