export type ChangeKind = "NEW" | "INCREASE" | "REDUCE" | "CLOSE";

/**
 * % change is relative to this holding line only (shares in / shares out of that line).
 * NEW from 0 → 100% new position. Sell half → 50% of position, etc.
 */
export function computePositionChange(
  oldShares: number,
  newShares: number
): { kind: ChangeKind; pct: number } | null {
  const o = Math.max(0, oldShares);
  const n = Math.max(0, newShares);
  if (o === n) return null;
  if (o === 0 && n > 0) return { kind: "NEW", pct: 100 };
  if (o > 0 && n === 0) return { kind: "CLOSE", pct: 100 };
  if (n > o) return { kind: "INCREASE", pct: ((n - o) / o) * 100 };
  return { kind: "REDUCE", pct: ((o - n) / o) * 100 };
}
