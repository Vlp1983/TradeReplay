"use client";

import { useState } from "react";
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
import type { TimePoint, ChartView, ChartRange } from "@/lib/engine/types";

interface ReplayChartProps {
  sameDayPoints: TimePoint[];
  toExpirationPoints: TimePoint[];
  isMultiDay: boolean;
}

const VIEW_OPTIONS: { value: ChartView; label: string }[] = [
  { value: "pl_pct", label: "P/L %" },
  { value: "pl_dollar", label: "P/L $" },
  { value: "price", label: "Price" },
];

const RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: "same_day", label: "Same Day" },
  { value: "to_expiration", label: "To Expiration" },
];

export function ReplayChart({
  sameDayPoints,
  toExpirationPoints,
  isMultiDay,
}: ReplayChartProps) {
  const [view, setView] = useState<ChartView>("pl_pct");
  const [range, setRange] = useState<ChartRange>("same_day");

  const points = range === "same_day" ? sameDayPoints : toExpirationPoints;

  const dataKey =
    view === "pl_pct"
      ? "pl_pct"
      : view === "pl_dollar"
        ? "pl_dollar"
        : "price";

  const formatValue = (val: number) => {
    if (view === "pl_pct") return `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`;
    if (view === "pl_dollar") return `${val >= 0 ? "+" : ""}$${val}`;
    return `$${val.toFixed(2)}`;
  };

  const isPositive = (points[points.length - 1]?.[dataKey] ?? 0) >= (points[0]?.[dataKey] ?? 0);
  const lineColor = view === "price" ? "#3B82F6" : isPositive ? "#22C55E" : "#EF4444";

  return (
    <div className="rounded-lg border border-border bg-bg p-4">
      {/* Toggle controls */}
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        {/* View toggle */}
        <div className="flex rounded-md border border-border p-0.5">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setView(opt.value)}
              className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                view === opt.value
                  ? "bg-accent text-white"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
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
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart
          data={points}
          margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
        >
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
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
            tickFormatter={(val) =>
              view === "pl_pct"
                ? `${val}%`
                : view === "pl_dollar"
                  ? `$${val}`
                  : `$${val}`
            }
            width={60}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0F1A2B",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "8px",
              fontSize: 13,
            }}
            labelStyle={{ color: "rgba(246,248,255,0.72)" }}
            formatter={(value?: number) => [formatValue(value ?? 0), view === "price" ? "Premium" : "P/L"]}
          />
          {view !== "price" && (
            <ReferenceLine
              y={0}
              stroke="rgba(255,255,255,0.12)"
              strokeDasharray="3 3"
            />
          )}
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
