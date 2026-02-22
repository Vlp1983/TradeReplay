/**
 * Generate the full contract replay — price path, P/L series,
 * metrics, and key insights.
 */

import type {
  SelectedContract,
  TimePoint,
  ReplayMetrics,
  KeyMoment,
  ReplayResult,
  Ticker,
} from "./types";
import { getAssetClass } from "./types";
import {
  getUnderlyingPrice,
  estimatePremium,
  getImpliedVol,
  generateUnderlyingPath,
  BASE_VOLATILITY,
  seedFromMoment,
} from "./pricing";
import { getExpirationDays } from "./chain";

/**
 * Replay a selected contract from entry to expiration.
 */
export function replayContract(contract: SelectedContract): ReplayResult {
  const {
    ticker,
    date,
    entryTime,
    expiration,
    strike,
    right,
    entryPremium,
  } = contract;

  const isCall = right === "call";
  const basePrice = getUnderlyingPrice(ticker, date, entryTime);
  const expirationDays = getExpirationDays(date, expiration);
  const baseVol = BASE_VOLATILITY[ticker] ?? 0.22;

  // Generate underlying price path
  const path = generateUnderlyingPath(
    ticker,
    date,
    entryTime,
    expirationDays,
    basePrice,
    baseVol
  );

  // Compute raw option premium at each time point
  const totalPoints = path.prices.length;
  const rawPremiums: number[] = [];

  for (let i = 0; i < totalPoints; i++) {
    const S = path.prices[i];
    const pointsRemaining = totalPoints - 1 - i;
    const T = Math.max(pointsRemaining * (15 / (252 * 390)), 0.0001);

    const iv = getImpliedVol(S, strike, baseVol);
    const est = estimatePremium(S, strike, T, isCall, iv);
    let premium = est.premium;

    // At expiration (last point), use intrinsic value
    if (i === totalPoints - 1) {
      premium = isCall
        ? Math.max(S - strike, 0)
        : Math.max(strike - S, 0);
      premium = +premium.toFixed(2);
    }

    rawPremiums.push(premium);
  }

  // ── Anchor to actual entryPremium ──────────────────────────────────
  // The raw estimate at t=0 may differ from the actual entryPremium
  // (especially when Yahoo data is used). Scale the path so the first
  // point matches exactly, P/L starts at $0, and the entry line is correct.
  const rawEntry = rawPremiums[0];
  const offset = entryPremium - rawEntry;

  const allPoints: TimePoint[] = [];
  for (let i = 0; i < totalPoints; i++) {
    // Apply offset with decay — full offset at entry, zero at expiration
    const t = i / Math.max(totalPoints - 1, 1);
    const decay = 1 - t; // linear decay from 1→0
    const adjusted = +(rawPremiums[i] + offset * decay).toFixed(2);
    const premium = Math.max(adjusted, 0.01);

    const plDollar = +((premium - entryPremium) * 100).toFixed(0);
    const plPct = +(((premium - entryPremium) / entryPremium) * 100).toFixed(1);

    allPoints.push({
      time: path.times[i],
      label: path.labels[i],
      price: premium,
      pl_dollar: plDollar,
      pl_pct: plPct,
      dayIndex: path.dayIndices[i],
    });
  }

  // Split into same-day and full series
  const sameDayPoints = allPoints.filter((p) => p.dayIndex === 0);
  const toExpirationPoints = allPoints;

  // Compute metrics
  const metrics = computeMetrics(allPoints, entryPremium);

  // Generate key insights (trade moments + news context)
  const tradeInsights = detectTradeInsights(allPoints, sameDayPoints, entryPremium);
  const newsInsights = generateNewsContext(ticker as Ticker, date, entryTime, allPoints);
  const keyMoments = mergeInsights(tradeInsights, newsInsights);

  return {
    contract,
    sameDayPoints,
    toExpirationPoints,
    metrics,
    keyMoments,
  };
}

function computeMetrics(
  points: TimePoint[],
  entryPremium: number
): ReplayMetrics {
  let maxProfitPt = points[0];
  let maxDrawdownPt = points[0];

  for (const pt of points) {
    if (pt.pl_dollar > maxProfitPt.pl_dollar) maxProfitPt = pt;
    if (pt.pl_dollar < maxDrawdownPt.pl_dollar) maxDrawdownPt = pt;
  }

  const lastPoint = points[points.length - 1];

  // Optimal exit: first point with ≥50% gain, OR peak before -30% retrace
  let optimalPt = lastPoint;
  let peak = points[0];
  for (const pt of points) {
    if (pt.pl_pct >= 50) {
      optimalPt = pt;
      break;
    }
    if (pt.pl_dollar > peak.pl_dollar) {
      peak = pt;
    }
    if (peak.pl_pct > 10 && pt.pl_pct < peak.pl_pct - 30) {
      optimalPt = peak;
      break;
    }
  }

  return {
    entryPremium,
    exitAtClosePL: lastPoint.pl_dollar,
    exitAtClosePLPct: lastPoint.pl_pct,
    maxProfit: maxProfitPt.pl_dollar,
    maxProfitPct: maxProfitPt.pl_pct,
    maxProfitTime: maxProfitPt.label,
    maxDrawdown: maxDrawdownPt.pl_dollar,
    maxDrawdownPct: maxDrawdownPt.pl_pct,
    maxDrawdownTime: maxDrawdownPt.label,
    optimalExitTime: optimalPt.label,
    optimalExitPL: optimalPt.pl_dollar,
    optimalExitPLPct: optimalPt.pl_pct,
  };
}

// ─── Trade insights (formerly "key moments") ────────────────────────

function detectTradeInsights(
  allPoints: TimePoint[],
  sameDayPoints: TimePoint[],
  entryPremium: number
): KeyMoment[] {
  const moments: KeyMoment[] = [];
  const pts = allPoints;
  if (pts.length < 3) return moments;

  // 1. Entry
  moments.push({
    time: pts[0].label,
    label: "Entry",
    reason: `Entered at $${entryPremium.toFixed(2)} premium.`,
    type: "trade",
  });

  // Find peak and trough
  let peakIdx = 0;
  let troughIdx = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].pl_dollar > pts[peakIdx].pl_dollar) peakIdx = i;
    if (pts[i].pl_dollar < pts[troughIdx].pl_dollar) troughIdx = i;
  }

  // 2. First significant move (±15%)
  for (let i = 1; i < pts.length; i++) {
    if (Math.abs(pts[i].pl_pct) >= 15) {
      moments.push({
        time: pts[i].label,
        label: pts[i].pl_pct > 0 ? "Momentum surge" : "Momentum drop",
        reason: `Contract moved ${pts[i].pl_pct > 0 ? "+" : ""}${pts[i].pl_pct.toFixed(0)}% — initial directional move.`,
        type: "trade",
      });
      break;
    }
  }

  // 3. Peak (MFE)
  if (pts[peakIdx].pl_pct > 5) {
    moments.push({
      time: pts[peakIdx].label,
      label: "Peak profit (MFE)",
      reason: `Max favorable excursion: +${pts[peakIdx].pl_pct.toFixed(0)}% ($${pts[peakIdx].pl_dollar}).`,
      type: "trade",
    });
  }

  // 4. Trough (MAE)
  if (pts[troughIdx].pl_pct < -10) {
    moments.push({
      time: pts[troughIdx].label,
      label: "Max drawdown (MAE)",
      reason: `Max adverse excursion: ${pts[troughIdx].pl_pct.toFixed(0)}% ($${pts[troughIdx].pl_dollar}).`,
      type: "trade",
    });
  }

  // 5. Detect support/resistance-like moments
  for (let i = 2; i < pts.length - 2; i++) {
    const prev = pts[i - 2].pl_dollar;
    const curr = pts[i].pl_dollar;
    const next = pts[i + 2].pl_dollar;

    if (curr < prev && curr < next && curr - prev < -20 && next - curr > 20) {
      if (!moments.some((m) => m.label === "Support held")) {
        moments.push({
          time: pts[i].label,
          label: "Support held",
          reason: `Price bounced from $${pts[i].price.toFixed(2)} — potential support level in underlying.`,
          type: "trade",
        });
      }
    }

    if (curr > prev && curr > next && curr - prev > 20 && next - curr < -20) {
      if (!moments.some((m) => m.label === "Resistance hit")) {
        moments.push({
          time: pts[i].label,
          label: "Resistance hit",
          reason: `Premium peaked at $${pts[i].price.toFixed(2)} before pulling back — possible resistance in underlying.`,
          type: "trade",
        });
      }
    }
  }

  // 6. Theta decay observation (for multi-day)
  if (allPoints.length > sameDayPoints.length) {
    const day1Close = allPoints.filter((p) => p.dayIndex === 0);
    const day2Open = allPoints.find((p) => p.dayIndex === 1);
    if (day1Close.length && day2Open) {
      const overnight = day2Open.pl_dollar - day1Close[day1Close.length - 1].pl_dollar;
      if (overnight < -10) {
        moments.push({
          time: day2Open.label,
          label: "Theta decay overnight",
          reason: `Premium dropped $${Math.abs(overnight)} overnight due to time decay.`,
          type: "trade",
        });
      }
    }
  }

  // 7. Close
  const last = pts[pts.length - 1];
  moments.push({
    time: last.label,
    label: last.pl_pct >= 0 ? "Profitable close" : "Loss at close",
    reason: `Closed at ${last.pl_pct >= 0 ? "+" : ""}${last.pl_pct.toFixed(0)}% ($${last.pl_dollar}).`,
    type: "trade",
  });

  return moments;
}

// ─── News context generation ─────────────────────────────────────────

interface NewsTemplate {
  label: string;
  templates: string[];
}

const EQUITY_NEWS: NewsTemplate[] = [
  { label: "Earnings watch", templates: [
    "Quarterly earnings report approaching — elevated IV expected across the options chain.",
    "Post-earnings volatility crush likely as implied vol is elevated ahead of results.",
  ]},
  { label: "Sector rotation", templates: [
    "Institutional flows showing rotation into the sector — unusual call volume detected.",
    "Sector ETFs seeing heavy put buying — hedging activity suggesting risk-off sentiment.",
  ]},
  { label: "Fed policy impact", templates: [
    "FOMC meeting minutes signaling rate trajectory — equity vol elevated across indices.",
    "Treasury yields moving sharply — rate-sensitive names reacting to Fed commentary.",
  ]},
  { label: "Market sentiment", templates: [
    "VIX elevated above 20 — broader market uncertainty lifting option premiums.",
    "Put/call ratio skewing bearish across the market — protective positioning increasing.",
    "Bullish sentiment rising — call skew suggests institutional accumulation.",
  ]},
  { label: "Technical level", templates: [
    "Price testing key moving average — watch for breakout or rejection at this level.",
    "Volume profile shows major support nearby — options market pricing in a bounce.",
  ]},
];

const FUTURES_NEWS: NewsTemplate[] = [
  { label: "Macro data release", templates: [
    "CPI/PPI data release impacting futures pricing — volatility spike across contracts.",
    "Non-farm payroll report ahead — futures positioning showing hedging activity.",
  ]},
  { label: "Geopolitical risk", templates: [
    "Geopolitical tensions elevating crude and gold — flight-to-safety premium building.",
    "Trade policy uncertainty lifting futures vol — hedging costs increasing.",
  ]},
  { label: "Supply/demand shift", templates: [
    "OPEC production decision pending — crude oil vol curve steepening.",
    "Inventory data diverging from expectations — commodity futures repricing.",
    "Central bank gold purchases driving spot premium — options skew reflecting bullish bias.",
  ]},
];

const CRYPTO_NEWS: NewsTemplate[] = [
  { label: "ETF flow signal", templates: [
    "Spot ETF inflows accelerating — institutional adoption driving bullish sentiment.",
    "ETF outflows detected — short-term selling pressure as institutions rebalance.",
  ]},
  { label: "On-chain activity", templates: [
    "Large wallet movements detected on-chain — whale activity suggesting position changes.",
    "Exchange outflows rising — supply being moved to cold storage, bullish signal.",
  ]},
  { label: "Regulatory development", templates: [
    "Regulatory clarity improving in major markets — crypto vol compressing on reduced uncertainty.",
    "New regulatory proposal introduced — market pricing in compliance costs and risk.",
  ]},
  { label: "Network event", templates: [
    "Major protocol upgrade approaching — volatility expected around implementation date.",
    "Staking yields shifting — capital rotation between protocols impacting price.",
  ]},
];

/**
 * Generate deterministic news-like context insights for the replay period.
 * Uses the seeded PRNG to pick 1–2 relevant news items based on the ticker's
 * asset class and the simulated price action.
 */
function generateNewsContext(
  ticker: Ticker,
  date: string,
  entryTime: string,
  points: TimePoint[]
): KeyMoment[] {
  const rng = seedFromMoment(ticker, date, entryTime, 99);
  const ac = getAssetClass(ticker);

  const pool =
    ac === "futures" ? FUTURES_NEWS :
    ac === "crypto" ? CRYPTO_NEWS :
    EQUITY_NEWS;

  const news: KeyMoment[] = [];

  // Pick 1–2 news items deterministically
  const count = rng() > 0.4 ? 2 : 1;
  const usedIndices = new Set<number>();

  for (let n = 0; n < count; n++) {
    let idx = Math.floor(rng() * pool.length);
    // Avoid duplicates
    while (usedIndices.has(idx) && usedIndices.size < pool.length) {
      idx = (idx + 1) % pool.length;
    }
    usedIndices.add(idx);

    const item = pool[idx];
    const templateIdx = Math.floor(rng() * item.templates.length);

    // Place the news insight near the start or middle of the chart
    const pointIdx = n === 0
      ? Math.min(1, points.length - 1) // near entry
      : Math.floor(points.length * 0.4); // mid-session

    news.push({
      time: points[pointIdx]?.label ?? "",
      label: item.label,
      reason: item.templates[templateIdx],
      type: "news",
    });
  }

  return news;
}

/**
 * Merge trade insights and news context, interleaving by time position.
 * Entry always first, close always last, news woven in between.
 */
function mergeInsights(
  trade: KeyMoment[],
  news: KeyMoment[]
): KeyMoment[] {
  if (trade.length === 0) return news;

  const entry = trade[0]; // always first
  const close = trade[trade.length - 1]; // always last
  const middle = trade.slice(1, -1);

  // Insert news after entry, before the trade middle items
  const merged = [entry, ...news, ...middle, close];

  // Cap at 10 items total
  if (merged.length > 10) {
    const keep = [entry, ...news, ...middle.slice(0, 10 - 2 - news.length), close];
    return keep;
  }

  return merged;
}
