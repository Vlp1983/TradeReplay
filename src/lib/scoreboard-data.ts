export type Category = "options" | "crypto" | "futures";
export type TimePeriod = "30d" | "90d" | "all";
export type Grade = "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C";
export type RiskLevel = "Low" | "Med" | "High";

export interface Guru {
  id: string;
  name: string;
  handle: string;
  categories: Category[];
  /** Per-period stats keyed by TimePeriod */
  stats: Record<
    TimePeriod,
    {
      grade: Grade;
      winRate: number;
      totalAlerts: number;
      avgReturn: number;
      riskLevel: RiskLevel;
      consistency: number; // 0-100
      streak: number; // current win streak
    }
  >;
  /** Brief description */
  bio: string;
  joinedDate: string;
}

export const gurus: Guru[] = [
  // ── OPTIONS GURUS ──
  {
    id: "warrior_trading",
    name: "Warrior Trading",
    handle: "@WarriorTrading",
    categories: ["options"],
    stats: {
      "30d": { grade: "A+", winRate: 78, totalAlerts: 52, avgReturn: 32, riskLevel: "Med", consistency: 92, streak: 9 },
      "90d": { grade: "A", winRate: 74, totalAlerts: 148, avgReturn: 28, riskLevel: "Med", consistency: 88, streak: 9 },
      all: { grade: "A", winRate: 71, totalAlerts: 610, avgReturn: 25, riskLevel: "Med", consistency: 85, streak: 9 },
    },
    bio: "Ross Cameron's day-trading community. High-volume stocks + options alerts with live streams and detailed trade breakdowns.",
    joinedDate: "2023-08",
  },
  {
    id: "wallstreet_trapper",
    name: "Wall Street Trapper",
    handle: "@WallStreetTrapper",
    categories: ["options"],
    stats: {
      "30d": { grade: "A", winRate: 73, totalAlerts: 28, avgReturn: 38, riskLevel: "Med", consistency: 86, streak: 6 },
      "90d": { grade: "A-", winRate: 70, totalAlerts: 80, avgReturn: 34, riskLevel: "Med", consistency: 82, streak: 6 },
      all: { grade: "A-", winRate: 68, totalAlerts: 320, avgReturn: 30, riskLevel: "Med", consistency: 79, streak: 6 },
    },
    bio: "Leon Howard's options-focused community. Large urban finance audience with options education and trade callouts.",
    joinedDate: "2023-11",
  },
  {
    id: "aristotle",
    name: "Aristotle Investments",
    handle: "@AristotleInvest",
    categories: ["options"],
    stats: {
      "30d": { grade: "A-", winRate: 69, totalAlerts: 35, avgReturn: 24, riskLevel: "Low", consistency: 90, streak: 5 },
      "90d": { grade: "A-", winRate: 67, totalAlerts: 100, avgReturn: 22, riskLevel: "Low", consistency: 87, streak: 5 },
      all: { grade: "B+", winRate: 65, totalAlerts: 420, avgReturn: 20, riskLevel: "Low", consistency: 84, streak: 5 },
    },
    bio: "Options education + trade callouts. Known for structured options strategies and disciplined risk management.",
    joinedDate: "2024-01",
  },
  {
    id: "trading_fraternity",
    name: "Trading Fraternity",
    handle: "@tradingfraternity",
    categories: ["options"],
    stats: {
      "30d": { grade: "B+", winRate: 66, totalAlerts: 45, avgReturn: 29, riskLevel: "Med", consistency: 78, streak: 4 },
      "90d": { grade: "B+", winRate: 64, totalAlerts: 130, avgReturn: 26, riskLevel: "Med", consistency: 75, streak: 4 },
      all: { grade: "B", winRate: 62, totalAlerts: 540, avgReturn: 23, riskLevel: "Med", consistency: 72, streak: 4 },
    },
    bio: "Josh's YouTube + Discord community. Heavy options flow commentary with real-time trade analysis.",
    joinedDate: "2024-02",
  },
  {
    id: "smb_capital",
    name: "SMB Capital",
    handle: "@smbcapital",
    categories: ["options"],
    stats: {
      "30d": { grade: "A", winRate: 75, totalAlerts: 20, avgReturn: 18, riskLevel: "Low", consistency: 94, streak: 8 },
      "90d": { grade: "A", winRate: 73, totalAlerts: 58, avgReturn: 17, riskLevel: "Low", consistency: 92, streak: 8 },
      all: { grade: "A", winRate: 72, totalAlerts: 250, avgReturn: 16, riskLevel: "Low", consistency: 90, streak: 8 },
    },
    bio: "Mike Bellafiore's institutional-style prop firm. Professional desk-style training with disciplined, low-risk options strategies.",
    joinedDate: "2023-06",
  },

  // ── FUTURES GURUS ──
  {
    id: "tradepro_academy",
    name: "TradePro Academy",
    handle: "@tradeproacademy",
    categories: ["futures"],
    stats: {
      "30d": { grade: "A+", winRate: 79, totalAlerts: 38, avgReturn: 22, riskLevel: "Low", consistency: 93, streak: 10 },
      "90d": { grade: "A", winRate: 76, totalAlerts: 110, avgReturn: 20, riskLevel: "Low", consistency: 90, streak: 10 },
      all: { grade: "A", winRate: 73, totalAlerts: 450, avgReturn: 18, riskLevel: "Low", consistency: 87, streak: 10 },
    },
    bio: "Professional futures + macro focused academy. Structured education with ES and NQ futures alerts.",
    joinedDate: "2023-09",
  },
  {
    id: "axia_futures",
    name: "Axia Futures",
    handle: "@AxiaFutures",
    categories: ["futures"],
    stats: {
      "30d": { grade: "A", winRate: 74, totalAlerts: 32, avgReturn: 20, riskLevel: "Low", consistency: 91, streak: 7 },
      "90d": { grade: "A", winRate: 72, totalAlerts: 92, avgReturn: 18, riskLevel: "Low", consistency: 88, streak: 7 },
      all: { grade: "A-", winRate: 70, totalAlerts: 380, avgReturn: 17, riskLevel: "Low", consistency: 86, streak: 7 },
    },
    bio: "Serious futures education brand. ES, NQ, and order flow specialists with institutional-grade analysis.",
    joinedDate: "2023-10",
  },
  {
    id: "ict",
    name: "Inner Circle Trader",
    handle: "@I_Am_The_ICT",
    categories: ["futures"],
    stats: {
      "30d": { grade: "A-", winRate: 70, totalAlerts: 22, avgReturn: 35, riskLevel: "Med", consistency: 82, streak: 5 },
      "90d": { grade: "A-", winRate: 68, totalAlerts: 65, avgReturn: 31, riskLevel: "Med", consistency: 79, streak: 5 },
      all: { grade: "B+", winRate: 66, totalAlerts: 280, avgReturn: 28, riskLevel: "Med", consistency: 76, streak: 5 },
    },
    bio: "Michael Huddleston's massive following. Futures + forex concepts including ICT methodology, liquidity sweeps, and market structure.",
    joinedDate: "2023-07",
  },
  {
    id: "day_trader_next_door",
    name: "Day Trader Next Door",
    handle: "@DayTraderND",
    categories: ["futures"],
    stats: {
      "30d": { grade: "B+", winRate: 65, totalAlerts: 40, avgReturn: 19, riskLevel: "Med", consistency: 77, streak: 3 },
      "90d": { grade: "B", winRate: 62, totalAlerts: 115, avgReturn: 17, riskLevel: "Med", consistency: 73, streak: 3 },
      all: { grade: "B", winRate: 60, totalAlerts: 470, avgReturn: 15, riskLevel: "Med", consistency: 70, streak: 3 },
    },
    bio: "Retail-focused futures trading community. Prop-style approach to ES and NQ day trading.",
    joinedDate: "2024-01",
  },
  {
    id: "futures_trader_71",
    name: "Futures Trader 71",
    handle: "@AnthonyCrudele",
    categories: ["futures"],
    stats: {
      "30d": { grade: "A-", winRate: 71, totalAlerts: 18, avgReturn: 24, riskLevel: "Low", consistency: 88, streak: 6 },
      "90d": { grade: "B+", winRate: 68, totalAlerts: 52, avgReturn: 21, riskLevel: "Low", consistency: 85, streak: 6 },
      all: { grade: "B+", winRate: 66, totalAlerts: 220, avgReturn: 19, riskLevel: "Low", consistency: 82, streak: 6 },
    },
    bio: "Anthony Crudele's Futures Radio Show. Long-standing futures personality with macro-driven analysis and trade setups.",
    joinedDate: "2023-08",
  },

  // ── CRYPTO GURUS ──
  {
    id: "crypto_banter",
    name: "Crypto Banter",
    handle: "@cryptobanter",
    categories: ["crypto"],
    stats: {
      "30d": { grade: "A-", winRate: 68, totalAlerts: 50, avgReturn: 42, riskLevel: "Med", consistency: 80, streak: 5 },
      "90d": { grade: "B+", winRate: 65, totalAlerts: 145, avgReturn: 38, riskLevel: "Med", consistency: 76, streak: 5 },
      all: { grade: "B+", winRate: 63, totalAlerts: 580, avgReturn: 34, riskLevel: "Med", consistency: 73, streak: 5 },
    },
    bio: "Frequent crypto trade commentary with live streams. Covers BTC, ETH, altcoins, and macro crypto trends.",
    joinedDate: "2023-11",
  },
  {
    id: "altcoin_daily",
    name: "Altcoin Daily",
    handle: "@AltcoinDaily",
    categories: ["crypto"],
    stats: {
      "30d": { grade: "B+", winRate: 64, totalAlerts: 35, avgReturn: 45, riskLevel: "Med", consistency: 75, streak: 3 },
      "90d": { grade: "B", winRate: 61, totalAlerts: 100, avgReturn: 40, riskLevel: "Med", consistency: 71, streak: 3 },
      all: { grade: "B", winRate: 59, totalAlerts: 410, avgReturn: 36, riskLevel: "Med", consistency: 68, streak: 3 },
    },
    bio: "Massive retail crypto audience. Daily altcoin coverage with market analysis and trade ideas.",
    joinedDate: "2024-01",
  },
  {
    id: "the_moon_carl",
    name: "The Moon Carl",
    handle: "@TheMoonCarl",
    categories: ["crypto"],
    stats: {
      "30d": { grade: "B", winRate: 61, totalAlerts: 30, avgReturn: 55, riskLevel: "High", consistency: 65, streak: 2 },
      "90d": { grade: "B-", winRate: 58, totalAlerts: 88, avgReturn: 48, riskLevel: "High", consistency: 60, streak: 2 },
      all: { grade: "B-", winRate: 55, totalAlerts: 360, avgReturn: 42, riskLevel: "High", consistency: 56, streak: 2 },
    },
    bio: "Carl Runefelt's highly visible crypto signals. Bold calls on BTC, SOL, and trending narratives.",
    joinedDate: "2024-02",
  },
  {
    id: "crypto_face",
    name: "Crypto Face",
    handle: "@CryptoFace",
    categories: ["crypto"],
    stats: {
      "30d": { grade: "A", winRate: 72, totalAlerts: 25, avgReturn: 38, riskLevel: "Med", consistency: 85, streak: 6 },
      "90d": { grade: "A-", winRate: 69, totalAlerts: 72, avgReturn: 34, riskLevel: "Med", consistency: 81, streak: 6 },
      all: { grade: "B+", winRate: 66, totalAlerts: 300, avgReturn: 30, riskLevel: "Med", consistency: 77, streak: 6 },
    },
    bio: "Market Cipher / Discord community. Indicator-driven crypto trading with proprietary tools and technical setups.",
    joinedDate: "2023-12",
  },
  {
    id: "cryptocred",
    name: "CryptoCred",
    handle: "@CryptoCred",
    categories: ["crypto"],
    stats: {
      "30d": { grade: "A", winRate: 74, totalAlerts: 15, avgReturn: 30, riskLevel: "Low", consistency: 90, streak: 7 },
      "90d": { grade: "A", winRate: 72, totalAlerts: 44, avgReturn: 27, riskLevel: "Low", consistency: 87, streak: 7 },
      all: { grade: "A-", winRate: 70, totalAlerts: 190, avgReturn: 24, riskLevel: "Low", consistency: 84, streak: 7 },
    },
    bio: "Respected crypto trading educator. Clean technical analysis with disciplined risk management and educational content.",
    joinedDate: "2023-09",
  },
];

/** Sort and rank gurus for a given category and time period */
export function getRankedGurus(
  category: Category | "all",
  period: TimePeriod
): (Guru & { rank: number })[] {
  const filtered =
    category === "all"
      ? gurus
      : gurus.filter((g) => g.categories.includes(category));

  const sorted = [...filtered].sort((a, b) => {
    const as = a.stats[period];
    const bs = b.stats[period];
    // Primary: grade weight, Secondary: win rate, Tertiary: consistency
    const gradeWeight: Record<Grade, number> = {
      "A+": 9, A: 8, "A-": 7, "B+": 6, B: 5, "B-": 4, "C+": 3, C: 2,
    };
    const gDiff = gradeWeight[bs.grade] - gradeWeight[as.grade];
    if (gDiff !== 0) return gDiff;
    const wDiff = bs.winRate - as.winRate;
    if (wDiff !== 0) return wDiff;
    return bs.consistency - as.consistency;
  });

  return sorted.map((g, i) => ({ ...g, rank: i + 1 }));
}
