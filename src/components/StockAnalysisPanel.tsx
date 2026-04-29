"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMarketCap, formatNumber, formatUsd } from "@/lib/money";

const intervals = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y", "ALL"] as const;
type IntervalKey = (typeof intervals)[number];

type PortfolioAllocation = {
  inPortfolio: boolean;
  allocationPct: number | null;
  positionValue: number;
  portfolioValue: number;
};

type Payload = {
  symbol: string;
  name: string;
  interval: IntervalKey;
  chart: Array<{ at: string; close: number }>;
  changePct: number | null;
  sector: string | null;
  industry: string | null;
  exchange: string | null;
  currency: string | null;
  marketState: string | null;
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
  newsMeta: {
    limit: number;
    offset: number;
    returned: number;
    totalAvailable: number;
    fetched: number;
    hasMore: boolean;
  };
  context: {
    avgVolume10Day: number | null;
    avgVolume3Month: number | null;
    regularMarketVolume: number | null;
    fiftyDayAverage: number | null;
    twoHundredDayAverage: number | null;
    fiftyTwoWeekChangePercent: number | null;
    trailingAnnualDividendRate: number | null;
    epsTrailingTwelveMonths: number | null;
    epsForward: number | null;
  };
  metrics: {
    price: number | null;
    marketCap: number | null;
    marketCapText: string | null;
    beta: number | null;
    trailingPE: number | null;
    forwardPE: number | null;
    pegRatio: number | null;
    priceToBook: number | null;
    profitMargin: number | null;
    returnOnEquity: number | null;
    dividendYield: number | null;
    enterpriseValue: number | null;
    enterpriseToRevenue: number | null;
    enterpriseToEbitda: number | null;
    week52Low: number | null;
    week52High: number | null;
  };
};

function formatPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${formatNumber(v * 100, 2)}%`;
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

function PriceTooltip({
  active,
  payload,
  interval,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { at?: string; close?: number; pct?: number } }>;
  interval: IntervalKey;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { at?: string; close?: number; pct?: number } | undefined;
  if (!row?.at || row.close == null) return null;
  return (
    <div className="rounded-xl border border-(--card-border) bg-(--card) px-3 py-2 text-xs shadow-lg">
      <p className="text-(--muted)">{formatTooltipDate(row.at, interval)}</p>
      <p className="mt-1 text-sm font-semibold">{formatUsd(row.close)}</p>
      <p className="text-(--muted)">
        {row.pct == null ? "—" : `${row.pct > 0 ? "+" : ""}${formatNumber(row.pct, 2)}%`}
      </p>
    </div>
  );
}

function AnalystRatingBubbles({ analyst }: { analyst: NonNullable<Payload["analyst"]> }) {
  const items = [
    { key: "strongBuy", label: "Strong buy", count: analyst.strongBuy, bubble: "bg-green-800 text-white" },
    { key: "buy", label: "Buy", count: analyst.buy, bubble: "bg-green-300 text-green-950" },
    { key: "hold", label: "Hold", count: analyst.hold, bubble: "bg-yellow-300 text-yellow-950" },
    { key: "sell", label: "Sell", count: analyst.sell, bubble: "bg-orange-500 text-white" },
    { key: "strongSell", label: "Strong sell", count: analyst.strongSell, bubble: "bg-red-600 text-white" },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.key}
          className={
            "rounded-2xl border border-(--card-border) px-3 py-3 text-center shadow-sm " + item.bubble
          }
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-90">{item.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{item.count}</p>
        </div>
      ))}
    </div>
  );
}

export function StockAnalysisPanel({
  symbol,
  showOpenPageButton = true,
}: {
  symbol: string;
  showOpenPageButton?: boolean;
}) {
  const [interval, setInterval] = useState<IntervalKey>("1M");
  const [reloadToken, setReloadToken] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Payload | null>(null);
  const [allocation, setAllocation] = useState<PortfolioAllocation | null>(null);

  const [newsOffset, setNewsOffset] = useState(0);
  const newsLimit = 5;

  const [dragging, setDragging] = useState(false);
  const [dragStartIdx, setDragStartIdx] = useState<number | null>(null);
  const [dragEndIdx, setDragEndIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [dragMoved, setDragMoved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!symbol) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          interval,
          newsLimit: String(newsLimit),
          newsOffset: String(newsOffset),
        });
        const res = await fetch(`/api/stocks/${encodeURIComponent(symbol)}?${params.toString()}`);
        const json = (await res.json().catch(() => ({}))) as Payload & { error?: string };
        if (!res.ok) {
          if (!cancelled) setError(json.error ?? "Could not load stock analysis.");
          return;
        }
        if (!cancelled) {
          const meta = json.newsMeta;
          const hasMore =
            typeof meta?.hasMore === "boolean"
              ? meta.hasMore
              : (meta?.totalAvailable ?? 0) > (meta?.offset ?? 0) + (meta?.limit ?? newsLimit);
          setData({
            ...json,
            newsMeta: meta
              ? {
                  ...meta,
                  hasMore,
                }
              : json.newsMeta,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [symbol, interval, reloadToken, newsOffset]);

  useEffect(() => {
    let cancelled = false;
    async function loadAllocation() {
      if (!symbol) return;
      try {
        const res = await fetch(
          `/api/portfolio/allocation?symbol=${encodeURIComponent(symbol.trim().toUpperCase())}`
        );
        const json = (await res.json().catch(() => ({}))) as PortfolioAllocation & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setAllocation(null);
          return;
        }
        setAllocation({
          inPortfolio: !!json.inPortfolio,
          allocationPct:
            json.allocationPct != null && Number.isFinite(json.allocationPct) ? json.allocationPct : null,
          positionValue: typeof json.positionValue === "number" ? json.positionValue : 0,
          portfolioValue: typeof json.portfolioValue === "number" ? json.portfolioValue : 0,
        });
      } catch {
        if (!cancelled) setAllocation(null);
      }
    }
    void loadAllocation();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const rangePct = useMemo(() => {
    if (!data?.metrics.week52Low || !data.metrics.week52High || !data.metrics.price) return null;
    const denom = data.metrics.week52High - data.metrics.week52Low;
    if (denom <= 0) return null;
    return Math.max(0, Math.min(100, ((data.metrics.price - data.metrics.week52Low) / denom) * 100));
  }, [data]);

  const chartRows = useMemo(
    () => {
      const base = data?.chart?.[0]?.close;
      return (data?.chart ?? []).map((row, idx) => ({
        ...row,
        pct: base && base !== 0 ? ((row.close - base) / base) * 100 : 0,
        idx,
        label: formatXAxis(row.at, interval),
        tooltipLabel: formatTooltipDate(row.at, interval),
      }));
    },
    [data, interval]
  );

  const headerChange = data?.changePct ?? null;
  const isNegative = headerChange != null && headerChange < 0;

  const selectedRange = useMemo(() => {
    if (dragStartIdx == null || dragEndIdx == null || chartRows.length === 0) return null;
    const left = Math.max(0, Math.min(dragStartIdx, dragEndIdx));
    const right = Math.min(chartRows.length - 1, Math.max(dragStartIdx, dragEndIdx));
    if (!dragMoved) return null;
    if (left === right) return null;
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
  }, [chartRows, dragStartIdx, dragEndIdx, dragMoved]);

  const latestNyDateKey = useMemo(() => {
    if (interval !== "1D" || chartRows.length === 0) return null;
    return chartRows.map((r) => newYorkDateKey(r.at)).sort().at(-1) ?? null;
  }, [interval, chartRows]);

  const marketOpenIdx = useMemo(() => {
    if (interval !== "1D" || chartRows.length === 0 || !latestNyDateKey) return null;
    return (
      chartRows.find((r) => {
        return newYorkDateKey(r.at) === latestNyDateKey && minutesInNewYork(r.at) >= 9 * 60 + 30;
      })?.idx ?? null
    );
  }, [interval, chartRows, latestNyDateKey]);

  const marketCloseIdx = useMemo(() => {
    if (interval !== "1D" || chartRows.length === 0 || !latestNyDateKey) return null;
    return (
      chartRows.find((r) => {
        return newYorkDateKey(r.at) === latestNyDateKey && minutesInNewYork(r.at) >= 16 * 60;
      })?.idx ?? null
    );
  }, [interval, chartRows, latestNyDateKey]);

  const xTickFormatter = useMemo(() => {
    if (interval !== "1D") {
      return (value: number) => chartRows[Number(value)]?.label ?? "";
    }
    return (value: number) => {
      if (marketOpenIdx != null && value === marketOpenIdx) return "9:30 AM";
      if (marketCloseIdx != null && value === marketCloseIdx) return "4:00 PM";
      return "";
    };
  }, [interval, marketOpenIdx, marketCloseIdx, chartRows]);

  const chartBubblePct = selectedRange?.pct ?? headerChange;
  const chartBubbleLabel = selectedRange ? `${selectedRange.startLabel} → ${selectedRange.endLabel}` : interval;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">
            {data?.symbol ?? symbol.toUpperCase()}
            <span className="ml-2 text-sm font-medium text-(--muted)">{formatUsd(data?.metrics.price)}</span>
          </h3>
          <p className="text-sm text-(--muted)">{data?.name ?? "Loading company..."}</p>
          <p className="mt-1 text-xs text-(--muted)">
            {[data?.exchange, data?.currency, data?.marketState].filter(Boolean).join(" · ")}
          </p>
          {allocation?.inPortfolio && allocation.allocationPct != null ? (
            <p className="mt-1 text-xs text-(--muted)">
              Your portfolio:{" "}
              <span className="font-semibold text-foreground">
                {formatNumber(allocation.allocationPct, 2)}%
              </span>{" "}
              of total value is in this ticker
              {allocation.portfolioValue > 0 ? (
                <span className="text-(--muted)">
                  {" "}
                  ({formatUsd(allocation.positionValue)} / {formatUsd(allocation.portfolioValue)})
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setNewsOffset(0);
              setDragStartIdx(null);
              setDragEndIdx(null);
              setDragMoved(false);
              setReloadToken((t) => t + 1);
            }}
            className="rounded-md border border-(--card-border) px-3 py-1.5 text-xs hover:bg-(--background)"
          >
            Refresh
          </button>
          {showOpenPageButton && (
            <Link
              href={`/stock-analysis?symbol=${encodeURIComponent(symbol.toUpperCase())}`}
              className="rounded-md border border-(--card-border) px-3 py-1.5 text-xs hover:bg-(--background)"
            >
              View in Stock Analysis
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {intervals.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setInterval(k);
                  setNewsOffset(0);
                  setDragStartIdx(null);
                  setDragEndIdx(null);
                  setDragMoved(false);
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

          <div className="relative h-80 select-none rounded-xl border border-(--card-border) bg-(--background) p-2 lg:h-96">
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
                  margin={{ top: 20, right: 8, left: 0, bottom: 0 }}
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
                    if (idx !== hoverIdx) setHoverIdx(idx);
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
                  <XAxis
                    dataKey="idx"
                    minTickGap={28}
                    tick={interval === "1D" ? { fontSize: 11, fill: "rgba(148,163,184,0.95)" } : false}
                    axisLine={{ stroke: "rgba(148,163,184,0.6)" }}
                    tickLine={false}
                    tickFormatter={xTickFormatter}
                  />
                  <YAxis
                    domain={([min, max]) => {
                      if (typeof min !== "number" || typeof max !== "number") return [min, max];
                      const span = max - min || Math.abs(max || 1);
                      return [min - span * 0.06, max + span * 0.2];
                    }}
                    tickFormatter={(v) => `${formatNumber(typeof v === "number" ? v : Number(v), 2)}%`}
                    tick={{ fontSize: 11, pointerEvents: "none" }}
                    width={56}
                  />
                  <Tooltip content={<PriceTooltip interval={interval} />} cursor={false} />
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
                  <Line
                    type="monotone"
                    dataKey="pct"
                    name="% Change"
                    stroke={isNegative ? "#f87171" : "#34d399"}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
            {chartBubblePct != null && (
              <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-(--card-border) bg-(--card)/95 px-3 py-1 text-xs shadow-sm">
                <span className={chartBubblePct < 0 ? "text-red-400" : "text-emerald-300"}>
                  <span className="mr-1 text-(--muted)">{chartBubbleLabel}</span>
                  {chartBubblePct > 0 ? "+" : ""}
                  {formatNumber(chartBubblePct, 2)}%
                </span>
              </div>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="Market Cap" value={formatMarketCap(data?.metrics.marketCap)} />
            <MetricCard label="Sector" value={data?.sector ?? "—"} />
            <MetricCard label="Industry" value={data?.industry ?? "—"} />
            <MetricCard label="Beta" value={formatNumber(data?.metrics.beta, 2)} />
            <MetricCard label="P/E" value={formatNumber(data?.metrics.trailingPE, 2)} />
            <MetricCard label="Forward P/E" value={formatNumber(data?.metrics.forwardPE, 2)} />
            <MetricCard label="PEG Ratio" value={formatNumber(data?.metrics.pegRatio, 2)} />
            <MetricCard label="Price/Book" value={formatNumber(data?.metrics.priceToBook, 2)} />
            <MetricCard label="Enterprise Value" value={formatMarketCap(data?.metrics.enterpriseValue)} />
            <MetricCard
              label="EV / Revenue"
              value={formatNumber(data?.metrics.enterpriseToRevenue, 2)}
            />
            <MetricCard label="EV / EBITDA" value={formatNumber(data?.metrics.enterpriseToEbitda, 2)} />
            <MetricCard label="Profit Margin" value={formatPct(data?.metrics.profitMargin)} />
            <MetricCard label="Return on Equity" value={formatPct(data?.metrics.returnOnEquity)} />
            <MetricCard label="Dividend Yield" value={formatPct(data?.metrics.dividendYield)} />
            <MetricCard label="EPS (TTM)" value={formatNumber(data?.context.epsTrailingTwelveMonths, 2)} />
            <MetricCard label="EPS (Fwd)" value={formatNumber(data?.context.epsForward, 2)} />
            <MetricCard
              label="Annual Div / Sh"
              value={formatUsd(data?.context.trailingAnnualDividendRate)}
            />
            <MetricCard
              label="52W Chg"
              value={
                data?.context.fiftyTwoWeekChangePercent == null
                  ? "—"
                  : `${formatNumber(data.context.fiftyTwoWeekChangePercent, 2)}%`
              }
            />
            <MetricCard label="50D Avg" value={formatUsd(data?.context.fiftyDayAverage)} />
            <MetricCard label="200D Avg" value={formatUsd(data?.context.twoHundredDayAverage)} />
            <MetricCard label="Vol (day)" value={formatNumber(data?.context.regularMarketVolume, 0)} />
            <MetricCard label="Avg Vol (10D)" value={formatNumber(data?.context.avgVolume10Day, 0)} />
            <MetricCard label="Avg Vol (3M)" value={formatNumber(data?.context.avgVolume3Month, 0)} />
            <div className="rounded-lg border border-(--card-border) bg-(--background) px-3 py-2">
              <p className="text-xs text-(--muted)">52 Week Range</p>
              <p className="text-sm font-medium">
                {formatUsd(data?.metrics.week52Low)} - {formatUsd(data?.metrics.week52High)}
              </p>
              <div className="mt-2 h-2 rounded-full bg-(--card-border)">
                <div className="relative h-2 rounded-full bg-sky-500/30" style={{ width: "100%" }}>
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
            <div className="mt-2">
              {data?.analyst ? (
                <AnalystRatingBubbles analyst={data.analyst} />
              ) : (
                <p className="text-sm text-(--muted)">No analyst ratings available.</p>
              )}
            </div>
          </div>
        </div>

        <aside className="rounded-xl border border-(--card-border) bg-(--background) p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-(--muted)">News</p>
            <button
              type="button"
              onClick={() => {
                setNewsOffset(0);
                setReloadToken((t) => t + 1);
              }}
              className="rounded-md border border-(--card-border) px-2 py-1 text-[11px] hover:bg-(--card)"
            >
              Refresh
            </button>
          </div>

          <div className="mt-2 max-h-[560px] space-y-2 overflow-y-auto pr-1">
            {data?.news?.length ? (
              data.news.map((item) => (
                <div key={item.id} className="rounded-lg border border-(--card-border) bg-(--card) px-3 py-2">
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline-offset-2 hover:underline"
                  >
                    {item.title}
                  </a>
                  <p className="mt-1 text-[11px] text-(--muted)">
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
                </div>
              ))
            ) : (
              <p className="text-sm text-(--muted)">No recent news available.</p>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={!data || !data.newsMeta.hasMore}
              onClick={() => setNewsOffset((o) => o + newsLimit)}
              className="w-full rounded-md border border-(--card-border) px-2 py-1.5 text-[11px] hover:bg-(--card) disabled:opacity-50"
            >
              Load more
            </button>
          </div>
        </aside>
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
