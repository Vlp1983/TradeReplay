/**
 * Generate available expiration dates from a replay date.
 *
 * Rules:
 *   - Always show 4 weekly Friday chips (the next 4 Fridays after replayDate)
 *   - If replayDate IS a Friday, "next Friday" means the FOLLOWING Friday (7 days out)
 *   - 0DTE chip only appears if replayDate is a Friday, placed AFTER the 4 weeklies
 *   - Default selected expiry is always the nearest upcoming Friday (never 0DTE)
 */

import type { Expiry, ExpiryType } from "./types";

export function generateExpiries(replayDate: Date): Expiry[] {
  const expiries: Expiry[] = [];
  const dayOfWeek = replayDate.getDay(); // 0=Sun, 5=Fri

  // Find the next Friday after replayDate
  // If replayDate is a Friday, start from the FOLLOWING Friday (7 days out)
  let daysToNextFriday = (5 - dayOfWeek + 7) % 7;
  if (daysToNextFriday === 0) daysToNextFriday = 7; // If today is Friday, go to next Friday

  // Generate 4 weekly Friday expiries
  for (let i = 0; i < 4; i++) {
    const daysOut = daysToNextFriday + i * 7;
    const candidate = new Date(replayDate);
    candidate.setDate(candidate.getDate() + daysOut);

    const month = candidate.toLocaleString("en-US", { month: "short" });
    const day = candidate.getDate();
    const label = `Fri ${month} ${day}`;

    expiries.push({
      date: candidate,
      label,
      dte: daysOut,
      type: "weekly",
    });
  }

  // If replayDate is a Friday, add 0DTE AFTER the weeklies
  if (dayOfWeek === 5) {
    expiries.push({
      date: new Date(replayDate),
      label: "0DTE (Today)",
      dte: 0,
      type: "0DTE",
    });
  }

  return expiries;
}
