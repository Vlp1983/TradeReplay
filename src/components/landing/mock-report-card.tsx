"use client";

import { Badge } from "@/components/ui/badge";
import { TrendingUp, Shield, BarChart3 } from "lucide-react";

const alerts = [
  { ticker: "SPY 510C", date: "Feb 14", result: "+42%", win: true },
  { ticker: "QQQ 445P", date: "Feb 13", result: "-18%", win: false },
  { ticker: "SPY 508C", date: "Feb 12", result: "+67%", win: true },
  { ticker: "SPY 512P", date: "Feb 11", result: "+23%", win: true },
];

export function MockReportCard() {
  return (
    <div className="rounded-[14px] border border-border bg-surface p-5">
      {/* Profile header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
          AF
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">AlphaFlow</p>
          <p className="text-[12px] text-text-muted">Options &bull; 142 alerts</p>
        </div>
        <Badge variant="success" className="ml-auto text-[11px]">A+</Badge>
      </div>

      {/* Stats chips */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="flex items-center gap-1.5 rounded-lg bg-bg px-3 py-2">
          <TrendingUp className="h-3.5 w-3.5 text-success" />
          <div>
            <p className="text-[10px] text-text-muted">Win Rate</p>
            <p className="text-[13px] font-medium text-text-primary">78%</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-bg px-3 py-2">
          <BarChart3 className="h-3.5 w-3.5 text-accent" />
          <div>
            <p className="text-[10px] text-text-muted">Expectancy</p>
            <p className="text-[13px] font-medium text-text-primary">+$1.8k</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-bg px-3 py-2">
          <Shield className="h-3.5 w-3.5 text-text-muted" />
          <div>
            <p className="text-[10px] text-text-muted">Max DD</p>
            <p className="text-[13px] font-medium text-text-primary">-12%</p>
          </div>
        </div>
      </div>

      {/* Recent alerts */}
      <p className="mb-2 text-[12px] font-medium text-text-muted">
        Recent Alerts
      </p>
      <div className="space-y-1.5">
        {alerts.map((a, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg bg-bg px-3 py-2 text-[13px]"
          >
            <span className="font-mono text-text-primary">{a.ticker}</span>
            <span className="text-text-muted">{a.date}</span>
            <Badge
              variant={a.win ? "success" : "danger"}
              className="text-[10px]"
            >
              {a.result}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
