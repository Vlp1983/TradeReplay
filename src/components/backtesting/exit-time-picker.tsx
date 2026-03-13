"use client";

import { useState, useMemo } from "react";
import { formatDateDisplay, to12Hour } from "@/lib/engine/dates";

interface ExitTimePickerProps {
  entryTime: string;   // HH:MM (ET)
  entryDate: string;   // YYYY-MM-DD
  expiryDate: string;  // YYYY-MM-DD
  onExitChange?: (exitTime: string, exitDate: string) => void;
}

/** Generate 30-minute time slots from 09:30 to 16:00 ET */
function getExitTimeSlots(): { value: string; label: string }[] {
  const slots: { value: string; label: string }[] = [];
  for (let h = 9; h <= 16; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === 9 && m < 30) continue;
      if (h === 16 && m > 0) continue;
      const val = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      slots.push({ value: val, label: to12Hour(val) });
    }
  }
  return slots;
}

const EXIT_TIME_SLOTS = getExitTimeSlots();

/** Return weekday-only dates (Mon–Fri) between start and end inclusive */
function getWeekdaysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const s = new Date(start + "T12:00:00Z");
  const e = new Date(end + "T12:00:00Z");
  const d = new Date(s);
  while (d <= e) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      days.push(d.toISOString().slice(0, 10));
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

export function ExitTimePicker({
  entryTime,
  entryDate,
  expiryDate,
  onExitChange,
}: ExitTimePickerProps) {
  // Default: expiry date at 3:55 PM (closest slot is 4:00 PM, but use 15:30 as sensible default)
  const [exitDate, setExitDate] = useState<string>(expiryDate);
  const [exitTime, setExitTime] = useState<string>("15:30");

  // Fire initial default on mount
  useState(() => {
    onExitChange?.("15:30", expiryDate);
  });

  const availableDates = useMemo(
    () => getWeekdaysBetween(entryDate, expiryDate),
    [entryDate, expiryDate]
  );

  // Filter time slots: if exit date === entry date, only show times after entry
  const availableSlots = useMemo(() => {
    if (exitDate === entryDate) {
      return EXIT_TIME_SLOTS.filter((s) => s.value > entryTime);
    }
    return EXIT_TIME_SLOTS;
  }, [exitDate, entryDate, entryTime]);

  const handleTimeChange = (time: string) => {
    setExitTime(time);
    if (exitDate && time) {
      onExitChange?.(time, exitDate);
    }
  };

  const handleDateChange = (date: string) => {
    setExitDate(date);
    // If switching to entry date and current time is before entry, reset time
    if (date === entryDate && exitTime <= entryTime) {
      const firstValid = EXIT_TIME_SLOTS.find((s) => s.value > entryTime);
      const newTime = firstValid?.value ?? "";
      setExitTime(newTime);
      if (newTime) onExitChange?.(newTime, date);
    } else if (exitTime) {
      onExitChange?.(exitTime, date);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-bg px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] font-medium text-text-muted">
          When did you exit?
        </span>

        {/* Date select — matches entry picker style */}
        <div className="relative">
          <select
            value={exitDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="h-9 appearance-none rounded-xl border border-border bg-bg px-4 pr-10 text-sm text-text-primary focus:border-accent focus:ring-1 focus:ring-accent/30 focus:outline-none"
          >
            {availableDates.map((d) => (
              <option key={d} value={d}>
                {formatDateDisplay(d)}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <svg className="h-4 w-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <span className="text-[13px] text-text-muted">at</span>

        {/* Time select — 30-min intervals */}
        <div className="relative">
          <select
            value={exitTime}
            onChange={(e) => handleTimeChange(e.target.value)}
            className="h-9 appearance-none rounded-xl border border-border bg-bg px-4 pr-10 text-sm text-text-primary focus:border-accent focus:ring-1 focus:ring-accent/30 focus:outline-none"
          >
            {availableSlots.map((slot) => (
              <option key={slot.value} value={slot.value}>
                {slot.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <svg className="h-4 w-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <span className="text-[13px] text-text-muted">ET</span>

        {exitTime && exitDate && (
          <span className="text-[11px] text-accent font-medium">
            Exit set
          </span>
        )}
      </div>
    </div>
  );
}
