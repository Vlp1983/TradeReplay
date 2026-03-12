/**
 * Generate available expiration dates from a replay date.
 *
 * Rules:
 *   - If replayDate is a Friday, include it as 0DTE
 *   - Find all Fridays within the next 30 calendar days
 *   - Each Friday becomes a weekly expiry
 *   - Sort from nearest to furthest
 */

import type { Expiry, ExpiryType } from "./types";

export function generateExpiries(replayDate: Date): Expiry[] {
  const expiries: Expiry[] = [];

  const dayOfWeek = replayDate.getDay(); // 0=Sun, 5=Fri

  // If replayDate is a Friday, add 0DTE
  if (dayOfWeek === 5) {
    expiries.push({
      date: new Date(replayDate),
      label: "0DTE (Today)",
      dte: 0,
      type: "0DTE",
    });
  }

  // Find all Fridays within the next 30 calendar days
  for (let d = 1; d <= 30; d++) {
    const candidate = new Date(replayDate);
    candidate.setDate(candidate.getDate() + d);

    if (candidate.getDay() === 5) {
      const month = candidate.toLocaleString("en-US", { month: "short" });
      const day = candidate.getDate();
      const label = `Fri ${month} ${day}`;

      expiries.push({
        date: candidate,
        label,
        dte: d,
        type: "weekly",
      });
    }
  }

  // Sort by DTE
  expiries.sort((a, b) => a.dte - b.dte);

  return expiries;
}
