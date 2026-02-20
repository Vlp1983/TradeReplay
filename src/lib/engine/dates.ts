/**
 * Date/time helpers for the backtesting UI.
 */

import { format, subDays, isWeekend } from "date-fns";

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
 */
export function getEntryTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 9; h <= 15; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 9 && m < 30) continue;
      if (h === 15 && m > 45) continue;
      slots.push(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
      );
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
