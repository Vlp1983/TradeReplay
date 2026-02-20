"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBadge } from "./confidence-badge";
import type {
  ChainData,
  ChainRow,
  Expiration,
  Right,
  SelectedContract,
} from "@/lib/engine/types";
import { formatDateDisplay, getExpirationLabel } from "@/lib/engine/dates";

interface ChainSnapshotProps {
  chain: ChainData;
  onExpirationChange: (exp: Expiration) => void;
  onReplayContract: (contract: SelectedContract) => void;
  loading?: boolean;
}

export function ChainSnapshot({
  chain,
  onExpirationChange,
  onReplayContract,
  loading,
}: ChainSnapshotProps) {
  const [selectedStrike, setSelectedStrike] = useState<number | null>(null);
  const [selectedRight, setSelectedRight] = useState<Right>("call");

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
      {/* Header */}
      <div className="mb-1 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-[13px] font-semibold text-accent">
          2
        </span>
        <h2 className="text-lg font-semibold text-text-primary">
          Chain Snapshot
        </h2>
      </div>
      <p className="mb-4 text-[13px] text-text-muted">
        {chain.ticker} &mdash; {formatDateDisplay(chain.date)} {chain.entryTime}{" "}
        ET &mdash; Underlying: ${chain.underlyingPrice.toFixed(2)}
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

      {/* Tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChainTable
          title="Calls"
          rows={chain.calls}
          selectedStrike={selectedRight === "call" ? selectedStrike : null}
          onRowClick={(strike) => handleRowClick(strike, "call")}
        />
        <ChainTable
          title="Puts"
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
                {chain.ticker} {selectedStrike}
                {selectedRight === "call" ? "C" : "P"}
              </span>{" "}
              &mdash; ${selectedRow.premium.toFixed(2)}{" "}
              <span className="text-text-muted">
                ({getExpirationLabel(chain.date, chain.expiration)})
              </span>
            </>
          ) : (
            <span className="text-text-muted">
              Click a row to select a contract
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
  title,
  rows,
  selectedStrike,
  onRowClick,
}: {
  title: string;
  rows: ChainRow[];
  selectedStrike: number | null;
  onRowClick: (strike: number) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-medium text-text-muted">{title}</p>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-bg">
              <th className="px-3 py-2 font-medium text-text-muted">Strike</th>
              <th className="px-3 py-2 font-medium text-text-muted">
                Est. Premium
              </th>
              <th className="px-3 py-2 font-medium text-text-muted">Conf.</th>
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
                    ${row.strike}
                    {row.isATM && (
                      <span className="ml-1.5 text-[10px] font-semibold text-accent">
                        ATM
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-text-secondary">
                    ${row.premium.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5">
                    <ConfidenceBadge confidence={row.confidence} />
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
