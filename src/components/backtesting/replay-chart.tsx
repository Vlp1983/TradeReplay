"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { TimePoint, ChartRange } from "@/lib/engine/types";

type ViewMode = "pl" | "price";

interface ReplayChartProps {
  sameDayPoints: TimePoint[];
  toExpirationPoints: TimePoint[];
  isMultiDay: boolean;
  entryPremium: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: TimePoint }[];
  label?: string;
}

const RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: "same_day", label: "Same Day" },
  { value: "to_expiration", label: "To Expiration" },
];

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.[0]) return null;
  const pt = payload[0].payload as TimePoint;

  const isProfit = pt.pl_dollar >= 0;
  const plColor = isProfit ? "#22C55E" : "#EF4444";
  const sign = isProfit ? "+" : "";

  return (
    <div
      className="rounded-lg border px-3 py-2"
      style={{
        backgroundColor: "#0F1A2B",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <p className="mb-1 text-[12px]" style={{ color: "rgba(246,248,255,0.55)" }}>
        {label}
      </p>
      <p className="text-[13px] font-semibold" style={{ color: plColor }}>
        {sign}${pt.pl_dollar.toLocaleString()} / {sign}{pt.pl_pct.toFixed(1)}%
      </p>
      <p className="text-[11px]" style={{ color: "rgba(246,248,255,0.45)" }}>
        Premium: ${pt.price.toFixed(2)}
      </p>
    </div>
  );
}

function PriceTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.[0]) return null;
  const pt = payload[0].payload as TimePoint;

  return (
    <div
      className="rounded-lg border px-3 py-2"
      style={{
        backgroundColor: "#0F1A2B",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <p className="mb-1 text-[12px]" style={{ color: "rgba(246,248,255,0.55)" }}>
        {label}
      </p>
      <p className="text-[13px] font-semibold" style={{ color: "#3B82F6" }}>
        ${pt.price.toFixed(2)}
      </p>
    </div>
  );
}

export function ReplayChart({
  sameDayPoints,
  toExpirationPoints,
  isMultiDay,
  entryPremium,
}: ReplayChartProps) {
  const [view, setView] = useState<ViewMode>("pl");
  const [range, setRange] = useState<ChartRange>("same_day");

  const points = range === "same_day" ? sameDayPoints : toExpirationPoints;

  const dataKey = view === "pl" ? "pl_dollar" : "price";

  // Tight Y-axis domain — pad 15% above and below the actual data range
  const { yMin, yMax } = useMemo(() => {
    if (!points.length) return { yMin: 0, yMax: 0 };
    const values = points.map((p) => p[dataKey] as number);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const pad = span * 0.15;
    return {
      yMin: Math.floor(min - pad),
      yMax: Math.ceil(max + pad),
    };
  }, [points, dataKey]);

  const lineColor = "#3B82F6";

  // Entry value for the reference line
  // P/L view: entry is at $0 (breakeven)
  // Premium view: entry is at the actual entry premium
  const entryValue = view === "pl" ? 0 : entryPremium;

  return (
    <div className="rounded-lg border border-border bg-bg p-4">
      {/* Toggle controls */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {/* View toggle */}
        <div className="flex rounded-md border border-border p-0.5">
          <button
            onClick={() => setView("pl")}
            className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
              view === "pl"
                ? "bg-accent text-white"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            P/L
          </button>
          <button
            onClick={() => setView("price")}
            className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
              view === "price"
                ? "bg-accent text-white"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Premium
          </button>
        </div>

        {/* Range toggle */}
        {isMultiDay && (
          <div className="flex rounded-md border border-border p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  range === opt.value
                    ? "bg-accent text-white"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart
          data={points}
          margin={{ top: 8, right: 8, bottom: 4, left: 8 }}
        >
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.18} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "rgba(246,248,255,0.55)", fontSize: 11 }}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={60}
          />
          <YAxis
            tick={{ fill: "rgba(246,248,255,0.55)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={[yMin, yMax]}
            tickFormatter={(val: number) =>
              view === "pl" ? `$${val}` : `$${val}`
            }
            width={56}
          />
          <Tooltip
            content={view === "pl" ? <CustomTooltip /> : <PriceTooltip />}
          />

          {/* Entry reference line — blue dashed */}
          <ReferenceLine
            y={entryValue}
            stroke="#3B82F6"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            label={{
              value: view === "pl" ? "Breakeven" : `Entry $${entryPremium.toFixed(2)}`,
              position: "left",
              fill: "#3B82F6",
              fontSize: 11,
              fontWeight: 600,
            }}
          />

          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={lineColor}
            strokeWidth={2}
            fill="url(#chartGrad)"
            dot={false}
            activeDot={{
              r: 4,
              stroke: lineColor,
              strokeWidth: 2,
              fill: "#0B1220",
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
