"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft } from "lucide-react";
import { SummaryCards } from "./summary-cards";
import { ReplayChart } from "./replay-chart";
import { KeyMomentsList } from "./key-moments-list";
import type { ReplayResult } from "@/lib/engine/types";
import { formatDateDisplay, getExpirationLabel } from "@/lib/engine/dates";

interface ContractReplayProps {
  result: ReplayResult;
  onNewBacktest: () => void;
  onPickAnother: () => void;
}

export function ContractReplay({
  result,
  onNewBacktest,
  onPickAnother,
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
          2
        </span>
        <h2 className="text-lg font-semibold text-text-primary">
          Your Results
        </h2>
      </div>

      {/* Contract info bar + pick another */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-bg px-4 py-3 mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">
            {contractLabel}
          </span>
          <Badge className="bg-accent/15 text-accent border-0 text-[10px] font-semibold">
            ATM
          </Badge>
          <span className="text-[13px] text-text-muted">
            Exp {expLabel}
          </span>
          <span className="text-[13px] text-text-muted">
            Entry {contract.entryTime} ET
          </span>
        </div>
        <button
          onClick={onPickAnother}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-text-secondary transition-colors hover:border-accent/40 hover:text-accent"
        >
          <ArrowRightLeft className="h-3 w-3" />
          Pick another contract
        </button>
      </div>

      <p className="mb-5 text-[12px] text-text-muted">
        We auto-selected the at-the-money (ATM) call. Want to try an
        out-of-the-money (OTM) call or put?{" "}
        <button
          onClick={onPickAnother}
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          Browse all strikes
        </button>
      </p>

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
        <Button onClick={onNewBacktest}>New Backtest</Button>
      </div>
    </div>
  );
}
