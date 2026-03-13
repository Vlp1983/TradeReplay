"use client";

import { useState } from "react";

interface ExitTimePickerProps {
  entryTime: string;   // HH:MM (ET)
  entryDate: string;   // YYYY-MM-DD
  expiryDate: string;  // YYYY-MM-DD
  onExitChange?: (exitTime: string, exitDate: string) => void;
}

/** Generate 15-minute time slots from 09:30 to 15:55 ET */
function getTimeSlots(): { value: string; label: string }[] {
  const slots: { value: string; label: string }[] = [];
  for (let h = 9; h <= 15; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 9 && m < 30) continue;
      if (h === 15 && m > 45) continue;
      const val = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      let h12 = h;
      const suffix = h12 >= 12 ? "PM" : "AM";
      if (h12 === 0) h12 = 12;
      else if (h12 > 12) h12 -= 12;
      slots.push({ value: val, label: `${h12}:${m.toString().padStart(2, "0")} ${suffix}` });
    }
  }
  return slots;
}

const TIME_SLOTS = getTimeSlots();

export function ExitTimePicker({
  entryTime,
  entryDate,
  expiryDate,
  onExitChange,
}: ExitTimePickerProps) {
  const [exitTime, setExitTime] = useState<string>("");
  const [exitDate, setExitDate] = useState<string>("");

  const handleTimeChange = (time: string) => {
    setExitTime(time);
    if (exitDate && time) {
      onExitChange?.(time, exitDate);
    }
  };

  const handleDateChange = (date: string) => {
    setExitDate(date);
    if (exitTime && date) {
      onExitChange?.(exitTime, date);
    }
  };

  // Filter time slots: if exit date === entry date, only show times after entry
  const availableSlots = exitDate === entryDate
    ? TIME_SLOTS.filter((s) => s.value > entryTime)
    : TIME_SLOTS;

  return (
    <div className="rounded-lg border border-border bg-bg px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] font-medium text-text-muted">
          When did you exit?
        </span>

        <select
          value={exitTime}
          onChange={(e) => handleTimeChange(e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-text-primary focus:border-accent focus:outline-none"
        >
          <option value="">Select time</option>
          {availableSlots.map((slot) => (
            <option key={slot.value} value={slot.value}>
              {slot.label}
            </option>
          ))}
        </select>

        <span className="text-[13px] text-text-muted">on</span>

        <input
          type="date"
          value={exitDate}
          onChange={(e) => handleDateChange(e.target.value)}
          min={entryDate}
          max={expiryDate}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] text-text-primary focus:border-accent focus:outline-none"
        />

        {exitTime && exitDate && (
          <span className="text-[11px] text-accent">
            Exit set
          </span>
        )}
      </div>
    </div>
  );
}
