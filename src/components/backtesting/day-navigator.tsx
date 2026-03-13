"use client";

import { useMemo, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DayNavigatorProps {
  /** All trading days (Mon-Fri) from entry to expiry */
  tradingDays: string[];
  /** Currently viewed day (YYYY-MM-DD) */
  viewedDate: string;
  /** Entry date (highlighted) */
  entryDate: string;
  /** Expiry date (highlighted) */
  expiryDate: string;
  /** Today's date — days beyond this show "no data yet" */
  today: string;
  /** Called when user picks a day */
  onDayChange: (date: string) => void;
  /** True while fetching data for a new day */
  loading?: boolean;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = d.getUTCDate();
  return `${month} ${day}`;
}

export function DayNavigator({
  tradingDays,
  viewedDate,
  entryDate,
  expiryDate,
  today,
  onDayChange,
  loading,
}: DayNavigatorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Scroll active day into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [viewedDate]);

  const currentIdx = tradingDays.indexOf(viewedDate);

  const handlePrev = () => {
    if (currentIdx > 0) {
      onDayChange(tradingDays[currentIdx - 1]);
    }
  };

  const handleNext = () => {
    if (currentIdx < tradingDays.length - 1) {
      onDayChange(tradingDays[currentIdx + 1]);
    }
  };

  if (tradingDays.length <= 1) return null;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handlePrev}
        disabled={currentIdx <= 0 || loading}
        className="shrink-0 rounded p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div
        ref={scrollRef}
        className="flex gap-1 overflow-x-auto scrollbar-none"
      >
        {tradingDays.map((day) => {
          const isActive = day === viewedDate;
          const isEntry = day === entryDate;
          const isExpiry = day === expiryDate;
          const isFuture = day >= today;

          return (
            <button
              key={day}
              ref={isActive ? activeRef : undefined}
              onClick={() => onDayChange(day)}
              disabled={loading}
              className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                isActive
                  ? "bg-accent text-white"
                  : isFuture
                    ? "text-text-muted/50 cursor-not-allowed"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface"
              } ${isEntry && !isActive ? "ring-1 ring-accent/40" : ""} ${
                isExpiry && !isActive ? "ring-1 ring-amber-500/40" : ""
              }`}
            >
              {formatDayLabel(day)}
              {isEntry && <span className="ml-0.5 text-[9px] opacity-60">entry</span>}
              {isExpiry && !isEntry && <span className="ml-0.5 text-[9px] opacity-60">exp</span>}
            </button>
          );
        })}
      </div>

      <button
        onClick={handleNext}
        disabled={currentIdx >= tradingDays.length - 1 || loading}
        className="shrink-0 rounded p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
