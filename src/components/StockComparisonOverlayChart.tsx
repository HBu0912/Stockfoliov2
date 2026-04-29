"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
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

type MergedRow = Record<string, string | number>;

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

function minutesInNewYork(dateISO: string): number {
  const d = new Date(dateISO);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function newYorkDateKey(dateISO: string): string {
  const d = new Date(dateISO);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function readActiveIdx(state: unknown): number | null {
  if (typeof state !== "object" || state == null) return null;
  const idx = (state as { activeTooltipIndex?: unknown }).activeTooltipIndex;
  if (typeof idx === "number" && Number.isFinite(idx)) return idx;
  const activeLabel = (state as { activeLabel?: unknown }).activeLabel;
  if (typeof activeLabel === "number" && Number.isFinite(activeLabel)) return activeLabel;
  if (typeof activeLabel === "string") {
    const parsed = Number(activeLabel);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
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
  const [dragging, setDragging] = useState(false);
  const [dragStartIdx, setDragStartIdx] = useState<number | null>(null);
  const [dragEndIdx, setDragEndIdx] = useState<number | null>(null);
  const [dragMoved, setDragMoved] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

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

  const selectedRange = useMemo(() => {
    if (!dragMoved || dragStartIdx == null || dragEndIdx == null || merged.length === 0) return null;
    const left = Math.max(0, Math.min(dragStartIdx, dragEndIdx));
    const right = Math.min(merged.length - 1, Math.max(dragStartIdx, dragEndIdx));
    if (left === right) return null;
    const primary = series[0]?.symbol;
    if (!primary) return null;
    const start = Number((merged[left] as MergedRow)[primary]);
    const end = Number((merged[right] as MergedRow)[primary]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start === 0) return null;
    return {
      left,
      right,
      pct: ((end - start) / start) * 100,
      startLabel: String((merged[left] as MergedRow).label ?? ""),
      endLabel: String((merged[right] as MergedRow).label ?? ""),
      symbol: primary,
    };
  }, [dragMoved, dragStartIdx, dragEndIdx, merged, series]);

  const marketOpenIdx = useMemo(() => {
    if (interval !== "1D" || merged.length === 0) return null;
    const latestDate = merged.map((row) => newYorkDateKey(String(row.at ?? ""))).sort().at(-1);
    if (!latestDate) return null;
    return (
      (merged.find((row) => {
        const at = String(row.at ?? "");
        return newYorkDateKey(at) === latestDate && minutesInNewYork(at) >= 9 * 60 + 30;
      })?.idx as number | undefined) ?? null
    );
  }, [interval, merged]);

  const marketCloseIdx = useMemo(() => {
    if (interval !== "1D" || merged.length === 0) return null;
    const latestDate = merged.map((row) => newYorkDateKey(String(row.at ?? ""))).sort().at(-1);
    if (!latestDate) return null;
    return (
      (merged.find((row) => {
        const at = String(row.at ?? "");
        return newYorkDateKey(at) === latestDate && minutesInNewYork(at) >= 16 * 60;
      })?.idx as number | undefined) ?? null
    );
  }, [interval, merged]);

  const xTickFormatter = useMemo(() => {
    if (interval !== "1D") return () => "";
    return (value: number) => {
      if (marketOpenIdx != null && value === marketOpenIdx) return "9:30 AM";
      if (marketCloseIdx != null && value === marketCloseIdx) return "4:00 PM";
      return "";
    };
  }, [interval, marketOpenIdx, marketCloseIdx]);

  const primarySymbol = series[0]?.symbol ?? null;
  const primaryWindowPct = useMemo(() => {
    if (!primarySymbol || merged.length < 2) return null;
    let first: number | null = null;
    let last: number | null = null;
    for (const row of merged) {
      const v = Number((row as MergedRow)[primarySymbol]);
      if (!Number.isFinite(v)) continue;
      if (first == null) first = v;
      last = v;
    }
    if (first == null || last == null) return null;
    return last - first;
  }, [primarySymbol, merged]);
  const chartBubblePct = selectedRange?.pct ?? primaryWindowPct;
  const chartBubbleLabel = selectedRange
    ? `${selectedRange.symbol}: ${selectedRange.startLabel} → ${selectedRange.endLabel}`
    : `${interval} window${primarySymbol ? ` · ${primarySymbol}` : ""}`;

  return (
    <div className="rounded-2xl border border-(--card-border) bg-(--card) p-3 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold">Overlay performance</h3>
        <p className="text-xs text-(--muted)">Normalized to 0% at the start of the selected window.</p>
      </div>

      <div className={"relative mt-2 rounded-xl border border-(--card-border) bg-(--background) p-2 " + heightClassName}>
        {loading ? (
          <p className="px-2 py-3 text-sm text-(--muted)">Loading overlay...</p>
        ) : error ? (
          <p className="px-2 py-3 text-sm text-red-400">{error}</p>
        ) : merged.length === 0 ? (
          <p className="px-2 py-3 text-sm text-(--muted)">No overlay data.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={merged}
              onMouseDown={(state) => {
                const idx = readActiveIdx(state) ?? hoverIdx;
                if (idx == null) return;
                setDragging(true);
                setDragStartIdx(idx);
                setDragEndIdx(idx);
                setDragMoved(false);
                setHoverIdx(null);
              }}
              onMouseMove={(state) => {
                const idx = readActiveIdx(state);
                if (dragging) {
                  if (idx != null) {
                    setDragEndIdx(idx);
                    if (dragStartIdx != null && idx !== dragStartIdx) setDragMoved(true);
                  }
                  return;
                }
                setHoverIdx(idx);
              }}
              onMouseUp={(state) => {
                if (!dragging) return;
                const idx = readActiveIdx(state);
                if (idx != null) {
                  setDragEndIdx(idx);
                  if (dragStartIdx != null && idx !== dragStartIdx) setDragMoved(true);
                }
                setDragging(false);
              }}
              onMouseLeave={() => {
                setHoverIdx(null);
                if (dragging) setDragging(false);
              }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis
                dataKey="idx"
                tick={interval === "1D" ? { fontSize: 11, fill: "rgba(148,163,184,0.95)" } : false}
                axisLine={{ stroke: "rgba(148,163,184,0.6)" }}
                tickLine={false}
                tickFormatter={xTickFormatter}
                minTickGap={24}
              />
              <YAxis
                domain={([min, max]) => {
                  if (typeof min !== "number" || typeof max !== "number") return [min, max];
                  const pad = (max - min || Math.abs(max || 1)) * 0.12;
                  return [min, max + pad];
                }}
                tickFormatter={(v) => `${v}%`}
                tick={{ pointerEvents: "none" }}
                width={48}
              />
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
                  stroke="rgba(148,163,184,0.9)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                />
              )}
              {interval === "1D" && marketCloseIdx != null && (
                <ReferenceLine
                  x={marketCloseIdx}
                  stroke="rgba(148,163,184,0.9)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                />
              )}
              {!dragging && hoverIdx != null && (
                <ReferenceLine
                  x={hoverIdx}
                  stroke="rgba(148,163,184,0.8)"
                  strokeDasharray="3 3"
                  ifOverflow="extendDomain"
                />
              )}
              {selectedRange && (
                <ReferenceArea
                  x1={selectedRange.left}
                  x2={selectedRange.right}
                  strokeOpacity={0}
                  fill="rgba(56,189,248,0.16)"
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
        {chartBubblePct != null && (
          <div className="pointer-events-none absolute right-3 top-3 rounded-xl border border-(--card-border) bg-(--card)/95 px-3 py-1.5 text-xs shadow-sm">
            <p className="text-[10px] text-(--muted)">{chartBubbleLabel}</p>
            <span className={chartBubblePct < 0 ? "text-red-400" : "text-emerald-300"}>
              {chartBubblePct > 0 ? "+" : ""}
              {formatNumber(chartBubblePct, 2)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function formatNumber(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}
