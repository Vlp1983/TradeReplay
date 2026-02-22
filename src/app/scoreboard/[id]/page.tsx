"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Shield,
  Zap,
  Flame,
  Target,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/landing/navbar";
import {
  getGuruById,
  getRankedGurus,
  type Guru,
  type TimePeriod,
  type RiskLevel,
  type Trade,
  type Category,
} from "@/lib/scoreboard-data";

/* ─── Helpers ─── */

function riskVariant(risk: RiskLevel): "success" | "outline" | "danger" {
  if (risk === "Low") return "success";
  if (risk === "High") return "danger";
  return "outline";
}

function winRateColor(rate: number) {
  if (rate >= 65) return "text-green-400";
  if (rate >= 50) return "text-yellow-400";
  return "text-red-400";
}

function categoryBadge(cat: Category) {
  const labels: Record<Category, string> = {
    options: "Options",
    crypto: "Crypto",
    futures: "Futures",
  };
  const colors: Record<Category, string> = {
    options: "bg-blue-500/15 text-blue-400",
    crypto: "bg-purple-500/15 text-purple-400",
    futures: "bg-amber-500/15 text-amber-400",
  };
  return (
    <span
      key={cat}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${colors[cat]}`}
    >
      {labels[cat]}
    </span>
  );
}

function Avatar({ name, url }: { name: string; url: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="h-16 w-16 rounded-full border-2 border-border object-cover"
      />
    );
  }
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const hue = name.split("").reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-border text-lg font-bold"
      style={{
        backgroundColor: `hsl(${hue}, 45%, 25%)`,
        color: `hsl(${hue}, 70%, 75%)`,
      }}
    >
      {initials}
    </div>
  );
}

type TradeSortKey = "date" | "ticker" | "returnPct" | "result";

/* ─── Page ─── */

export default function GuruProfilePage() {
  const params = useParams<{ id: string }>();
  const guru = getGuruById(params.id);

  const [period, setPeriod] = useState<TimePeriod>("30d");
  const [tradeSortKey, setTradeSortKey] = useState<TradeSortKey>("date");
  const [tradeSortAsc, setTradeSortAsc] = useState(false);

  if (!guru) {
    return (
      <>
        <Navbar />
        <main className="flex min-h-screen items-center justify-center px-4 pt-[96px]">
          <div className="text-center">
            <h1 className="mb-2 text-xl font-bold text-text-primary">
              Guru not found
            </h1>
            <p className="mb-4 text-text-muted">
              This profile doesn&apos;t exist.
            </p>
            <Button asChild>
              <Link href="/scoreboard">Back to Score Board</Link>
            </Button>
          </div>
        </main>
      </>
    );
  }

  const stats = guru.stats[period];

  // Find rank in overall board
  const allRanked = getRankedGurus("all", period);
  const rank = allRanked.findIndex((g) => g.id === guru.id) + 1;

  const wins = stats.trades.filter((t) => t.result === "Win").length;
  const losses = stats.trades.length - wins;

  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 pb-16 pt-[96px] md:px-6">
        <div className="mx-auto max-w-content">
          {/* Back link */}
          <div className="mb-6">
            <Button variant="ghost" size="sm" asChild className="gap-1.5">
              <Link href="/scoreboard">
                <ArrowLeft className="h-4 w-4" />
                Back to Score Board
              </Link>
            </Button>
          </div>

          {/* Profile header */}
          <div className="mb-6 rounded-[14px] border border-border bg-surface p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <Avatar name={guru.name} url={guru.avatarUrl} />
                <div>
                  <h1 className="text-xl font-bold text-text-primary">
                    {guru.name}
                  </h1>
                  <p className="mb-2 text-[13px] text-accent">{guru.handle}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {guru.categories.map((c) => categoryBadge(c))}
                    <span className="text-[12px] text-text-muted">
                      Member since {guru.joinedDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Rank badge */}
              {rank > 0 && (
                <div className="rounded-lg border border-border bg-bg px-4 py-2 text-center">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                    Overall Rank
                  </span>
                  <p className="text-2xl font-bold text-accent">#{rank}</p>
                </div>
              )}
            </div>

            <p className="mt-4 text-[13px] leading-relaxed text-text-secondary">
              {guru.bio}
            </p>
          </div>

          {/* Period toggle */}
          <div className="mb-6 flex rounded-lg border border-border p-0.5 w-fit">
            {(
              [
                { key: "30d" as TimePeriod, label: "Current (30-Day)" },
                { key: "all" as TimePeriod, label: "All-Time" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setPeriod(tab.key)}
                className={`rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  period === tab.key
                    ? "bg-accent/15 text-accent"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Stats grid */}
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              icon={<TrendingUp className="h-4 w-4 text-green-400" />}
              label="Win Rate"
              value={`${stats.winRate}%`}
              valueClass={winRateColor(stats.winRate)}
            />
            <StatCard
              icon={<Zap className="h-4 w-4 text-yellow-400" />}
              label="Avg Return"
              value={`+${stats.avgReturn}%`}
              valueClass="text-green-400"
            />
            <StatCard
              icon={<Target className="h-4 w-4 text-blue-400" />}
              label="Total Alerts"
              value={`${stats.totalAlerts}`}
            />
            <StatCard
              icon={<Shield className="h-4 w-4 text-blue-400" />}
              label="Consistency"
              value={`${stats.consistency}/100`}
            />
            <StatCard
              icon={<Flame className="h-4 w-4 text-orange-400" />}
              label="Win Streak"
              value={`${stats.streak}`}
            />
            <div className="rounded-lg border border-border bg-surface px-4 py-3">
              <div className="mb-1 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-text-muted" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
                  Risk Level
                </span>
              </div>
              <Badge
                variant={riskVariant(stats.riskLevel)}
                className="mt-1 text-[11px]"
              >
                {stats.riskLevel}
              </Badge>
            </div>
          </div>

          {/* W/L summary bar */}
          <div className="mb-6 rounded-[14px] border border-border bg-surface p-4">
            <div className="mb-2 flex items-center justify-between text-[13px]">
              <span className="font-medium text-text-primary">
                Win / Loss Breakdown
              </span>
              <span className="text-text-muted">
                {wins}W / {losses}L ({stats.trades.length} trades)
              </span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full">
              <div
                className="bg-green-500 transition-all"
                style={{
                  width: `${stats.trades.length > 0 ? (wins / stats.trades.length) * 100 : 0}%`,
                }}
              />
              <div
                className="bg-red-500 transition-all"
                style={{
                  width: `${stats.trades.length > 0 ? (losses / stats.trades.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mb-6 rounded-[14px] border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
              <p className="text-[12px] leading-relaxed text-text-muted">
                TradeReplay is not affiliated with, sponsored by, or endorsed by{" "}
                {guru.name}. Rankings and trade data are generated objectively
                based on publicly available information. Past performance does
                not guarantee future results. This is not financial advice.
              </p>
            </div>
          </div>

          {/* Full trade table */}
          <TradeTable
            trades={stats.trades}
            sortKey={tradeSortKey}
            sortAsc={tradeSortAsc}
            onSort={(key) => {
              if (tradeSortKey === key) {
                setTradeSortAsc(!tradeSortAsc);
              } else {
                setTradeSortKey(key);
                setTradeSortAsc(key === "date" ? false : true);
              }
            }}
          />
        </div>
      </main>
    </>
  );
}

/* ─── Trade Table (full, sortable) ─── */

function TradeTable({
  trades,
  sortKey,
  sortAsc,
  onSort,
}: {
  trades: Trade[];
  sortKey: TradeSortKey;
  sortAsc: boolean;
  onSort: (key: TradeSortKey) => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    const arr = [...trades];
    arr.sort((a, b) => {
      let diff = 0;
      if (sortKey === "date") diff = a.date.localeCompare(b.date);
      else if (sortKey === "ticker") diff = a.ticker.localeCompare(b.ticker);
      else if (sortKey === "returnPct") diff = a.returnPct - b.returnPct;
      else if (sortKey === "result") diff = a.result.localeCompare(b.result);
      return sortAsc ? diff : -diff;
    });
    return arr;
  }, [trades, sortKey, sortAsc]);

  const visible = showAll ? sorted : sorted.slice(0, 20);

  function SortIcon({ col }: { col: TradeSortKey }) {
    if (sortKey !== col)
      return <ChevronDown className="ml-0.5 h-3 w-3 opacity-30" />;
    return sortAsc ? (
      <ChevronUp className="ml-0.5 h-3 w-3 text-accent" />
    ) : (
      <ChevronDown className="ml-0.5 h-3 w-3 text-accent" />
    );
  }

  return (
    <div className="rounded-[14px] border border-border bg-surface">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-[15px] font-semibold text-text-primary">
          All Trades
        </h3>
        <span className="text-[12px] text-text-muted">
          {trades.length} trades total
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-y border-border bg-bg/50">
              <th
                className="cursor-pointer select-none px-4 py-2.5 font-medium text-text-muted"
                onClick={() => onSort("date")}
              >
                <span className="inline-flex items-center">
                  <Calendar className="mr-1.5 h-3 w-3" />
                  Date <SortIcon col="date" />
                </span>
              </th>
              <th
                className="cursor-pointer select-none px-4 py-2.5 font-medium text-text-muted"
                onClick={() => onSort("ticker")}
              >
                <span className="inline-flex items-center">
                  Ticker <SortIcon col="ticker" />
                </span>
              </th>
              <th className="hidden px-4 py-2.5 font-medium text-text-muted sm:table-cell">
                Direction
              </th>
              <th className="hidden px-4 py-2.5 font-medium text-text-muted sm:table-cell">
                Entry
              </th>
              <th className="hidden px-4 py-2.5 font-medium text-text-muted sm:table-cell">
                Exit
              </th>
              <th
                className="cursor-pointer select-none px-4 py-2.5 font-medium text-text-muted"
                onClick={() => onSort("returnPct")}
              >
                <span className="inline-flex items-center">
                  Return <SortIcon col="returnPct" />
                </span>
              </th>
              <th
                className="cursor-pointer select-none px-4 py-2.5 font-medium text-text-muted"
                onClick={() => onSort("result")}
              >
                <span className="inline-flex items-center">
                  Result <SortIcon col="result" />
                </span>
              </th>
              <th className="hidden px-4 py-2.5 font-medium text-text-muted md:table-cell">
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((trade) => (
              <tr
                key={trade.id}
                className="border-b border-border transition-colors last:border-0 hover:bg-bg/30"
              >
                <td className="px-4 py-2.5 font-mono text-text-muted">
                  {trade.date}
                </td>
                <td className="px-4 py-2.5 font-medium text-text-primary">
                  {trade.ticker}
                </td>
                <td className="hidden px-4 py-2.5 sm:table-cell">
                  <span className="inline-flex items-center gap-1 text-text-secondary">
                    {trade.direction === "Long" ? (
                      <ArrowUpRight className="h-3 w-3 text-green-400" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-red-400" />
                    )}
                    {trade.direction}
                  </span>
                </td>
                <td className="hidden px-4 py-2.5 font-mono text-text-secondary sm:table-cell">
                  {trade.entry.toLocaleString()}
                </td>
                <td className="hidden px-4 py-2.5 font-mono text-text-secondary sm:table-cell">
                  {trade.exit.toLocaleString()}
                </td>
                <td
                  className={`px-4 py-2.5 font-mono font-semibold ${
                    trade.returnPct >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {trade.returnPct > 0 ? "+" : ""}
                  {trade.returnPct}%
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      trade.result === "Win"
                        ? "bg-green-500/15 text-green-400"
                        : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {trade.result}
                  </span>
                </td>
                <td className="hidden px-4 py-2.5 text-text-muted md:table-cell">
                  {trade.notes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {trades.length > 20 && (
        <div className="border-t border-border px-4 py-3">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-[12px] font-medium text-accent hover:underline"
          >
            {showAll ? "Show less" : `Show all ${trades.length} trades`}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Stat Card ─── */

function StatCard({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="mb-1 flex items-center gap-2">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
          {label}
        </span>
      </div>
      <span className={`text-lg font-bold ${valueClass ?? "text-text-primary"}`}>
        {value}
      </span>
    </div>
  );
}
