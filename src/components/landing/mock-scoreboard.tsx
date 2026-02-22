"use client";

import { Badge } from "@/components/ui/badge";

const rows: { rank: number; guru: string; initials: string; hue: number; winRate: number; avgReturn: number; risk: "Low" | "Med" | "High" }[] = [
  { rank: 1, guru: "TradePro Academy", initials: "TA", hue: 200, winRate: 74, avgReturn: 22, risk: "Low" },
  { rank: 2, guru: "SMB Capital", initials: "SC", hue: 140, winRate: 72, avgReturn: 18, risk: "Low" },
  { rank: 3, guru: "CryptoCred", initials: "CC", hue: 280, winRate: 70, avgReturn: 30, risk: "Low" },
  { rank: 4, guru: "Warrior Trading", initials: "WT", hue: 30, winRate: 68, avgReturn: 32, risk: "Med" },
  { rank: 5, guru: "Axia Futures", initials: "AF", hue: 320, winRate: 65, avgReturn: 20, risk: "Low" },
];

function winRateColor(rate: number) {
  if (rate >= 65) return "text-green-400";
  if (rate >= 50) return "text-yellow-400";
  return "text-red-400";
}

export function MockScoreboard() {
  return (
    <div className="rounded-[14px] border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">
          Guru Score Board
        </span>
        <Badge variant="outline" className="text-[11px]">30-Day</Badge>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-bg">
              <th className="px-3 py-2 font-medium text-text-muted">#</th>
              <th className="px-3 py-2 font-medium text-text-muted">Guru</th>
              <th className="px-3 py-2 font-medium text-text-muted">Win Rate</th>
              <th className="hidden px-3 py-2 font-medium text-text-muted sm:table-cell">Avg Return</th>
              <th className="px-3 py-2 font-medium text-text-muted">Risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.rank}
                className="border-b border-border last:border-0"
              >
                <td className="px-3 py-2 font-mono text-text-muted">
                  {r.rank}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-[9px] font-bold"
                      style={{
                        backgroundColor: `hsl(${r.hue}, 45%, 25%)`,
                        color: `hsl(${r.hue}, 70%, 75%)`,
                      }}
                    >
                      {r.initials}
                    </div>
                    <span className="font-medium text-text-primary">
                      {r.guru}
                    </span>
                  </div>
                </td>
                <td className={`px-3 py-2 font-mono font-semibold ${winRateColor(r.winRate)}`}>
                  {r.winRate}%
                </td>
                <td className="hidden px-3 py-2 font-mono text-green-400 sm:table-cell">
                  +{r.avgReturn}%
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant={
                      r.risk === "Low"
                        ? "success"
                        : r.risk === "High"
                          ? "danger"
                          : "outline"
                    }
                    className="text-[10px]"
                  >
                    {r.risk}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
