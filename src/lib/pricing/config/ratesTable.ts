/**
 * Hardcoded monthly risk-free rates (3-month treasury approximation).
 */

const RATES_TABLE: Record<string, number> = {
  "2024-01": 0.0533,
  "2024-02": 0.0533,
  "2024-03": 0.053,
  "2024-04": 0.0528,
  "2024-05": 0.0527,
  "2024-06": 0.0525,
  "2024-07": 0.0526,
  "2024-08": 0.0524,
  "2024-09": 0.0498,
  "2024-10": 0.0473,
  "2024-11": 0.046,
  "2024-12": 0.0444,
  "2025-01": 0.0433,
  "2025-02": 0.043,
  "2025-03": 0.0432,
};

/**
 * Returns the risk-free rate for the closest month to the given date.
 * If the date is outside the table, returns the nearest boundary rate.
 */
export function getRiskFreeRate(date: Date): number {
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

  if (RATES_TABLE[key] !== undefined) {
    return RATES_TABLE[key];
  }

  // Find the closest available month
  const keys = Object.keys(RATES_TABLE).sort();
  if (keys.length === 0) return 0.045; // safe fallback

  if (key < keys[0]) return RATES_TABLE[keys[0]];
  if (key > keys[keys.length - 1]) return RATES_TABLE[keys[keys.length - 1]];

  // Find nearest key by iterating
  let bestKey = keys[0];
  let bestDist = Infinity;
  for (const k of keys) {
    const dist = Math.abs(
      new Date(k + "-15").getTime() - date.getTime()
    );
    if (dist < bestDist) {
      bestDist = dist;
      bestKey = k;
    }
  }

  return RATES_TABLE[bestKey];
}
