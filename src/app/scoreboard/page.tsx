"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp, Trophy, TrendingUp, Shield, Zap, Flame } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/landing/navbar";
import {
  getRankedGurus,
  type Category,
  type TimePeriod,
  type Grade,
  type RiskLevel,
  type Guru,
} from "@/lib/scoreboard-data";

type SortKey = "rank" | "winRate" | "avgReturn" | "totalAlerts" | "consistency";

const categoryTabs: { key: Category | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "options", label: "Options" },
  { key: "crypto", label: "Crypto" },
  { key: "futures", label: "Futures" },
];

const periodTabs: { key: TimePeriod; label: string }[] = [
  { key: "30d", label: "30-Day" },
  { key: "90d", label: "90-Day" },
  { key: "all", label: "All-Time" },
];

function gradeColor(grade: Grade) {
  if (grade === "A+" || grade === "A") return "text-green-400";
  if (grade === "A-" || grade === "B+") return "text-emerald-400";
  if (grade === "B" || grade === "B-") return "text-yellow-400";
  return "text-orange-400";
}

function gradeBg(grade: Grade) {
  if (grade === "A+" || grade === "A") return "bg-green-500/15";
  if (grade === "A-" || grade === "B+") return "bg-emerald-500/15";
  if (grade === "B" || grade === "B-") return "bg-yellow-500/15";
  return "bg-orange-500/15";
}

function riskVariant(risk: RiskLevel): "success" | "outline" | "danger" {
  if (risk === "Low") return "success";
  if (risk === "High") return "danger";
  return "outline";
}

function rankIcon(rank: number) {
  if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-400" />;
  if (rank === 2) return <Trophy className="h-4 w-4 text-gray-300" />;
  if (rank === 3) return <Trophy className="h-4 w-4 text-amber-600" />;
  return null;
}

function categoryBadge(cat: Category) {
  const labels: Record<Category, string> = { options: "Options", crypto: "Crypto", futures: "Futures" };
  const colors: Record<Category, string> = {
    options: "bg-blue-500/15 text-blue-400",
    crypto: "bg-purple-500/15 text-purple-400",
    futures: "bg-amber-500/15 text-amber-400",
  };
  return (
    <span
      key={cat}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors[cat]}`}
    >
      {labels[cat]}
    </span>
  );
}

export default function ScoreboardPage() {
  const [category, setCategory] = useState<Category | "all">("all");
  const [period, setPeriod] = useState<TimePeriod>("30d");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const ranked = useMemo(() => getRankedGurus(category, period), [category, period]);

  const sorted = useMemo(() => {
    if (sortKey === "rank") return sortAsc ? ranked : [...ranked].reverse();
    return [...ranked].sort((a, b) => {
      const as = a.stats[period];
      const bs = b.stats[period];
      let diff = 0;
      if (sortKey === "winRate") diff = as.winRate - bs.winRate;
      else if (sortKey === "avgReturn") diff = as.avgReturn - bs.avgReturn;
      else if (sortKey === "totalAlerts") diff = as.totalAlerts - bs.totalAlerts;
      else if (sortKey === "consistency") diff = as.consistency - bs.consistency;
      return sortAsc ? diff : -diff;
    });
  }, [ranked, sortKey, sortAsc, period]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "rank");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronDown className="ml-0.5 h-3 w-3 opacity-30" />;
    return sortAsc ? (
      <ChevronUp className="ml-0.5 h-3 w-3 text-accent" />
    ) : (
      <ChevronDown className="ml-0.5 h-3 w-3 text-accent" />
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 pb-16 pt-[96px] md:px-6">
        <div className="mx-auto max-w-content">
          {/* Page header */}
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <h1 className="text-2xl font-bold text-text-primary">
                Guru Score Board
              </h1>
            </div>
            <p className="text-[15px] leading-relaxed text-text-secondary">
              Rankings of signal providers by accuracy, risk discipline,
              consistency, and clarity. Find the gurus that match your trading
              style.
            </p>
          </div>

          {/* Filters bar */}
          <div className="mb-6 rounded-[14px] border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Category tabs */}
              <div className="flex rounded-lg border border-border p-0.5">
                {categoryTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => { setCategory(tab.key); setSortKey("rank"); setSortAsc(true); }}
                    className={`rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                      category === tab.key
                        ? "bg-accent/15 text-accent"
                        : "text-text-muted hover:text-text-primary"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Period tabs */}
              <div className="flex rounded-lg border border-border p-0.5">
                {periodTabs.map((tab) => (
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
            </div>
          </div>

          {/* Scoreboard table */}
          <div className="rounded-[14px] border border-border bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-bg/50">
                    <th
                      className="cursor-pointer select-none px-4 py-3 font-medium text-text-muted"
                      onClick={() => handleSort("rank")}
                    >
                      <span className="inline-flex items-center">
                        # <SortIcon col="rank" />
                      </span>
                    </th>
                    <th className="px-4 py-3 font-medium text-text-muted">Guru</th>
                    <th className="px-4 py-3 font-medium text-text-muted">Grade</th>
                    <th
                      className="cursor-pointer select-none px-4 py-3 font-medium text-text-muted"
                      onClick={() => handleSort("winRate")}
                    >
                      <span className="inline-flex items-center">
                        Win Rate <SortIcon col="winRate" />
                      </span>
                    </th>
                    <th
                      className="hidden cursor-pointer select-none px-4 py-3 font-medium text-text-muted sm:table-cell"
                      onClick={() => handleSort("avgReturn")}
                    >
                      <span className="inline-flex items-center">
                        Avg Return <SortIcon col="avgReturn" />
                      </span>
                    </th>
                    <th
                      className="hidden cursor-pointer select-none px-4 py-3 font-medium text-text-muted md:table-cell"
                      onClick={() => handleSort("totalAlerts")}
                    >
                      <span className="inline-flex items-center">
                        Alerts <SortIcon col="totalAlerts" />
                      </span>
                    </th>
                    <th
                      className="hidden cursor-pointer select-none px-4 py-3 font-medium text-text-muted md:table-cell"
                      onClick={() => handleSort("consistency")}
                    >
                      <span className="inline-flex items-center">
                        Consistency <SortIcon col="consistency" />
                      </span>
                    </th>
                    <th className="px-4 py-3 font-medium text-text-muted">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((guru) => {
                    const s = guru.stats[period];
                    const isExpanded = expandedId === guru.id;
                    return (
                      <GuruRow
                        key={guru.id}
                        guru={guru}
                        rank={guru.rank}
                        stats={s}
                        isExpanded={isExpanded}
                        onToggle={() =>
                          setExpandedId(isExpanded ? null : guru.id)
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="border-t border-border px-4 py-3">
              <p className="text-[12px] text-text-muted">
                Showing {sorted.length} guru{sorted.length !== 1 ? "s" : ""}.
                Rankings update daily based on verified alert outcomes.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

/* ─── Guru Row ─── */

function GuruRow({
  guru,
  rank,
  stats,
  isExpanded,
  onToggle,
}: {
  guru: Guru & { rank: number };
  rank: number;
  stats: Guru["stats"]["30d"];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-bg/40"
        onClick={onToggle}
      >
        {/* Rank */}
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1.5 font-mono text-text-muted">
            {rankIcon(rank)}
            {rank}
          </span>
        </td>

        {/* Name + handle + categories */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div>
              <span className="font-medium text-text-primary">{guru.name}</span>
              <span className="ml-1.5 text-[12px] text-text-muted">{guru.handle}</span>
            </div>
            <span className="hidden gap-1 sm:inline-flex">
              {guru.categories.map((c) => categoryBadge(c))}
            </span>
          </div>
        </td>

        {/* Grade */}
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${gradeBg(stats.grade)} ${gradeColor(stats.grade)}`}
          >
            {stats.grade}
          </span>
        </td>

        {/* Win Rate */}
        <td className="px-4 py-3 font-mono text-text-secondary">
          {stats.winRate}%
        </td>

        {/* Avg Return */}
        <td className="hidden px-4 py-3 font-mono text-green-400 sm:table-cell">
          +{stats.avgReturn}%
        </td>

        {/* Total Alerts */}
        <td className="hidden px-4 py-3 font-mono text-text-secondary md:table-cell">
          {stats.totalAlerts}
        </td>

        {/* Consistency */}
        <td className="hidden px-4 py-3 md:table-cell">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${stats.consistency}%` }}
              />
            </div>
            <span className="font-mono text-[12px] text-text-muted">
              {stats.consistency}
            </span>
          </div>
        </td>

        {/* Risk */}
        <td className="px-4 py-3">
          <Badge variant={riskVariant(stats.riskLevel)} className="text-[10px]">
            {stats.riskLevel}
          </Badge>
        </td>
      </tr>

      {/* Expanded detail row */}
      <AnimatePresence>
        {isExpanded && (
          <tr>
            <td colSpan={8} className="p-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="border-b border-border bg-bg/60 px-4 py-4 sm:px-6">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Bio */}
                    <div className="sm:col-span-2 lg:col-span-4">
                      <p className="text-[13px] leading-relaxed text-text-secondary">
                        {guru.bio}
                      </p>
                    </div>

                    {/* Stat cards */}
                    <StatCard
                      icon={<TrendingUp className="h-4 w-4 text-green-400" />}
                      label="Win Rate"
                      value={`${stats.winRate}%`}
                    />
                    <StatCard
                      icon={<Zap className="h-4 w-4 text-yellow-400" />}
                      label="Avg Return"
                      value={`+${stats.avgReturn}%`}
                    />
                    <StatCard
                      icon={<Shield className="h-4 w-4 text-blue-400" />}
                      label="Consistency"
                      value={`${stats.consistency}/100`}
                    />
                    <StatCard
                      icon={<Flame className="h-4 w-4 text-orange-400" />}
                      label="Win Streak"
                      value={`${stats.streak} in a row`}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="flex gap-1.5">
                      {guru.categories.map((c) => categoryBadge(c))}
                    </div>
                    <span className="text-[12px] font-medium text-accent">
                      {guru.handle}
                    </span>
                    <span className="text-[12px] text-text-muted">
                      Member since {guru.joinedDate}
                    </span>
                    <span className="text-[12px] text-text-muted">
                      {stats.totalAlerts} total alerts
                    </span>
                  </div>
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Stat Card ─── */

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="mb-1 flex items-center gap-2">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
          {label}
        </span>
      </div>
      <span className="text-lg font-bold text-text-primary">{value}</span>
    </div>
  );
}
