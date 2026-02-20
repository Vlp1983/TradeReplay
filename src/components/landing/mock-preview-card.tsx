"use client";

import { Badge } from "@/components/ui/badge";

export function MockPreviewCard() {
  return (
    <div className="relative">
      {/* Subtle radial glow */}
      <div className="absolute -inset-12 rounded-full bg-accent/5 blur-3xl" />

      <div className="relative rounded-[14px] border border-border bg-surface p-5">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">
            Options Backtest &mdash; SPY
          </span>
          <Badge variant="outline" className="text-[11px]">
            Estimated (MVP)
          </Badge>
        </div>

        {/* Mini chart placeholder */}
        <div className="relative mb-4 h-36 overflow-hidden rounded-lg bg-bg">
          <svg
            viewBox="0 0 400 140"
            fill="none"
            className="h-full w-full"
            preserveAspectRatio="none"
          >
            {/* Grid lines */}
            <line x1="0" y1="35" x2="400" y2="35" stroke="rgba(255,255,255,0.04)" />
            <line x1="0" y1="70" x2="400" y2="70" stroke="rgba(255,255,255,0.04)" />
            <line x1="0" y1="105" x2="400" y2="105" stroke="rgba(255,255,255,0.04)" />

            {/* Area fill */}
            <path
              d="M0 110 L30 100 L60 95 L90 85 L120 70 L150 75 L180 50 L210 45 L240 30 L270 35 L300 25 L330 40 L360 30 L400 20 L400 140 L0 140 Z"
              fill="url(#areaGrad)"
            />
            {/* Line */}
            <path
              d="M0 110 L30 100 L60 95 L90 85 L120 70 L150 75 L180 50 L210 45 L240 30 L270 35 L300 25 L330 40 L360 30 L400 20"
              stroke="#3B82F6"
              strokeWidth="2"
              fill="none"
            />
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Contract chip row */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-accent/10 text-accent border-0 text-[12px]">
            SPY 510C 0DTE
          </Badge>
          <Badge variant="success" className="text-[12px]">+85%</Badge>
          <Badge variant="outline" className="text-[12px]">
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-success" />
            High
          </Badge>
        </div>
      </div>
    </div>
  );
}
