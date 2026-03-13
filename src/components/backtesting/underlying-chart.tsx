"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export interface UnderlyingPoint {
  time: string;
  label: string;
  underlyingPrice: number;
}

interface UnderlyingChartProps {
  points: UnderlyingPoint[];
  /** e.g. "SPY" */
  ticker: string;
  /** e.g. "Feb 27" */
  dateLabel: string;
}

interface TooltipPayloadEntry {
  value: number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function UnderlyingTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const price = payload[0].value;
  return (
    <div
      className="rounded-lg border px-3 py-2"
      style={{
        backgroundColor: "#0F1A2B",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <p className="mb-0.5 text-[12px]" style={{ color: "rgba(246,248,255,0.55)" }}>
        {label}
      </p>
      <p className="text-[13px] font-semibold" style={{ color: "rgba(246,248,255,0.85)" }}>
        ${price.toFixed(2)}
      </p>
    </div>
  );
}

export function UnderlyingChart({ points, ticker, dateLabel }: UnderlyingChartProps) {
  const { yMin, yMax } = useMemo(() => {
    if (!points.length) return { yMin: 0, yMax: 100 };
    const prices = points.map((p) => p.underlyingPrice);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const pad = (max - min || 1) * 0.1;
    return { yMin: min - pad, yMax: max + pad };
  }, [points]);

  if (!points.length) return null;

  return (
    <div className="rounded-lg border border-border bg-bg p-4">
      <p className="mb-2 text-[13px] font-semibold text-text-secondary">
        {ticker} Price — {dateLabel}
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart
          data={points}
          margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
        >
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
            tickFormatter={(val: number) => `$${val.toFixed(0)}`}
            width={56}
          />
          <Tooltip content={<UnderlyingTooltip />} />
          <Line
            type="monotone"
            dataKey="underlyingPrice"
            stroke="rgba(255,255,255,0.7)"
            strokeWidth={1.5}
            dot={false}
            activeDot={{
              r: 3,
              stroke: "rgba(255,255,255,0.5)",
              strokeWidth: 2,
              fill: "#0B1220",
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
