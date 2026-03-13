"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import type { TimePoint } from "@/lib/engine/types";

interface ReplayChartProps {
  sameDayPoints: TimePoint[];
  toExpirationPoints: TimePoint[];
  isMultiDay: boolean;
  entryPremium: number;
  /** Optional: theoretical theta-only price for the currently viewed day */
  thetaDecayPrice?: number;
  /** Whether viewing the entry day (affects time range start) */
  isEntryDay?: boolean;
  /** Entry time in HH:MM format (ET) — used to set chart start on entry day */
  entryTime?: string;
}

interface TooltipPayloadEntry {
  dataKey: string;
  value: number;
  payload: TimePoint;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  entryPremium: number;
}

function ChartTooltip({ active, payload, label, entryPremium }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const plEntry = payload.find((p) => p.dataKey === "pl_dollar");
  const pt = plEntry?.payload;
  if (!pt) return null;

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
        {sign}${Math.abs(pt.pl_dollar).toLocaleString()}
      </p>
      <p className="text-[11px]" style={{ color: "rgba(246,248,255,0.45)" }}>
        ({sign}{pt.pl_pct.toFixed(1)}%)
      </p>
      <p className="text-[11px]" style={{ color: "rgba(246,248,255,0.45)" }}>
        Premium: ${(pt.price * 100).toFixed(2)}
      </p>
    </div>
  );
}

export function ReplayChart({
  sameDayPoints,
  entryPremium,
  thetaDecayPrice,
  isEntryDay = true,
  entryTime,
}: ReplayChartProps) {
  const points = sameDayPoints;
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

  return (
    <div className="rounded-lg border border-border bg-bg p-4">
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart
          data={points}
          margin={{ top: 8, right: 8, bottom: 4, left: 8 }}
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
            tick={{ fill: "rgba(246,248,255,0.55)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={[yMin, yMax]}
            tickFormatter={(val: number) => `$${val}`}
            width={56}
          />
          <Tooltip
            content={
              <ChartTooltip entryPremium={entryPremium} />
            }
          />

          {/* Entry reference line — blue dashed */}
          <ReferenceLine
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

          {/* Entry point marker dot */}
          {points.length > 0 && (
            <ReferenceDot
              x={points[0].label}
              y={points[0].pl_dollar}
              r={5}
              fill="#3B82F6"
              stroke="#0B1220"
              strokeWidth={2}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
