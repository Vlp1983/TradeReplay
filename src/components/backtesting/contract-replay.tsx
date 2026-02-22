"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SummaryCards } from "./summary-cards";
import { ReplayChart } from "./replay-chart";
import { KeyMomentsList } from "./key-moments-list";
import type { ReplayResult } from "@/lib/engine/types";
import { formatDateDisplay, getExpirationLabel } from "@/lib/engine/dates";

interface ContractReplayProps {
  result: ReplayResult;
  onNewBacktest: () => void;
}

export function ContractReplay({
  result,
  onNewBacktest,
}: ContractReplayProps) {
  const { contract, sameDayPoints, toExpirationPoints, metrics, keyMoments } =
    result;

  const contractLabel = `${contract.ticker} ${contract.strike}${contract.right === "call" ? "C" : "P"}`;
  const expLabel = getExpirationLabel(contract.date, contract.expiration);
  const isMultiDay = toExpirationPoints.some((p) => p.dayIndex > 0);

  return (
    <div className="rounded-[14px] border border-border bg-surface p-6">
      {/* Header */}
      <div className="mb-1 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-[13px] font-semibold text-accent">
          3
        </span>
        <h2 className="text-lg font-semibold text-text-primary">
          See your results
        </h2>
      </div>
      <p className="mb-3 text-[13px] text-text-muted">
        Here&apos;s how this contract played out from entry to close.
      </p>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-text-primary">
          {contractLabel}
        </span>
        <span className="text-[13px] text-text-muted">
          Exp {expLabel}
        </span>
        <span className="text-[13px] text-text-muted">
          Entry {contract.entryTime} ET
        </span>
        <Badge variant="outline" className="text-[11px]">
          Estimated (MVP)
        </Badge>
      </div>

      {/* Summary cards */}
      <div className="mb-5">
        <SummaryCards metrics={metrics} />
      </div>

      {/* Chart */}
      <div className="mb-5">
        <ReplayChart
          sameDayPoints={sameDayPoints}
          toExpirationPoints={toExpirationPoints}
          isMultiDay={isMultiDay}
        />
      </div>

      {/* Key moments */}
      <div className="mb-6">
        <KeyMomentsList moments={keyMoments} />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="outline" disabled>
          Save to Library (coming soon)
        </Button>
        <Button onClick={onNewBacktest}>New Backtest</Button>
      </div>
    </div>
  );
}
