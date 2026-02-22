"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { List } from "lucide-react";
import { SummaryCards } from "./summary-cards";
import { ReplayChart } from "./replay-chart";
import { KeyMomentsList } from "./key-moments-list";
import type { ReplayResult, Right } from "@/lib/engine/types";
import { getExpirationLabel, to12Hour } from "@/lib/engine/dates";

interface ContractReplayProps {
  result: ReplayResult;
  onNewBacktest: () => void;
  onPickAnother: () => void;
  onToggleRight: (right: Right) => void;
}

export function ContractReplay({
  result,
  onNewBacktest,
  onPickAnother,
  onToggleRight,
}: ContractReplayProps) {
  const { contract, sameDayPoints, toExpirationPoints, metrics, keyMoments } =
    result;

  const contractLabel = `${contract.ticker} ${contract.strike}${contract.right === "call" ? "C" : "P"}`;
  const expLabel = getExpirationLabel(contract.date, contract.expiration);
  const isMultiDay = toExpirationPoints.some((p) => p.dayIndex > 0);
  const isCall = contract.right === "call";

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

      {/* Call / Put toggle + contract info + select another strike */}
      <div className="mt-3 mb-4 rounded-lg border border-border bg-bg px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Call / Put toggle */}
            <div className="flex rounded-lg border border-border p-0.5">
              <button
                onClick={() => onToggleRight("call")}
                className={`rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  isCall
                    ? "bg-green-500/15 text-green-400"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                Call
              </button>
              <button
                onClick={() => onToggleRight("put")}
                className={`rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                  !isCall
                    ? "bg-red-500/15 text-red-400"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                Put
              </button>
            </div>

            {/* Contract details */}
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
              Entry {to12Hour(contract.entryTime)} ET
            </span>
          </div>

          {/* Select Another Strike — prominent */}
          <Button
            variant="outline"
            onClick={onPickAnother}
            className="gap-1.5 border-accent/30 text-accent hover:bg-accent/10 hover:text-accent"
          >
            <List className="h-3.5 w-3.5" />
            Select Another Strike
          </Button>
        </div>

        <p className="mt-2.5 text-[12px] text-text-muted">
          Showing the at-the-money (ATM) {isCall ? "call" : "put"} by default.
          Want to try an out-of-the-money (OTM) strike?{" "}
          <button
            onClick={onPickAnother}
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            Browse all strikes
          </button>
        </p>
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
        <Button onClick={onNewBacktest}>New Backtest</Button>
      </div>
    </div>
  );
}
