"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMarketCap, formatNumber, formatUsd } from "@/lib/money";

const intervals = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y", "ALL"] as const;
type IntervalKey = (typeof intervals)[number];

type Payload = {
  symbol: string;
  name: string;
  interval: IntervalKey;
  chart: Array<{ at: string; close: number }>;
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

export function StockAnalysisPanel({ symbol }: { symbol: string }) {
  const [interval, setInterval] = useState<IntervalKey>("1M");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Payload | null>(null);

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
      (data?.chart ?? []).map((row) => ({
        ...row,
        label: new Date(row.at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      })),
    [data]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{data?.symbol ?? symbol.toUpperCase()}</h3>
          <p className="text-sm text-(--muted)">{data?.name ?? "Loading company..."}</p>
        </div>
        <Link
          href={`/stock-analysis?symbol=${encodeURIComponent(symbol.toUpperCase())}`}
          className="rounded-md border border-(--card-border) px-3 py-1.5 text-xs hover:bg-(--background)"
        >
          View in Stock Analysis
        </Link>
      </div>

      <div className="flex flex-wrap gap-1">
        {intervals.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setInterval(k)}
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
            <LineChart data={chartRows}>
              <XAxis dataKey="label" minTickGap={28} tick={{ fontSize: 11 }} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} width={56} />
              <Tooltip formatter={(value: number) => formatUsd(value)} />
              <Line type="monotone" dataKey="close" stroke="#34d399" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Price" value={formatUsd(data?.metrics.price)} />
        <MetricCard label="Market Cap" value={formatMarketCap(data?.metrics.marketCap)} />
        <MetricCard label="Beta" value={formatNumber(data?.metrics.beta, 2)} />
        <MetricCard label="P/E" value={formatNumber(data?.metrics.trailingPE, 2)} />
        <MetricCard label="Forward P/E" value={formatNumber(data?.metrics.forwardPE, 2)} />
        <MetricCard label="PEG Ratio" value={formatNumber(data?.metrics.pegRatio, 2)} />
        <MetricCard label="Price/Book" value={formatNumber(data?.metrics.priceToBook, 2)} />
        <MetricCard label="Profit Margin" value={formatPct(data?.metrics.profitMargin)} />
        <MetricCard label="Return on Equity" value={formatPct(data?.metrics.returnOnEquity)} />
        <MetricCard label="Dividend Yield" value={formatPct(data?.metrics.dividendYield)} />
      </div>

      <div className="rounded-xl border border-(--card-border) bg-(--background) p-3">
        <p className="text-xs text-(--muted)">52 Week Range</p>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span>{formatUsd(data?.metrics.week52Low)}</span>
          <span className="text-(--muted)">to</span>
          <span>{formatUsd(data?.metrics.week52High)}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-(--card-border)">
          <div
            className="h-2 rounded-full bg-emerald-400"
            style={{ width: `${rangePct ?? 0}%` }}
          />
        </div>
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
