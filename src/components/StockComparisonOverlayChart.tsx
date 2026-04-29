"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ValueType } from "recharts/types/component/DefaultTooltipContent";

export type CompareIntervalKey = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "5Y" | "ALL";

type ChartPoint = { at: string; close: number };

type SeriesPayload = {
  symbol: string;
  interval: CompareIntervalKey;
  chart: ChartPoint[];
};

const palette = ["#34d399", "#60a5fa", "#fbbf24", "#c084fc", "#fb7185"];

function formatXAxis(dateISO: string, interval: CompareIntervalKey): string {
  const d = new Date(dateISO);
  if (interval === "1D" || interval === "1W") {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  if (interval === "5Y" || interval === "ALL") {
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function normalizedMap(points: ChartPoint[]): Map<string, number> {
  const cleaned = points.filter((p) => p.close > 0);
  const base = cleaned[0]?.close;
  if (!base) return new Map();
  const map = new Map<string, number>();
  for (const p of cleaned) {
    map.set(p.at, ((p.close - base) / base) * 100);
  }
  return map;
}

export function StockComparisonOverlayChart({
  symbols,
  interval,
  heightClassName = "h-80",
}: {
  symbols: string[];
  interval: CompareIntervalKey;
  heightClassName?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [series, setSeries] = useState<SeriesPayload[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (symbols.length < 2) return;
      setLoading(true);
      setError(null);
      try {
        const results = await Promise.all(
          symbols.map(async (sym) => {
            const res = await fetch(`/api/stocks/${encodeURIComponent(sym)}?interval=${interval}`);
            const json = (await res.json().catch(() => ({}))) as SeriesPayload & { error?: string };
            if (!res.ok) throw new Error(json.error ?? `Could not load ${sym}`);
            return { symbol: json.symbol, interval: json.interval, chart: json.chart };
          })
        );
        if (!cancelled) setSeries(results);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load overlay chart.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [symbols, interval]);

  const merged = useMemo(() => {
    if (series.length < 2) return [];
    const maps = series.map((s) => ({ symbol: s.symbol, map: normalizedMap(s.chart) }));
    const times = new Set<string>();
    for (const s of series) for (const p of s.chart) times.add(p.at);
    const sorted = [...times].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return sorted.map((at, idx) => {
      const row: Record<string, string | number> = { idx, at };
      row.label = formatXAxis(at, interval);
      for (const m of maps) {
        const v = m.map.get(at);
        if (v != null) row[m.symbol] = v;
      }
      return row;
    });
  }, [series, interval]);

  const marketOpenIdx = useMemo(() => {
    if (interval !== "1D" || merged.length === 0) return null;
    return (
      (merged.find((row) => {
        const at = String(row.at ?? "");
        const d = new Date(at);
        return d.getHours() > 9 || (d.getHours() === 9 && d.getMinutes() >= 30);
      })?.idx as number | undefined) ?? null
    );
  }, [interval, merged]);

  const marketCloseIdx = useMemo(() => {
    if (interval !== "1D" || merged.length === 0) return null;
    return (
      (merged.find((row) => {
        const at = String(row.at ?? "");
        const d = new Date(at);
        return d.getHours() > 16 || (d.getHours() === 16 && d.getMinutes() >= 0);
      })?.idx as number | undefined) ?? null
    );
  }, [interval, merged]);

  return (
    <div className="rounded-2xl border border-(--card-border) bg-(--card) p-3 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold">Overlay performance</h3>
        <p className="text-xs text-(--muted)">Normalized to 0% at the start of the selected window.</p>
      </div>

      <div className={"mt-2 rounded-xl border border-(--card-border) bg-(--background) p-2 " + heightClassName}>
        {loading ? (
          <p className="px-2 py-3 text-sm text-(--muted)">Loading overlay...</p>
        ) : error ? (
          <p className="px-2 py-3 text-sm text-red-400">{error}</p>
        ) : merged.length === 0 ? (
          <p className="px-2 py-3 text-sm text-(--muted)">No overlay data.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={merged}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis
                dataKey="idx"
                tickFormatter={(v) => String(merged[Number(v)]?.label ?? "")}
                minTickGap={24}
              />
              <YAxis tickFormatter={(v) => `${v}%`} width={48} />
              <Tooltip
                cursor={false}
                formatter={(value: ValueType | undefined) => {
                  if (value == null) return "—";
                  const n = typeof value === "number" ? value : Number(value);
                  return `${formatNumber(Number.isFinite(n) ? n : NaN, 2)}%`;
                }}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as { label?: string } | undefined;
                  return row?.label ?? "";
                }}
                contentStyle={{
                  background: "var(--card)",
                  borderColor: "var(--card-border)",
                  borderRadius: "12px",
                }}
              />
              {interval === "1D" && marketOpenIdx != null && (
                <ReferenceLine
                  x={marketOpenIdx}
                  stroke="rgba(59,130,246,0.9)"
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                />
              )}
              {interval === "1D" && marketCloseIdx != null && (
                <ReferenceLine
                  x={marketCloseIdx}
                  stroke="rgba(251,146,60,0.9)"
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                />
              )}
              <Legend />
              {series.map((s, idx) => (
                <Line
                  key={s.symbol}
                  type="monotone"
                  dataKey={s.symbol}
                  stroke={palette[idx % palette.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function formatNumber(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}
