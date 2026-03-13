"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
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

const MAX_VISIBLE = 7;

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
  const total = tradingDays.length;

  // Window start index — which day starts the visible window
  const [windowStart, setWindowStart] = useState(0);

  // When viewedDate changes externally, ensure it's visible in the window
  const currentIdx = tradingDays.indexOf(viewedDate);
  useEffect(() => {
    if (currentIdx < 0) return;
    if (currentIdx < windowStart) {
      setWindowStart(currentIdx);
    } else if (currentIdx >= windowStart + MAX_VISIBLE) {
      setWindowStart(Math.max(0, currentIdx - MAX_VISIBLE + 1));
    }
  }, [currentIdx, windowStart]);

  const visibleDays = useMemo(() => {
    return tradingDays.slice(windowStart, windowStart + MAX_VISIBLE);
  }, [tradingDays, windowStart]);

  const canSlideLeft = windowStart > 0;
  const canSlideRight = windowStart + MAX_VISIBLE < total;

  const slideLeft = useCallback(() => {
    setWindowStart((s) => Math.max(0, s - 1));
  }, []);

  const slideRight = useCallback(() => {
    setWindowStart((s) => Math.min(total - MAX_VISIBLE, s + 1));
  }, [total]);

  // Touch/swipe support
  const touchStartX = useRef(0);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      if (dx > 40) slideLeft();
      else if (dx < -40) slideRight();
    },
    [slideLeft, slideRight]
  );

  if (total <= 1) return null;

  // Build slots: always render MAX_VISIBLE slots for consistent sizing
  const slots: (string | null)[] = [];
  for (let i = 0; i < MAX_VISIBLE; i++) {
    slots.push(i < visibleDays.length ? visibleDays[i] : null);
  }

  return (
    <div
      className="flex items-center gap-2"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Left arrow — fixed 32px */}
      <button
        onClick={slideLeft}
        disabled={!canSlideLeft || loading}
        className="flex h-12 w-8 shrink-0 items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface disabled:opacity-20 disabled:pointer-events-none transition-colors"
        aria-label="Previous days"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Day buttons — fixed width */}
      <div className="flex gap-2">
        {slots.map((day, idx) => {
          if (!day) {
            // Empty placeholder — same fixed size
            return <div key={`empty-${idx}`} className="h-12 w-20" />;
          }

          const isActive = day === viewedDate;
          const isEntry = day === entryDate;
          const isExpiry = day === expiryDate;
          const isFuture = day >= today;

          // Sub-label
          let subLabel: string;
          if (isEntry) subLabel = "Entry";
          else if (isExpiry) subLabel = "Exp";
          else subLabel = "Trading Day";

          return (
            <button
              key={day}
              onClick={() => onDayChange(day)}
              disabled={loading}
              className={`flex h-12 w-20 shrink-0 flex-col items-center justify-center rounded-lg transition-all ${
                isActive
                  ? "bg-accent text-white shadow-sm"
                  : isFuture
                    ? "text-text-muted/40 cursor-not-allowed"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface"
              } ${isEntry && !isActive ? "ring-1 ring-inset ring-accent/40" : ""} ${
                isExpiry && !isActive && !isEntry ? "ring-1 ring-inset ring-amber-500/40" : ""
              }`}
            >
              <span className="text-[12px] font-medium leading-tight">{formatDayLabel(day)}</span>
              <span className={`text-[10px] leading-tight ${
                isActive
                  ? "text-white/70"
                  : isEntry
                    ? "text-accent/70"
                    : isExpiry
                      ? "text-amber-400/70"
                      : "text-text-muted/50"
              }`}>
                {subLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right arrow — fixed 32px */}
      <button
        onClick={slideRight}
        disabled={!canSlideRight || loading}
        className="flex h-12 w-8 shrink-0 items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface disabled:opacity-20 disabled:pointer-events-none transition-colors"
        aria-label="Next days"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
