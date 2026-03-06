# TradeReplay — Product Requirements Document

## 1. Product Overview

**TradeReplay** is an AI-powered options backtesting platform. Users pick a direction (Call or Put), a ticker, a past date, and an entry time — then replay exactly how that options contract would have performed. The platform provides P/L analysis, key trade moments, and AI-generated contextual insights.

**Tagline:** Replay any trade. See the result.

**Target audience:** Retail options traders who want to learn from past market moments without needing a brokerage connection.

**Disclaimer:** TradeReplay is for educational and analytical purposes only. It does not provide investment advice.

---

## 2. Core Concepts

| Concept | Description |
|---------|-------------|
| **Direction** | Call (bullish) or Put (bearish) — the user's directional thesis, selected upfront |
| **Moment** | A specific ticker + date + entry time combination |
| **Chain Snapshot** | A point-in-time options chain showing 10 strikes (5 below ATM, ATM, 4 above) with estimated premiums |
| **Contract Replay** | A simulation of how a selected contract performed from entry through close (same day) and to expiration |
| **Key Moments** | Significant events during the replay (entry, momentum surges, support/resistance, theta decay, close) |
| **Insights** | AI-generated or data-driven contextual analysis of why the trade moved the way it did |

---

## 3. Supported Instruments

### Asset Class: Options Only

| Ticker | Description |
|--------|-------------|
| SPY | S&P 500 ETF |
| QQQ | Nasdaq 100 ETF |
| AAPL | Apple |
| TSLA | Tesla |
| NVDA | Nvidia |
| AMZN | Amazon |

> **Note:** Futures and Crypto asset classes exist in the type system but are not exposed in the UI. They are reserved for a future release.

---

## 4. User Flow

### 4.1 Landing Page (`/`)

The landing page introduces the product with these sections:

1. **Hero** — "Replay any trade. See the result." with a single CTA: "Start Backtesting"
2. **Why Section** — Film study analogy: "Most traders never review the tape"
3. **AI Backtesting Feature** — Description with mock chain card visual
4. **Pricing** — Three tiers (Free, Pro, Elite)
5. **FAQ** — Six questions covering disclaimers, accuracy, supported tickers, paywall mechanics

### 4.2 Backtesting Flow (`/backtesting`)

A 3-step vertical flow:

#### Step 1 — Pick a Moment (MomentPicker)

The user configures their backtest with four inputs:

1. **Direction (Call/Put)** — Prominent toggle at the top. Call shows green with "Bullish" label; Put shows red with "Bearish" label. This is the primary selection.
2. **Ticker** — Dropdown of 6 supported options tickers
3. **Trading Date** — Last 14 trading days (Mon-Fri only)
4. **Entry Time (ET)** — 15-minute slots from 9:30 AM to 3:45 PM ET

**Action:** "Load Chain" button fetches the options chain and auto-replays the ATM contract in the selected direction.

#### Step 2 — Pick a Contract (ChainSnapshot)

Displays the options chain at the selected moment:

- **Two side-by-side tables:** Calls (green/bullish) and Puts (red/bearish)
- **10 strikes** per side (5 below ATM, ATM marked, 4 above ATM)
- **Columns:** Strike price, Estimated Premium
- **Expiration toggle:** 0DTE or Friday Weekly
- **ATM badge** on the at-the-money strike
- **Click any row** to select a contract, then "Replay Contract" to run

This step is optional — it appears only when the user clicks "Select Another Strike" from the results. By default, the ATM contract is auto-replayed.

#### Step 3 — Your Results (ContractReplay)

Displays the full replay analysis:

- **Call/Put toggle** — Switch direction without going back (syncs with MomentPicker)
- **Contract label** — e.g., "SPY 595C" with ATM badge and expiration info
- **"Select Another Strike" button** — Returns to the chain snapshot
- **Summary Cards** (5 metrics):
  1. Entry Premium ($)
  2. P/L at Close ($ and %)
  3. Max Profit / MFE ($ and %, with time)
  4. Max Drawdown / MAE ($ and %, with time)
  5. Optimal Exit ($ and %, with time)
- **Interactive Chart** — Recharts AreaChart with:
  - View modes: P/L (%) or Premium ($)
  - Range modes: Same Day or To Expiration
  - Blue dashed reference line at breakeven/entry
  - Custom tooltips with P/L dollar, percent, and premium
- **Key Moments** — Timeline of significant trade events with icons and explanations
- **What Happened & Why** — AI or data-driven insights panel (3-5 bullets)
- **"New Backtest" button** — Resets everything

---

## 5. Data Architecture

### 5.1 Data Sources

| Source | Usage | Fallback |
|--------|-------|----------|
| **Yahoo Finance** (via `yahoo-finance2`) | Real options chains and intraday 5-min price bars | Synthetic generation |
| **Anthropic Claude API** | AI-generated trade insights | Data-driven insights engine |

A **data source badge** appears in the header: "Live Yahoo Data" (green) or "Synthetic Estimates" (yellow).

### 5.2 API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/options` | GET | Fetch normalized options chain from Yahoo Finance. Params: `symbol`, `expiration`, `strike`, `right` |
| `/api/intraday` | GET | Fetch 5-minute intraday bars. Params: `symbol`, `date` |
| `/api/insights` | POST | Generate AI or data-driven trade analysis |

### 5.3 Client-Side Data Flow

```
MomentPicker (direction + ticker + date + time)
  │
  ├─── fetchLiveChain() ──→ /api/options ──→ Yahoo Finance
  │    Falls back to synthetic generateChain()
  │
  ├─── fetchIntradayPrices() ──→ /api/intraday ──→ Yahoo Finance
  │
  ▼
ChainData { calls[], puts[], underlyingPrice, ... }
  │
  ├─── Auto-replay ATM in selected direction
  │    OR user selects specific strike
  │
  ▼
SelectedContract { ticker, date, strike, right, entryPremium, ... }
  │
  ├─── replayContract() ──→ P/L simulation with real or synthetic prices
  │
  ▼
ReplayResult { metrics, sameDayPoints, toExpirationPoints, keyMoments }
  │
  ├─── fetchInsights() ──→ /api/insights ──→ Claude AI or data-driven
  │    (async, non-blocking — replay displays immediately)
  │
  ▼
Display: SummaryCards + ReplayChart + KeyMoments + InsightsPanel
```

---

## 6. Engine Details

### 6.1 Pricing Engine (`pricing.ts`)

Dual-path option premium estimation:

- **Path A:** Simplified Black-Scholes with implied volatility smile model
- **Path B:** Delta/momentum approximation based on moneyness and Greeks
- **Consensus:** Average of both paths
- **Confidence:** Derived from agreement between paths (High/Med/Low)

Includes:
- Deterministic PRNG (`mulberry32`) seeded from ticker + date + time for reproducibility
- Base prices and volatilities for all 16 tickers (options, futures, crypto)
- Volatility smile model based on moneyness

### 6.2 Replay Engine (`replay.ts`)

Generates a realistic option premium path from entry to close:

**When real Yahoo intraday data is available:**
- Uses actual underlying prices at 5-minute intervals
- Computes Black-Scholes premiums at each tick
- Scales path to anchor at the known entry premium

**When synthetic (no real data):**
- Generates underlying price path with realistic microstructure:
  - Opening volatility burst (first 30 min)
  - Mid-day lull (lower vol)
  - Power hour momentum (last hour)
  - Random jumps and mean reversion
- Applies Black-Scholes to compute option premiums along the path

**Output metrics:**
- Entry premium
- P/L at close ($ and %)
- Maximum Favorable Excursion (MFE) — best possible profit with timestamp
- Maximum Adverse Excursion (MAE) — worst drawdown with timestamp
- Optimal exit point

**Key moments detection:**
- Entry point
- Momentum surges (>3% moves)
- Support/resistance levels
- Theta decay inflection points
- Session close

### 6.3 Chain Generation (`chain.ts`)

- 10-strike snapshot centered on ATM
- Per-ticker strike spacing ($1 for equities, $5 for ES/NQ, $1000 for BTC, etc.)
- Both calls and puts with premiums via Black-Scholes
- Confidence levels based on moneyness

### 6.4 Insights Engine (`/api/insights`)

**AI mode** (when `ANTHROPIC_API_KEY` is set):
- Uses Claude claude-haiku-4-5-20251001 model
- Prompt requests professional options desk analyst language
- References: GEX, VWAP, STRAT patterns, 9/21 EMA, gamma, theta, volume profile
- Returns 3-5 bullet points

**Data-driven fallback:**
- Analyzes underlying price structure
- GEX context estimation
- Volatility dynamics analysis
- MFE/MAE trade management evaluation
- Directional thesis verdict

---

## 7. UI/UX Specifications

### 7.1 Design System

| Token | Value |
|-------|-------|
| Background | `#0B1220` (dark navy) |
| Surface | `#0F1A2B` |
| Border | `#1E293B` |
| Text Primary | `#F1F5F9` |
| Text Secondary | `#94A3B8` |
| Text Muted | `#64748B` |
| Accent | `#3B82F6` (blue) |
| Success | `#22C55E` (green, used for Calls) |
| Danger | `#EF4444` (red, used for Puts) |
| Max Width | 1200px |
| Nav Height | 72px |
| Font | Inter |

### 7.2 Component Library

- **Framework:** Next.js 14 (App Router) with TypeScript
- **Styling:** Tailwind CSS 3.4 with custom design tokens
- **UI Components:** shadcn/ui (Button, Card, Badge, Accordion, Separator)
- **Icons:** Lucide React
- **Animations:** Framer Motion (page transitions, step reveals)
- **Charts:** Recharts (AreaChart with custom tooltips)

### 7.3 Responsive Design

- Mobile-first layout
- Chain tables stack vertically on small screens, side-by-side on `lg+`
- Form inputs stack on mobile, horizontal row on `sm+`
- Navigation collapses to hamburger menu on mobile

---

## 8. Navigation Structure

| Route | Page | Status |
|-------|------|--------|
| `/` | Landing page | Active |
| `/backtesting` | AI Backtesting tool | Active |
| `/pricing` | Pricing page | Stub |
| `/faq` | FAQ page | Stub |
| `/signin` | Sign-in page | Stub |

**Navbar links:** AI Backtesting, Pricing, FAQ + Sign in / Start Free buttons

---

## 9. Pricing Tiers

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | Limited backtests, basic chain snapshots, key moments summaries |
| **Pro** | $XX/mo | Unlimited backtesting, full key moments, AI-powered insights |
| **Elite** | $XXX/mo | Everything in Pro + highest fidelity data (future) + priority access (future) |

> Pricing values are placeholder (`$XX`, `$XXX`). Paywall is not yet implemented.

---

## 10. Technical Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| Next.js | 14.2 | App framework (App Router) |
| React | 18.3 | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.4 | Styling |
| yahoo-finance2 | 3.13 | Real market data |
| recharts | 3.7 | Charts |
| framer-motion | 11.x | Animations |
| lucide-react | latest | Icons |
| date-fns | 4.1 | Date utilities |
| @radix-ui/* | latest | Accessible primitives (accordion, dialog, separator) |
| @anthropic-ai/sdk | latest | AI insights (optional) |

---

## 11. Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | No | Enables AI-powered insights via Claude. Falls back to data-driven insights if not set. |

---

## 12. Deferred Features (Future Roadmap)

These features have been designed but are not included in the current release:

| Feature | Description | Status |
|---------|-------------|--------|
| **Guru Score Board** | Rank signal providers by performance, risk, and consistency | Deferred |
| **Guru Report Cards** | Deep-dive into individual guru trade history and outcomes | Deferred |
| **Grade My Trade** | Submit a trade for AI-powered 5-dimension grading (entry timing, exit timing, risk management, direction, profit capture) | Deferred |
| **Crypto Asset Class** | BTC, ETH, SOL, DOGE, XRP backtesting | Deferred |
| **Futures Asset Class** | ES, NQ, CL, GC, SI backtesting | Deferred |
| **Authentication** | Sign in / sign up flow | Stub exists |
| **Paywall** | Delayed paywall after meaningful usage | Not implemented |

---

## 13. Key Design Decisions

1. **Call/Put is a first-class selection** — Direction is chosen before loading the chain, not buried in the chain snapshot. This reflects how traders think: "I'm bullish on SPY" comes before "which strike?"

2. **Auto-replay ATM** — After loading the chain, the ATM contract in the user's chosen direction is automatically replayed. Users don't need to manually pick a strike to see results.

3. **Options-only for now** — Focusing on one asset class delivers a polished experience. Futures and crypto types remain in the codebase for future activation.

4. **Dual data path** — Real Yahoo Finance data when available, synthetic estimates as fallback. Users always see which source is active via the data source badge.

5. **Non-blocking insights** — The replay displays immediately; AI insights load asynchronously in the background without blocking the user.

6. **Educational framing** — Every page includes disclaimers. The product is positioned as "film study for traders," not a trading tool.
