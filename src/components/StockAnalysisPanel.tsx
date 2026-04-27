"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ValueType } from "recharts/types/component/DefaultTooltipContent";
import { formatMarketCap, formatNumber, formatUsd } from "@/lib/money";

const intervals = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y", "ALL"] as const;
type IntervalKey = (typeof intervals)[number];

type Payload = {
  symbol: string;
  name: string;
  interval: IntervalKey;
  chart: Array<{ at: string; close: number }>;
  changePct: number | null;
  sector: string | null;
  overview: string | null;
  analyst: {
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
  } | null;
  news: Array<{
    id: string;
    title: string;
    publisher: string;
    link: string;
    publishedAt: string | null;
  }>;
  metrics: {
    price: number | null;
    marketCap: number | null;
    beta: number | null;
    trailingPE: number | null;
    forwardPE: number | null;
    pegRatio: number | null;
    priceToBook: number | null;
    profitMargin: number | null;
    returnOnEquity: number | null;
    dividendYield: number | null;
    week52Low: number | null;
    week52High: number | null;
  };
};

function formatPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${formatNumber(v * 100, 2)}%`;
}

function formatCloseTooltip(value: ValueType | undefined) {
  if (value == null) return "—";
  const n = typeof value === "number" ? value : Number(value);
  return formatUsd(Number.isFinite(n) ? n : null);
}

function formatXAxis(dateISO: string, interval: IntervalKey): string {
  const d = new Date(dateISO);
  if (interval === "1D" || interval === "1W") {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  if (interval === "5Y" || interval === "ALL") {
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTooltipDate(dateISO: string, interval: IntervalKey): string {
  const d = new Date(dateISO);
  if (interval === "1D" || interval === "1W") {
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function StockAnalysisPanel({
  symbol,
  showOpenPageButton = true,
}: {
  symbol: string;
  showOpenPageButton?: boolean;
}) {
  const [interval, setInterval] = useState<IntervalKey>("1M");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Payload | null>(null);
  const [dragStartIdx, setDragStartIdx] = useState<number | null>(null);
  const [dragEndIdx, setDragEndIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!symbol) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/stocks/${encodeURIComponent(symbol)}?interval=${interval}`);
        const json = (await res.json().catch(() => ({}))) as Payload & { error?: string };
        if (!res.ok) {
          if (!cancelled) setError(json.error ?? "Could not load stock analysis.");
          return;
        }
        if (!cancelled) setData(json);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [symbol, interval]);

  const rangePct = useMemo(() => {
    if (!data?.metrics.week52Low || !data.metrics.week52High || !data.metrics.price) return null;
    const denom = data.metrics.week52High - data.metrics.week52Low;
    if (denom <= 0) return null;
    return Math.max(0, Math.min(100, ((data.metrics.price - data.metrics.week52Low) / denom) * 100));
  }, [data]);

  const chartRows = useMemo(
    () =>
      (data?.chart ?? []).map((row, idx) => ({
        ...row,
        idx,
        label: formatXAxis(row.at, interval),
        tooltipLabel: formatTooltipDate(row.at, interval),
      })),
    [data, interval]
  );

  const headerChange = data?.changePct ?? null;
  const isNegative = headerChange != null && headerChange < 0;

  const selectedRange = useMemo(() => {
    if (dragStartIdx == null || dragEndIdx == null || chartRows.length === 0) return null;
    const left = Math.max(0, Math.min(dragStartIdx, dragEndIdx));
    const right = Math.min(chartRows.length - 1, Math.max(dragStartIdx, dragEndIdx));
    const start = chartRows[left]?.close;
    const end = chartRows[right]?.close;
    if (start == null || end == null || start === 0) return null;
    return {
      left,
      right,
      pct: ((end - start) / start) * 100,
      startLabel: chartRows[left]?.tooltipLabel,
      endLabel: chartRows[right]?.tooltipLabel,
    };
  }, [chartRows, dragStartIdx, dragEndIdx]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">
            {data?.symbol ?? symbol.toUpperCase()}
            <span className="ml-2 text-sm font-medium text-(--muted)">
              {formatUsd(data?.metrics.price)} · {interval}
            </span>
            <span
              className={
                "ml-2 text-sm font-semibold " +
                (isNegative ? "text-red-400" : "text-emerald-300")
              }
            >
              {headerChange == null ? "—" : `${headerChange > 0 ? "+" : ""}${formatNumber(headerChange, 2)}%`}
            </span>
          </h3>
          <p className="text-sm text-(--muted)">{data?.name ?? "Loading company..."}</p>
        </div>
        {showOpenPageButton && (
          <Link
            href={`/stock-analysis?symbol=${encodeURIComponent(symbol.toUpperCase())}`}
            className="rounded-md border border-(--card-border) px-3 py-1.5 text-xs hover:bg-(--background)"
          >
            View in Stock Analysis
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {intervals.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setInterval(k);
              setDragStartIdx(null);
              setDragEndIdx(null);
            }}
            className={
              "rounded-md px-2 py-1 text-xs " +
              (interval === k
                ? "bg-(--accent) text-(--accent-foreground)"
                : "border border-(--card-border) hover:bg-(--background)")
            }
          >
            {k}
          </button>
        ))}
      </div>

      <div className="h-56 rounded-xl border border-(--card-border) bg-(--background) p-2">
        {loading ? (
          <p className="px-2 py-3 text-sm text-(--muted)">Loading chart...</p>
        ) : error ? (
          <p className="px-2 py-3 text-sm text-red-400">{error}</p>
        ) : chartRows.length === 0 ? (
          <p className="px-2 py-3 text-sm text-(--muted)">No chart data available.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartRows}
              onMouseDown={(state) => {
                if (state && typeof state.activeTooltipIndex === "number") {
                  setDragStartIdx(state.activeTooltipIndex);
                  setDragEndIdx(state.activeTooltipIndex);
                }
              }}
              onMouseMove={(state) => {
                if (dragStartIdx == null) return;
                if (state && typeof state.activeTooltipIndex === "number") {
                  setDragEndIdx(state.activeTooltipIndex);
                }
              }}
              onMouseUp={() => {
                if (dragStartIdx == null || dragEndIdx == null) return;
              }}
            >
              <XAxis
                dataKey="idx"
                minTickGap={28}
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => chartRows[Number(value)]?.label ?? ""}
              />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} width={56} />
              <Tooltip
                formatter={formatCloseTooltip}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as { tooltipLabel?: string } | undefined;
                  return row?.tooltipLabel ?? "";
                }}
                contentStyle={{
                  background: "var(--card)",
                  borderColor: "var(--card-border)",
                  borderRadius: "12px",
                  color: "var(--foreground)",
                }}
                itemStyle={{ color: "var(--foreground)" }}
                labelStyle={{ color: "var(--muted)" }}
              />
              {selectedRange && (
                <ReferenceArea
                  x1={selectedRange.left}
                  x2={selectedRange.right}
                  strokeOpacity={0}
                  fill="rgba(56,189,248,0.16)"
                />
              )}
              <Line
                type="monotone"
                dataKey="close"
                stroke={isNegative ? "#f87171" : "#34d399"}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      {selectedRange && (
        <div className="rounded-lg border border-(--card-border) bg-(--background) px-3 py-2 text-xs">
          Dragged return ({selectedRange.startLabel} → {selectedRange.endLabel}):{" "}
          <span className={selectedRange.pct < 0 ? "text-red-400" : "text-emerald-300"}>
            {selectedRange.pct > 0 ? "+" : ""}
            {formatNumber(selectedRange.pct, 2)}%
          </span>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Market Cap" value={formatMarketCap(data?.metrics.marketCap)} />
        <MetricCard label="Sector" value={data?.sector ?? "—"} />
        <MetricCard label="Beta" value={formatNumber(data?.metrics.beta, 2)} />
        <MetricCard label="P/E" value={formatNumber(data?.metrics.trailingPE, 2)} />
        <MetricCard label="Forward P/E" value={formatNumber(data?.metrics.forwardPE, 2)} />
        <MetricCard label="PEG Ratio" value={formatNumber(data?.metrics.pegRatio, 2)} />
        <MetricCard label="Price/Book" value={formatNumber(data?.metrics.priceToBook, 2)} />
        <MetricCard label="Profit Margin" value={formatPct(data?.metrics.profitMargin)} />
        <MetricCard label="Return on Equity" value={formatPct(data?.metrics.returnOnEquity)} />
        <MetricCard label="Dividend Yield" value={formatPct(data?.metrics.dividendYield)} />
        <div className="rounded-lg border border-(--card-border) bg-(--background) px-3 py-2">
          <p className="text-xs text-(--muted)">52 Week Range</p>
          <p className="text-sm font-medium">
            {formatUsd(data?.metrics.week52Low)} - {formatUsd(data?.metrics.week52High)}
          </p>
          <div className="mt-2 h-2 rounded-full bg-(--card-border)">
            <div
              className="relative h-2 rounded-full bg-sky-500/30"
              style={{ width: "100%" }}
            >
              <span
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-white/60 bg-emerald-300"
                style={{ left: `calc(${rangePct ?? 0}% - 6px)` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-(--card-border) bg-(--background) p-3">
        <p className="text-xs text-(--muted)">Overview</p>
        <p className="mt-1 text-sm text-foreground/90">
          {data?.overview ?? "Overview unavailable right now."}
        </p>
      </div>

      <div className="rounded-xl border border-(--card-border) bg-(--background) p-3">
        <p className="text-xs text-(--muted)">Analyst Ratings</p>
        <div className="mt-2 grid grid-cols-5 gap-2 text-center text-xs">
          <MetricCard label="Strong Buy" value={String(data?.analyst?.strongBuy ?? 0)} />
          <MetricCard label="Buy" value={String(data?.analyst?.buy ?? 0)} />
          <MetricCard label="Hold" value={String(data?.analyst?.hold ?? 0)} />
          <MetricCard label="Sell" value={String(data?.analyst?.sell ?? 0)} />
          <MetricCard label="Strong Sell" value={String(data?.analyst?.strongSell ?? 0)} />
        </div>
      </div>

      <div className="rounded-xl border border-(--card-border) bg-(--background) p-3">
        <p className="text-xs text-(--muted)">Related News</p>
        {data?.news?.length ? (
          <ul className="mt-2 space-y-2">
            {data.news.map((item) => (
              <li key={item.id} className="rounded-lg border border-(--card-border) bg-(--card) px-3 py-2">
                <a
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm underline-offset-2 hover:underline"
                >
                  {item.title}
                </a>
                <p className="mt-1 text-xs text-(--muted)">
                  {item.publisher}
                  {item.publishedAt
                    ? ` · ${new Date(item.publishedAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-(--muted)">No recent news available.</p>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-(--card-border) bg-(--background) px-3 py-2">
      <p className="text-xs text-(--muted)">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
