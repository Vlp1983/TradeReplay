/**
 * Date/time helpers for the backtesting UI.
 */

import { format, subDays, isWeekend } from "date-fns";

/**
 * Convert 24-hour HH:MM string to 12-hour format with AM/PM.
 * e.g. "09:30" → "9:30 AM", "13:00" → "1:00 PM"
 */
export function to12Hour(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr);
  const suffix = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${mStr} ${suffix}`;
}

/**
 * Return the last N trading days (Mon–Fri) as YYYY-MM-DD strings.
 */
export function getRecentTradingDays(count: number = 14): string[] {
  const days: string[] = [];
  let d = new Date();
  while (days.length < count) {
    d = subDays(d, 1);
    if (!isWeekend(d)) {
      days.push(format(d, "yyyy-MM-dd"));
    }
  }
  return days;
}

/**
 * Generate 15-minute time slots from 09:30 to 15:45 ET.
 * Returns {value, label} pairs — value is 24h for engine, label is 12h for display.
 */
export function getEntryTimeSlots(): { value: string; label: string }[] {
  const slots: { value: string; label: string }[] = [];
  for (let h = 9; h <= 15; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 9 && m < 30) continue;
      if (h === 15 && m > 45) continue;
      const val = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      slots.push({ value: val, label: to12Hour(val) });
    }
  }
  return slots;
}

/**
 * Format date string for display: "Feb 14, 2025"
 */
export function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return format(d, "MMM d, yyyy");
}

/**
 * Format expiration date label.
 */
export function getExpirationLabel(
  date: string,
  expiration: "0dte" | "friday"
): string {
  if (expiration === "0dte") return `${date} (0DTE)`;
  const d = new Date(date + "T12:00:00");
  const dayOfWeek = d.getDay();
  const daysToFriday = (5 - dayOfWeek + 7) % 7;
  const friday = new Date(d);
  friday.setDate(friday.getDate() + daysToFriday);
  return format(friday, "MMM d") + " (Fri)";
}
