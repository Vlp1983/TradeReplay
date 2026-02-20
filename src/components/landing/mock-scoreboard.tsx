"use client";

import { Badge } from "@/components/ui/badge";

const rows = [
  { rank: 1, guru: "AlphaFlow", grade: "A+", winRate: "78%", risk: "Low" },
  { rank: 2, guru: "VegaTrader", grade: "A", winRate: "72%", risk: "Med" },
  { rank: 3, guru: "DeltaPulse", grade: "A-", winRate: "69%", risk: "Low" },
  { rank: 4, guru: "ThetaKing", grade: "B+", winRate: "65%", risk: "Med" },
  { rank: 5, guru: "CryptoEdge", grade: "B", winRate: "61%", risk: "High" },
];

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
              <th className="px-3 py-2 font-medium text-text-muted">Grade</th>
              <th className="px-3 py-2 font-medium text-text-muted">Win Rate</th>
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
                <td className="px-3 py-2 font-medium text-text-primary">
                  {r.guru}
                </td>
                <td className="px-3 py-2">
                  <Badge variant="success" className="text-[10px]">
                    {r.grade}
                  </Badge>
                </td>
                <td className="px-3 py-2 font-mono text-text-secondary">
                  {r.winRate}
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
