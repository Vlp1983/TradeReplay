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
  /** Optional: theoretical theta-only price for the currently viewed day */
  thetaDecayPrice?: number;
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
        {sign}${plPerShare.toFixed(2)} per share · {sign}${pt.pl_dollar.toLocaleString()} per contract
      </p>
      <p className="text-[11px]" style={{ color: "rgba(246,248,255,0.45)" }}>
        ({sign}{pt.pl_pct.toFixed(1)}%)
      </p>
      <p className="text-[11px]" style={{ color: "rgba(246,248,255,0.45)" }}>
        Premium: ${pt.price.toFixed(2)} per share · ${(pt.price * 100).toFixed(2)} per contract
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
        ${pt.price.toFixed(2)} per share · ${(pt.price * 100).toFixed(2)} per contract
      </p>
    </div>
  );
}

export function ReplayChart({
  sameDayPoints,
  toExpirationPoints,
  isMultiDay,
  entryPremium,
  thetaDecayPrice,
}: ReplayChartProps) {
  const [view, setView] = useState<ViewMode>("pl");
  const [range, setRange] = useState<ChartRange>("same_day");

  const points = range === "same_day" ? sameDayPoints : toExpirationPoints;

  const dataKey = view === "pl" ? "pl_dollar" : "price";

  // Reference value: breakeven at $0 for P/L, entry premium for price view
  // Coloring rule: above ref = GREEN (profit), below ref = RED (loss)
  // This is purely option price vs entry — identical logic for calls and puts
  const refValue = view === "pl" ? 0 : entryPremium;

  // Y-axis domain and gradient offset.
  //
  // The gradient offset MUST be computed from the data range (including refValue)
  // because SVG linearGradient with gradientUnits="objectBoundingBox" (default)
  // maps to the element's bounding box — which corresponds to the data extent,
  // NOT the Y axis domain.
  const { yMin, yMax, gradientOffset } = useMemo(() => {
    if (!points.length) return { yMin: 0, yMax: 0, gradientOffset: 0.5 };
    const values = points.map((p) => p[dataKey] as number);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);

    // Include refValue in the range so the reference line is always visible
    const dataMin = Math.min(rawMin, refValue);
    const dataMax = Math.max(rawMax, refValue);

    const span = dataMax - dataMin || 1;
    const pad = span * 0.1;

    // Gradient offset: position of refValue within data range
    // 0 = top of chart (dataMax), 1 = bottom (dataMin)
    // GREEN above this point, RED below
    let offset: number;
    if (dataMax <= refValue) {
      offset = 0; // all data at or below ref → entire chart red
    } else if (dataMin >= refValue) {
      offset = 1; // all data at or above ref → entire chart green
    } else {
      offset = (dataMax - refValue) / span;
    }

    return {
      yMin: dataMin - pad,
      yMax: dataMax + pad,
      gradientOffset: Math.max(0, Math.min(1, offset)),
    };
  }, [points, dataKey, refValue]);

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
            {/* Green/red fill gradient — green above entry, red below */}
            <linearGradient id="chartFillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22C55E" stopOpacity={0.2} />
              <stop offset={`${gradientOffset * 100}%`} stopColor="#22C55E" stopOpacity={0.05} />
              <stop offset={`${gradientOffset * 100}%`} stopColor="#EF4444" stopOpacity={0.05} />
              <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
            {/* Green/red stroke gradient */}
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
            content={view === "pl" ? <CustomTooltip /> : <PriceTooltip />}
          />

          {/* Entry reference line — blue dashed */}
          <ReferenceLine
            y={refValue}
            stroke="#3B82F6"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            label={{
              value: view === "pl" ? "Breakeven" : `Entry $${entryPremium.toFixed(2)}/sh`,
              position: "left",
              fill: "#3B82F6",
              fontSize: 11,
              fontWeight: 600,
            }}
          />

          {/* Theta decay reference line — dotted, only in premium view */}
          {thetaDecayPrice != null && view === "price" && (
            <ReferenceLine
              y={thetaDecayPrice}
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

          <Area
            type="monotone"
            dataKey={dataKey}
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
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
