"use client";

import { Badge } from "@/components/ui/badge";

const strikes = [
  { strike: 508, premium: "4.20", conf: "Med" },
  { strike: 509, premium: "3.55", conf: "High" },
  { strike: 510, premium: "2.90", conf: "High", atm: true },
  { strike: 511, premium: "2.35", conf: "High" },
  { strike: 512, premium: "1.80", conf: "Med" },
];

export function MockChainCard() {
  return (
    <div className="relative">
      <div className="absolute -inset-8 rounded-full bg-accent/5 blur-3xl" />
      <div className="relative rounded-[14px] border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">
            Chain Snapshot &mdash; SPY Calls
          </span>
          <Badge variant="outline" className="text-[11px]">0DTE</Badge>
        </div>

        {/* Mini table */}
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-bg">
                <th className="px-3 py-2 font-medium text-text-muted">Strike</th>
                <th className="px-3 py-2 font-medium text-text-muted">Est. Premium</th>
                <th className="px-3 py-2 font-medium text-text-muted">Conf.</th>
              </tr>
            </thead>
            <tbody>
              {strikes.map((s) => (
                <tr
                  key={s.strike}
                  className={
                    s.atm
                      ? "bg-accent/5 border-b border-border"
                      : "border-b border-border last:border-0"
                  }
                >
                  <td className="px-3 py-2 font-mono text-text-primary">
                    {s.strike}
                    {s.atm && (
                      <span className="ml-1.5 text-[10px] text-accent">ATM</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-text-secondary">
                    ${s.premium}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={s.conf === "High" ? "success" : "outline"}
                      className="text-[10px]"
                    >
                      {s.conf}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mini chart below table */}
        <div className="mt-4 h-20 rounded-lg bg-bg">
          <svg
            viewBox="0 0 400 80"
            fill="none"
            className="h-full w-full"
            preserveAspectRatio="none"
          >
            <path
              d="M0 60 L50 55 L100 45 L150 50 L200 30 L250 25 L300 35 L350 20 L400 15 L400 80 L0 80 Z"
              fill="url(#chainGrad)"
            />
            <path
              d="M0 60 L50 55 L100 45 L150 50 L200 30 L250 25 L300 35 L350 20 L400 15"
              stroke="#22C55E"
              strokeWidth="1.5"
              fill="none"
            />
            <defs>
              <linearGradient id="chainGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22C55E" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
}
