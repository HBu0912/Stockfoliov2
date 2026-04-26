import type { Holding } from "@/generated/prisma";

export type Slice = { label: string; value: number; pct: number; color: string };

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(0.65 0.12 255)",
  "oklch(0.72 0.14 145)",
  "oklch(0.75 0.12 30)",
  "oklch(0.6 0.1 300)",
  "oklch(0.7 0.1 200)",
];

function valueOf(h: Pick<Holding, "shares" | "lastPrice">) {
  const p = h.lastPrice ?? 0;
  return h.shares * p;
}

/**
 * Build slices for all holdings by $ value (no "Other" bucket).
 */
export function buildTop5Slices(
  holdings: (Pick<Holding, "id" | "symbol" | "name" | "shares" | "lastPrice"> & { [k: string]: unknown })[]
): { slices: Slice[]; total: number } {
  const rows = holdings
    .map((h) => ({
      label: h.symbol,
      name: h.name,
      value: valueOf(h),
    }))
    .filter((r) => r.value > 0);
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (total <= 0) return { slices: [], total: 0 };
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const withOther = sorted;
  return {
    total,
    slices: withOther.map((r, i) => ({
      label: r.label,
      value: r.value,
      pct: (r.value / total) * 100,
      color: COLORS[i % COLORS.length],
    })),
  };
}

/**
 * Aggregate by symbol across many accounts (for overview / arena % of portfolio by ticker).
 */
export function aggregateBySymbol(
  list: (Pick<Holding, "symbol" | "name" | "shares" | "lastPrice"> & { [k: string]: unknown })[]
): { label: string; name: string; value: number; pct: number }[] {
  const map = new Map<string, { name: string; value: number }>();
  for (const h of list) {
    const v = h.shares * (h.lastPrice ?? 0);
    const ex = map.get(h.symbol) ?? { name: h.name, value: 0 };
    ex.value += v;
    ex.name = h.name || ex.name;
    map.set(h.symbol, ex);
  }
  const total = [...map.values()].reduce((a, b) => a + b.value, 0);
  if (total <= 0) return [];
  return [...map.entries()]
    .map(([symbol, o]) => ({
      label: symbol,
      name: o.name,
      value: o.value,
      pct: (o.value / total) * 100,
    }))
    .sort((a, b) => b.value - a.value);
}
