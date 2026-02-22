export type Category = "options" | "crypto" | "futures";
export type TimePeriod = "30d" | "all";
export type RiskLevel = "Low" | "Med" | "High";

export interface Trade {
  id: string;
  date: string; // YYYY-MM-DD
  ticker: string;
  direction: "Long" | "Short";
  entry: number;
  exit: number;
  returnPct: number; // positive = win, negative = loss
  result: "Win" | "Loss";
  notes: string;
}

export interface PeriodStats {
  winRate: number;
  totalAlerts: number;
  avgReturn: number;
  riskLevel: RiskLevel;
  consistency: number; // 0-100
  streak: number; // current win streak
  trades: Trade[];
}

export interface Guru {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string; // placeholder or real image
  categories: Category[];
  stats: Record<TimePeriod, PeriodStats>;
  bio: string;
  joinedDate: string;
}

/* ─── Helper: generate mock trades ─── */

function makeTrades(
  count: number,
  winRate: number,
  category: Category,
  period: TimePeriod,
): Trade[] {
  const tickers: Record<Category, string[]> = {
    options: ["SPY 450C", "QQQ 380P", "AAPL 190C", "TSLA 250P", "NVDA 500C", "META 480C", "AMD 160P", "AMZN 185C"],
    crypto: ["BTC/USDT", "ETH/USDT", "SOL/USDT", "DOGE/USDT", "AVAX/USDT", "LINK/USDT", "ARB/USDT", "OP/USDT"],
    futures: ["ES", "NQ", "CL", "GC", "RTY", "YM", "6E", "ZB"],
  };

  const wins = Math.round(count * (winRate / 100));
  const results: boolean[] = [];
  for (let i = 0; i < count; i++) results.push(i < wins);
  // Shuffle
  for (let i = results.length - 1; i > 0; i--) {
    const j = Math.floor((i + 1) * 0.7) % (i + 1); // deterministic shuffle
    [results[i], results[j]] = [results[j], results[i]];
  }

  const baseDate = period === "30d" ? new Date("2026-01-23") : new Date("2025-03-01");
  const pool = tickers[category];

  return results.map((isWin, i) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + Math.floor((i * (period === "30d" ? 30 : 300)) / count));
    const ticker = pool[i % pool.length];
    const entry = category === "crypto"
      ? +(50 + Math.random() * 950).toFixed(2)
      : category === "futures"
        ? +(4200 + Math.random() * 600).toFixed(2)
        : +(1.5 + Math.random() * 8).toFixed(2);
    const retPct = isWin
      ? +(5 + Math.random() * 60).toFixed(1)
      : -(3 + Math.random() * 40).toFixed(1);
    const exit = +(entry * (1 + +retPct / 100)).toFixed(2);

    return {
      id: `${period}-${i}`,
      date: d.toISOString().slice(0, 10),
      ticker,
      direction: Math.random() > 0.35 ? "Long" as const : "Short" as const,
      entry,
      exit,
      returnPct: +retPct,
      result: isWin ? "Win" as const : "Loss" as const,
      notes: isWin
        ? ["Hit target", "Ran to TP2", "Clean breakout", "Momentum carry", "Trend continuation"][i % 5]
        : ["Stopped out", "Reversed on news", "Faded at resistance", "Choppy session", "Gap down"][i % 5],
    };
  });
}

/* ─── Guru data ─── */

export const gurus: Guru[] = [
  // ── OPTIONS GURUS ──
  {
    id: "warrior_trading",
    name: "Warrior Trading",
    handle: "@WarriorTrading",
    avatarUrl: "",
    categories: ["options"],
    stats: {
      "30d": { winRate: 68, totalAlerts: 52, avgReturn: 32, riskLevel: "Med", consistency: 82, streak: 7, trades: makeTrades(52, 68, "options", "30d") },
      all: { winRate: 61, totalAlerts: 610, avgReturn: 25, riskLevel: "Med", consistency: 75, streak: 7, trades: makeTrades(20, 61, "options", "all") },
    },
    bio: "Ross Cameron's day-trading community. High-volume stocks + options alerts with live streams and detailed trade breakdowns.",
    joinedDate: "2023-08",
  },
  {
    id: "wallstreet_trapper",
    name: "Wall Street Trapper",
    handle: "@WallStreetTrapper",
    avatarUrl: "",
    categories: ["options"],
    stats: {
      "30d": { winRate: 58, totalAlerts: 28, avgReturn: 38, riskLevel: "Med", consistency: 72, streak: 4, trades: makeTrades(28, 58, "options", "30d") },
      all: { winRate: 52, totalAlerts: 320, avgReturn: 30, riskLevel: "Med", consistency: 65, streak: 4, trades: makeTrades(20, 52, "options", "all") },
    },
    bio: "Leon Howard's options-focused community. Large urban finance audience with options education and trade callouts.",
    joinedDate: "2023-11",
  },
  {
    id: "aristotle",
    name: "Aristotle Investments",
    handle: "@AristotleInvest",
    avatarUrl: "",
    categories: ["options"],
    stats: {
      "30d": { winRate: 63, totalAlerts: 35, avgReturn: 24, riskLevel: "Low", consistency: 80, streak: 5, trades: makeTrades(35, 63, "options", "30d") },
      all: { winRate: 57, totalAlerts: 420, avgReturn: 20, riskLevel: "Low", consistency: 74, streak: 5, trades: makeTrades(20, 57, "options", "all") },
    },
    bio: "Options education + trade callouts. Known for structured options strategies and disciplined risk management.",
    joinedDate: "2024-01",
  },
  {
    id: "trading_fraternity",
    name: "Trading Fraternity",
    handle: "@tradingfraternity",
    avatarUrl: "",
    categories: ["options"],
    stats: {
      "30d": { winRate: 48, totalAlerts: 45, avgReturn: 29, riskLevel: "Med", consistency: 62, streak: 3, trades: makeTrades(45, 48, "options", "30d") },
      all: { winRate: 44, totalAlerts: 540, avgReturn: 23, riskLevel: "Med", consistency: 58, streak: 3, trades: makeTrades(20, 44, "options", "all") },
    },
    bio: "Josh's YouTube + Discord community. Heavy options flow commentary with real-time trade analysis.",
    joinedDate: "2024-02",
  },
  {
    id: "smb_capital",
    name: "SMB Capital",
    handle: "@smbcapital",
    avatarUrl: "",
    categories: ["options"],
    stats: {
      "30d": { winRate: 72, totalAlerts: 20, avgReturn: 18, riskLevel: "Low", consistency: 88, streak: 8, trades: makeTrades(20, 72, "options", "30d") },
      all: { winRate: 66, totalAlerts: 250, avgReturn: 16, riskLevel: "Low", consistency: 82, streak: 8, trades: makeTrades(20, 66, "options", "all") },
    },
    bio: "Mike Bellafiore's institutional-style prop firm. Professional desk-style training with disciplined, low-risk options strategies.",
    joinedDate: "2023-06",
  },

  // ── FUTURES GURUS ──
  {
    id: "tradepro_academy",
    name: "TradePro Academy",
    handle: "@tradeproacademy",
    avatarUrl: "",
    categories: ["futures"],
    stats: {
      "30d": { winRate: 74, totalAlerts: 38, avgReturn: 22, riskLevel: "Low", consistency: 86, streak: 9, trades: makeTrades(38, 74, "futures", "30d") },
      all: { winRate: 67, totalAlerts: 450, avgReturn: 18, riskLevel: "Low", consistency: 80, streak: 9, trades: makeTrades(20, 67, "futures", "all") },
    },
    bio: "Professional futures + macro focused academy. Structured education with ES and NQ futures alerts.",
    joinedDate: "2023-09",
  },
  {
    id: "axia_futures",
    name: "Axia Futures",
    handle: "@AxiaFutures",
    avatarUrl: "",
    categories: ["futures"],
    stats: {
      "30d": { winRate: 65, totalAlerts: 32, avgReturn: 20, riskLevel: "Low", consistency: 81, streak: 6, trades: makeTrades(32, 65, "futures", "30d") },
      all: { winRate: 60, totalAlerts: 380, avgReturn: 17, riskLevel: "Low", consistency: 76, streak: 6, trades: makeTrades(20, 60, "futures", "all") },
    },
    bio: "Serious futures education brand. ES, NQ, and order flow specialists with institutional-grade analysis.",
    joinedDate: "2023-10",
  },
  {
    id: "ict",
    name: "Inner Circle Trader",
    handle: "@I_Am_The_ICT",
    avatarUrl: "",
    categories: ["futures"],
    stats: {
      "30d": { winRate: 55, totalAlerts: 22, avgReturn: 35, riskLevel: "Med", consistency: 68, streak: 3, trades: makeTrades(22, 55, "futures", "30d") },
      all: { winRate: 50, totalAlerts: 280, avgReturn: 28, riskLevel: "Med", consistency: 62, streak: 3, trades: makeTrades(20, 50, "futures", "all") },
    },
    bio: "Michael Huddleston's massive following. Futures + forex concepts including ICT methodology, liquidity sweeps, and market structure.",
    joinedDate: "2023-07",
  },
  {
    id: "day_trader_next_door",
    name: "Day Trader Next Door",
    handle: "@DayTraderND",
    avatarUrl: "",
    categories: ["futures"],
    stats: {
      "30d": { winRate: 42, totalAlerts: 40, avgReturn: 19, riskLevel: "Med", consistency: 55, streak: 2, trades: makeTrades(40, 42, "futures", "30d") },
      all: { winRate: 38, totalAlerts: 470, avgReturn: 15, riskLevel: "Med", consistency: 50, streak: 2, trades: makeTrades(20, 38, "futures", "all") },
    },
    bio: "Retail-focused futures trading community. Prop-style approach to ES and NQ day trading.",
    joinedDate: "2024-01",
  },
  {
    id: "futures_trader_71",
    name: "Futures Trader 71",
    handle: "@AnthonyCrudele",
    avatarUrl: "",
    categories: ["futures"],
    stats: {
      "30d": { winRate: 61, totalAlerts: 18, avgReturn: 24, riskLevel: "Low", consistency: 78, streak: 5, trades: makeTrades(18, 61, "futures", "30d") },
      all: { winRate: 56, totalAlerts: 220, avgReturn: 19, riskLevel: "Low", consistency: 72, streak: 5, trades: makeTrades(20, 56, "futures", "all") },
    },
    bio: "Anthony Crudele's Futures Radio Show. Long-standing futures personality with macro-driven analysis and trade setups.",
    joinedDate: "2023-08",
  },

  // ── CRYPTO GURUS ──
  {
    id: "crypto_banter",
    name: "Crypto Banter",
    handle: "@cryptobanter",
    avatarUrl: "",
    categories: ["crypto"],
    stats: {
      "30d": { winRate: 53, totalAlerts: 50, avgReturn: 42, riskLevel: "Med", consistency: 66, streak: 3, trades: makeTrades(50, 53, "crypto", "30d") },
      all: { winRate: 47, totalAlerts: 580, avgReturn: 34, riskLevel: "Med", consistency: 60, streak: 3, trades: makeTrades(20, 47, "crypto", "all") },
    },
    bio: "Frequent crypto trade commentary with live streams. Covers BTC, ETH, altcoins, and macro crypto trends.",
    joinedDate: "2023-11",
  },
  {
    id: "altcoin_daily",
    name: "Altcoin Daily",
    handle: "@AltcoinDaily",
    avatarUrl: "",
    categories: ["crypto"],
    stats: {
      "30d": { winRate: 45, totalAlerts: 35, avgReturn: 45, riskLevel: "Med", consistency: 58, streak: 2, trades: makeTrades(35, 45, "crypto", "30d") },
      all: { winRate: 40, totalAlerts: 410, avgReturn: 36, riskLevel: "Med", consistency: 52, streak: 2, trades: makeTrades(20, 40, "crypto", "all") },
    },
    bio: "Massive retail crypto audience. Daily altcoin coverage with market analysis and trade ideas.",
    joinedDate: "2024-01",
  },
  {
    id: "the_moon_carl",
    name: "The Moon Carl",
    handle: "@TheMoonCarl",
    avatarUrl: "",
    categories: ["crypto"],
    stats: {
      "30d": { winRate: 37, totalAlerts: 30, avgReturn: 55, riskLevel: "High", consistency: 45, streak: 1, trades: makeTrades(30, 37, "crypto", "30d") },
      all: { winRate: 33, totalAlerts: 360, avgReturn: 42, riskLevel: "High", consistency: 40, streak: 1, trades: makeTrades(20, 33, "crypto", "all") },
    },
    bio: "Carl Runefelt's highly visible crypto signals. Bold calls on BTC, SOL, and trending narratives.",
    joinedDate: "2024-02",
  },
  {
    id: "crypto_face",
    name: "Crypto Face",
    handle: "@CryptoFace",
    avatarUrl: "",
    categories: ["crypto"],
    stats: {
      "30d": { winRate: 62, totalAlerts: 25, avgReturn: 38, riskLevel: "Med", consistency: 76, streak: 5, trades: makeTrades(25, 62, "crypto", "30d") },
      all: { winRate: 56, totalAlerts: 300, avgReturn: 30, riskLevel: "Med", consistency: 70, streak: 5, trades: makeTrades(20, 56, "crypto", "all") },
    },
    bio: "Market Cipher / Discord community. Indicator-driven crypto trading with proprietary tools and technical setups.",
    joinedDate: "2023-12",
  },
  {
    id: "cryptocred",
    name: "CryptoCred",
    handle: "@CryptoCred",
    avatarUrl: "",
    categories: ["crypto"],
    stats: {
      "30d": { winRate: 70, totalAlerts: 15, avgReturn: 30, riskLevel: "Low", consistency: 84, streak: 6, trades: makeTrades(15, 70, "crypto", "30d") },
      all: { winRate: 64, totalAlerts: 190, avgReturn: 24, riskLevel: "Low", consistency: 78, streak: 6, trades: makeTrades(20, 64, "crypto", "all") },
    },
    bio: "Respected crypto trading educator. Clean technical analysis with disciplined risk management and educational content.",
    joinedDate: "2023-09",
  },
];

/** Sort and rank gurus for a given category and time period */
export function getRankedGurus(
  category: Category | "all",
  period: TimePeriod,
): (Guru & { rank: number })[] {
  const filtered =
    category === "all"
      ? gurus
      : gurus.filter((g) => g.categories.includes(category));

  const sorted = [...filtered].sort((a, b) => {
    const as = a.stats[period];
    const bs = b.stats[period];
    // Primary: win rate, Secondary: consistency
    const wDiff = bs.winRate - as.winRate;
    if (wDiff !== 0) return wDiff;
    return bs.consistency - as.consistency;
  });

  return sorted.map((g, i) => ({ ...g, rank: i + 1 }));
}
