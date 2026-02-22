"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, ArrowLeft, MousePointerClick } from "lucide-react";
import type {
  ChainData,
  ChainRow,
  Expiration,
  Right,
  SelectedContract,
} from "@/lib/engine/types";
import { formatDateDisplay, getExpirationLabel, to12Hour } from "@/lib/engine/dates";

interface ChainSnapshotProps {
  chain: ChainData;
  onExpirationChange: (exp: Expiration) => void;
  onReplayContract: (contract: SelectedContract) => void;
  onBackToReplay?: () => void;
  loading?: boolean;
}

/** Format a strike price sensibly for display — handles $0.005 to $97,000. */
function fmtStrike(strike: number): string {
  if (strike >= 1000) return strike.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (strike >= 1) return strike.toFixed(strike % 1 === 0 ? 0 : 2);
  if (strike >= 0.01) return strike.toFixed(strike % 0.01 === 0 ? 2 : 3);
  return strike.toFixed(4);
}

export function ChainSnapshot({
  chain,
  onExpirationChange,
  onReplayContract,
  onBackToReplay,
  loading,
}: ChainSnapshotProps) {
  const atmStrike = chain.calls.find((r) => r.isATM)?.strike ?? null;
  const [selectedStrike, setSelectedStrike] = useState<number | null>(atmStrike);
  const [selectedRight, setSelectedRight] = useState<Right>("call");

  // Reset to ATM call whenever the chain changes (new ticker/date/time/expiration)
  useEffect(() => {
    const atm = chain.calls.find((r) => r.isATM)?.strike ?? null;
    setSelectedStrike(atm);
    setSelectedRight("call");
  }, [chain]);

  const selectedRow =
    selectedRight === "call"
      ? chain.calls.find((r) => r.strike === selectedStrike)
      : chain.puts.find((r) => r.strike === selectedStrike);

  function handleRowClick(strike: number, right: Right) {
    setSelectedStrike(strike);
    setSelectedRight(right);
  }

  function handleReplay() {
    if (!selectedRow || selectedStrike === null) return;
    onReplayContract({
      ticker: chain.ticker,
      date: chain.date,
      entryTime: chain.entryTime,
      expiration: chain.expiration,
      strike: selectedStrike,
      right: selectedRight,
      entryPremium: selectedRow.premium,
      confidence: selectedRow.confidence,
    });
  }

  return (
    <div className="rounded-[14px] border border-border bg-surface p-6">
      {/* Back to results link */}
      {onBackToReplay && (
        <button
          onClick={onBackToReplay}
          className="mb-3 flex items-center gap-1.5 text-[13px] font-medium text-text-muted transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to results
        </button>
      )}

      {/* Header */}
      <div className="mb-1 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-[13px] font-semibold text-accent">
          2
        </span>
        <h2 className="text-lg font-semibold text-text-primary">
          Pick a contract
        </h2>
      </div>
      <p className="mb-4 text-[13px] text-text-muted">
        Select an OTM call or put to replay a different strike.
        &mdash; {chain.ticker} {formatDateDisplay(chain.date)} {to12Hour(chain.entryTime)}{" "}
        ET &mdash; ${fmtStrike(chain.underlyingPrice)}
      </p>

      {/* Expiration toggle + MVP tag */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-border p-0.5">
          <button
            onClick={() => onExpirationChange("0dte")}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              chain.expiration === "0dte"
                ? "bg-accent text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            0DTE
          </button>
          <button
            onClick={() => onExpirationChange("friday")}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              chain.expiration === "friday"
                ? "bg-accent text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Friday Weekly
          </button>
        </div>
        <Badge variant="outline" className="text-[11px]">
          Estimated (MVP) &bull; 15-min resolution
        </Badge>
      </div>

      {/* Strike selection prompt — only if nothing is selected (edge case) */}
      {!selectedRow && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/5 px-4 py-2.5">
          <MousePointerClick className="h-4 w-4 shrink-0 text-accent" />
          <p className="text-[13px] text-text-secondary">
            Tap a strike price below to get started
          </p>
        </div>
      )}

      {/* Tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChainTable
          right="call"
          rows={chain.calls}
          selectedStrike={selectedRight === "call" ? selectedStrike : null}
          onRowClick={(strike) => handleRowClick(strike, "call")}
        />
        <ChainTable
          right="put"
          rows={chain.puts}
          selectedStrike={selectedRight === "put" ? selectedStrike : null}
          onRowClick={(strike) => handleRowClick(strike, "put")}
        />
      </div>

      {/* Selection indicator + CTA */}
      <div className="mt-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="text-sm text-text-secondary">
          {selectedRow ? (
            <>
              Selected:{" "}
              <span className="font-medium text-text-primary">
                {chain.ticker} {fmtStrike(selectedStrike!)}
                {selectedRight === "call" ? "C" : "P"}
              </span>{" "}
              &mdash; ${selectedRow.premium.toFixed(2)}{" "}
              <span className="text-text-muted">
                ({getExpirationLabel(chain.date, chain.expiration)})
              </span>
            </>
          ) : (
            <span className="text-text-muted">
              No contract selected
            </span>
          )}
        </div>
        <Button onClick={handleReplay} disabled={!selectedRow || loading}>
          {loading ? "Replaying..." : "Replay Contract"}
        </Button>
      </div>
    </div>
  );
}

// ---- inner table ----

function ChainTable({
  right,
  rows,
  selectedStrike,
  onRowClick,
}: {
  right: Right;
  rows: ChainRow[];
  selectedStrike: number | null;
  onRowClick: (strike: number) => void;
}) {
  const isCall = right === "call";

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {isCall ? (
          <ArrowUpRight className="h-4 w-4 text-green-400" />
        ) : (
          <ArrowDownRight className="h-4 w-4 text-red-400" />
        )}
        <p className={`text-sm font-semibold ${isCall ? "text-green-400" : "text-red-400"}`}>
          {isCall ? "CALLS" : "PUTS"}
        </p>
        <span className="text-[11px] text-text-muted">
          {isCall ? "Bullish" : "Bearish"}
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-bg">
              <th className="px-3 py-2 font-medium text-text-muted">Strike</th>
              <th className="px-3 py-2 font-medium text-text-muted">
                Est. Premium
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = row.strike === selectedStrike;
              return (
                <tr
                  key={row.strike}
                  onClick={() => onRowClick(row.strike)}
                  className={`cursor-pointer border-b border-border transition-colors last:border-0 ${
                    isSelected
                      ? "bg-accent/10"
                      : row.isATM
                        ? "bg-accent/[0.03] hover:bg-accent/[0.06]"
                        : "hover:bg-white/[0.02]"
                  }`}
                >
                  <td className="px-3 py-2.5 font-mono text-text-primary">
                    ${fmtStrike(row.strike)}
                    {row.isATM && (
                      <span className="ml-1.5 text-[10px] font-semibold text-accent">
                        ATM
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-text-secondary">
                    ${row.premium.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
