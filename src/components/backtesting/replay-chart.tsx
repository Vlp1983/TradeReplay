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
  Line,
  ComposedChart,
} from "recharts";
import type { TimePoint, ChartRange } from "@/lib/engine/types";

interface UnderlyingPoint {
  time: string;
  label: string;
  underlyingPrice: number;
}

interface ReplayChartProps {
  sameDayPoints: TimePoint[];
  toExpirationPoints: TimePoint[];
  isMultiDay: boolean;
  entryPremium: number;
  /** Optional: theoretical theta-only price for the currently viewed day */
  thetaDecayPrice?: number;
  /** Underlying intraday bars for the currently viewed day */
  underlyingPoints?: UnderlyingPoint[];
  /** True while underlying data is loading */
  underlyingLoading?: boolean;
  /** Called to request underlying data */
  onRequestUnderlying?: () => void;
}

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  payload: TimePoint & { underlyingPrice?: number };
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  entryPremium: number;
  showUnderlying: boolean;
}

function ChartTooltip({ active, payload, label, entryPremium, showUnderlying }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const plEntry = payload.find((p) => p.dataKey === "pl_dollar");
  const underlyingEntry = payload.find((p) => p.dataKey === "underlyingPrice");
  const pt = plEntry?.payload;
  if (!pt) return null;

  const isProfit = pt.pl_dollar >= 0;
  const plColor = isProfit ? "#22C55E" : "#EF4444";
  const sign = isProfit ? "+" : "";
  const plPerShare = pt.pl_dollar / 100;

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
        {sign}${plPerShare.toFixed(2)} per share &middot; {sign}${pt.pl_dollar.toLocaleString()} per contract
      </p>
      <p className="text-[11px]" style={{ color: "rgba(246,248,255,0.45)" }}>
        ({sign}{pt.pl_pct.toFixed(1)}%)
      </p>
      <p className="text-[11px]" style={{ color: "rgba(246,248,255,0.45)" }}>
        Premium: ${pt.price.toFixed(2)} per share &middot; ${(pt.price * 100).toFixed(2)} per contract
      </p>
      {showUnderlying && underlyingEntry != null && (
        <p className="mt-1 text-[11px]" style={{ color: "rgba(246,248,255,0.4)" }}>
          Underlying: ${underlyingEntry.value.toFixed(2)}
        </p>
      )}
    </div>
  );
}

export function ReplayChart({
  sameDayPoints,
  toExpirationPoints,
  isMultiDay,
  entryPremium,
  thetaDecayPrice,
  underlyingPoints,
  underlyingLoading,
  onRequestUnderlying,
}: ReplayChartProps) {
  const [showUnderlying, setShowUnderlying] = useState(false);

  const points = sameDayPoints;

  // Merge underlying data into option points for ComposedChart
  const mergedData = useMemo(() => {
    if (!showUnderlying || !underlyingPoints?.length) {
      return points.map((p) => ({ ...p, underlyingPrice: undefined as number | undefined }));
    }
    // Build lookup by time label
    const uMap = new Map(underlyingPoints.map((u) => [u.label, u.underlyingPrice]));
    return points.map((p) => ({
      ...p,
      underlyingPrice: uMap.get(p.label) as number | undefined,
    }));
  }, [points, underlyingPoints, showUnderlying]);

  const refValue = 0; // P/L breakeven

  const { yMin, yMax, gradientOffset } = useMemo(() => {
    if (!points.length) return { yMin: 0, yMax: 0, gradientOffset: 0.5 };
    const values = points.map((p) => p.pl_dollar);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);

    const dataMin = Math.min(rawMin, refValue);
    const dataMax = Math.max(rawMax, refValue);

    const span = dataMax - dataMin || 1;
    const pad = span * 0.1;

    let offset: number;
    if (dataMax <= refValue) {
      offset = 0;
    } else if (dataMin >= refValue) {
      offset = 1;
    } else {
      offset = (dataMax - refValue) / span;
    }

    return {
      yMin: dataMin - pad,
      yMax: dataMax + pad,
      gradientOffset: Math.max(0, Math.min(1, offset)),
    };
  }, [points, refValue]);

  // Underlying Y-axis domain
  const underlyingDomain = useMemo(() => {
    if (!showUnderlying || !underlyingPoints?.length) return [0, 100];
    const prices = underlyingPoints.map((u) => u.underlyingPrice);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const pad = (max - min || 1) * 0.1;
    return [min - pad, max + pad];
  }, [showUnderlying, underlyingPoints]);

  const handleToggleUnderlying = () => {
    if (!showUnderlying && !underlyingPoints?.length && onRequestUnderlying) {
      onRequestUnderlying();
    }
    setShowUnderlying(!showUnderlying);
  };

  return (
    <div className="rounded-lg border border-border bg-bg p-4">
      {/* Controls */}
      <div className="mb-3 flex items-center justify-end">
        <button
          onClick={handleToggleUnderlying}
          disabled={underlyingLoading}
          className={`rounded-md border px-3 py-1 text-[11px] font-medium transition-colors ${
            showUnderlying
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-border text-text-muted hover:text-text-primary hover:border-border"
          } ${underlyingLoading ? "opacity-50" : ""}`}
        >
          {underlyingLoading
            ? "Loading..."
            : showUnderlying
              ? "Hide Underlying"
              : "Show Underlying"}
        </button>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart
          data={mergedData}
          margin={{ top: 8, right: showUnderlying ? 56 : 8, bottom: 4, left: 8 }}
        >
          <defs>
            <linearGradient id="chartFillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22C55E" stopOpacity={0.2} />
              <stop offset={`${gradientOffset * 100}%`} stopColor="#22C55E" stopOpacity={0.05} />
              <stop offset={`${gradientOffset * 100}%`} stopColor="#EF4444" stopOpacity={0.05} />
              <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="chartLineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22C55E" />
              <stop offset={`${gradientOffset * 100}%`} stopColor="#22C55E" />
              <stop offset={`${gradientOffset * 100}%`} stopColor="#EF4444" />
              <stop offset="100%" stopColor="#EF4444" />
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
            yAxisId="option"
            tick={{ fill: "rgba(246,248,255,0.55)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={[yMin, yMax]}
            tickFormatter={(val: number) => `$${val}`}
            width={56}
          />
          {showUnderlying && (
            <YAxis
              yAxisId="underlying"
              orientation="right"
              tick={{ fill: "rgba(246,248,255,0.3)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              domain={underlyingDomain}
              tickFormatter={(val: number) => `$${val.toFixed(0)}`}
              width={52}
            />
          )}
          <Tooltip
            content={
              <ChartTooltip
                entryPremium={entryPremium}
                showUnderlying={showUnderlying}
              />
            }
          />

          {/* Entry reference line — blue dashed */}
          <ReferenceLine
            yAxisId="option"
            y={refValue}
            stroke="#3B82F6"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            label={{
              value: "Breakeven",
              position: "left",
              fill: "#3B82F6",
              fontSize: 11,
              fontWeight: 600,
            }}
          />

          {/* Theta decay reference line */}
          {thetaDecayPrice != null && (
            <ReferenceLine
              yAxisId="option"
              y={(thetaDecayPrice - entryPremium) * 100}
              stroke="rgba(246,248,255,0.25)"
              strokeWidth={1}
              strokeDasharray="3 3"
              label={{
                value: `Theta $${thetaDecayPrice.toFixed(2)}`,
                position: "right",
                fill: "rgba(246,248,255,0.35)",
                fontSize: 10,
              }}
            />
          )}

          {/* Option P&L area */}
          <Area
            yAxisId="option"
            type="monotone"
            dataKey="pl_dollar"
            stroke="url(#chartLineGrad)"
            strokeWidth={2}
            fill="url(#chartFillGrad)"
            dot={false}
            activeDot={{
              r: 4,
              stroke: "#3B82F6",
              strokeWidth: 2,
              fill: "#0B1220",
            }}
          />

          {/* Underlying price line (secondary axis) */}
          {showUnderlying && underlyingPoints?.length && (
            <Line
              yAxisId="underlying"
              type="monotone"
              dataKey="underlyingPrice"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
