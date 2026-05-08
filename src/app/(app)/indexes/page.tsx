"use client";

import { useEffect, useMemo, useState } from "react";
import { ShareButton } from "@/components/ShareButton";
import { formatNumber, formatUsd } from "@/lib/money";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const intervals = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y", "ALL"] as const;
type IntervalKey = (typeof intervals)[number];

type StockApiResponse = {
  symbol: string;
  name: string;
  changePct: number | null;
  chart?: Array<{ at: string; close: number }>;
  metrics?: { price?: number | null };
  error?: string;
};

type MarketIndicatorsResponse = {
  fearGreed: number | null;
  fearGreedLabel: string | null;
  putCall: number | null;
  aaiiBullish: number | null;
  aaiiBearish: number | null;
  aaiiSpread: number | null;
};

type IndexDef = {
  symbol: string;
  label: string;
  standard: string;
  howToRead: string;
};

const coreIndexes: IndexDef[] = [
  {
    symbol: "^GSPC",
    label: "S&P 500",
    standard: "Broad US large-cap benchmark.",
    howToRead: "Strong trend here often reflects overall market risk appetite.",
  },
  {
    symbol: "^IXIC",
    label: "NASDAQ Composite",
    standard: "More growth/tech heavy and usually more volatile.",
    howToRead: "Outperformance can signal growth leadership; underperformance may indicate risk-off.",
  },
  {
    symbol: "^DJI",
    label: "Dow Jones",
    standard: "Price-weighted blue-chip basket with a defensive tilt.",
    howToRead: "Relative strength can indicate rotation into lower-volatility names.",
  },
  {
    symbol: "^RUT",
    label: "Russell 2000",
    standard: "Small-cap participation gauge.",
    howToRead: "Broad rallies are healthier when small-caps confirm with participation.",
  },
];

type IndicatorDef = {
  key: string;
  label: string;
  symbol?: string;
  standard: string;
  howToRead: string;
  format?: "price" | "number" | "percent";
};

const indicators: IndicatorDef[] = [
  {
    key: "vix",
    label: "VIX",
    symbol: "^VIX",
    standard: "Below ~20 usually calmer; above ~30 elevated stress.",
    howToRead: "Rising VIX with falling equities typically signals expanding fear.",
    format: "number",
  },
  {
    key: "fear-greed",
    label: "Fear & Greed",
    standard: "0-24 Extreme Fear, 25-44 Fear, 45-55 Neutral, 56-75 Greed, 76-100 Extreme Greed.",
    howToRead: "Extremes often become contrarian signals while persistent regimes reinforce trend.",
    format: "number",
  },
  {
    key: "aaii-spread",
    label: "AAII Bull-Bear Spread",
    standard: "Bullish % minus bearish %; very negative often marks pessimism extremes.",
    howToRead: "Deeply negative spread can align with capitulation; high positive can imply complacency.",
    format: "percent",
  },
  {
    key: "put-call",
    label: "Put/Call Ratio",
    symbol: "^CPC",
    standard: "~0.7-1.0 often normal; sustained >1.0 implies heavy hedging.",
    howToRead: "High readings indicate stronger put demand and risk aversion.",
    format: "number",
  },
  {
    key: "dxy",
    label: "US Dollar Index (DXY)",
    symbol: "DX-Y.NYB",
    standard: "Tracks broad USD strength vs a major-currency basket.",
    howToRead: "A stronger dollar can pressure risk assets and financial conditions.",
    format: "number",
  },
  {
    key: "tnx",
    label: "US 10Y Yield",
    symbol: "^TNX",
    standard: "Benchmark long-term rate for discounting cash flows.",
    howToRead: "Rapid yield rises can pressure longer-duration growth assets.",
    format: "number",
  },
];

function colorPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "text-slate-300";
  return v >= 0 ? "text-emerald-300" : "text-rose-300";
}

function formatPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v > 0 ? "+" : ""}${formatNumber(v, 2)}%`;
}

function InfoModal({
  open,
  title,
  standard,
  howToRead,
  onClose,
}: {
  open: boolean;
  title: string;
  standard: string;
  howToRead: string;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-md border border-(--card-border) px-2 py-1 text-xs">
            Close
          </button>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <p>
            <span className="font-semibold text-sky-300">Standard:</span> {standard}
          </p>
          <p>
            <span className="font-semibold text-violet-300">How to read:</span> {howToRead}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function IndexesPage() {
  const [interval, setInterval] = useState<IntervalKey>("1M");
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<Record<string, Partial<Record<IntervalKey, { pct: number | null; price: number | null }>>>>({});
  const [indicatorValues, setIndicatorValues] = useState<Record<string, number | null>>({});
  const [sentiment, setSentiment] = useState<MarketIndicatorsResponse | null>(null);
  const [chartRows, setChartRows] = useState<Array<{ at: string; close: number; idx: number }>>([]);
  const [chartName, setChartName] = useState<string>("");
  const [chartLoading, setChartLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoItem, setInfoItem] = useState<{ title: string; standard: string; howToRead: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const rows = await Promise.all(
          coreIndexes.flatMap((idx) =>
            intervals.map(async (iv) => {
              const res = await fetch(`/api/stocks/${encodeURIComponent(idx.symbol)}?interval=${iv}`);
              const json = (await res.json()) as StockApiResponse;
              if (!res.ok) throw new Error(json.error ?? `Could not load ${idx.label}`);
              return { symbol: idx.symbol, interval: iv, pct: json.changePct, price: json.metrics?.price ?? null };
            })
          )
        );
        const out: Record<string, Partial<Record<IntervalKey, { pct: number | null; price: number | null }>>> = {};
        for (const row of rows) {
          if (!out[row.symbol]) out[row.symbol] = {};
          out[row.symbol]![row.interval] = { pct: row.pct, price: row.price };
        }
        if (!cancelled) setMatrix(out);

        const [signalsRes, indicatorRows] = await Promise.all([
          fetch("/api/market-indicators").then((r) => r.json() as Promise<MarketIndicatorsResponse>),
          Promise.all(
            indicators
              .filter((x) => x.symbol)
              .map(async (x) => {
                const res = await fetch(`/api/stocks/${encodeURIComponent(x.symbol!)}?interval=1D`);
                const json = (await res.json()) as StockApiResponse;
                return { key: x.key, value: res.ok ? json.metrics?.price ?? null : null };
              })
          ),
        ]);
        if (!cancelled) {
          setSentiment(signalsRes);
          const vals: Record<string, number | null> = {};
          for (const r of indicatorRows) vals[r.key] = r.value;
          vals["fear-greed"] = signalsRes.fearGreed;
          vals["aaii-spread"] = signalsRes.aaiiSpread;
          if (signalsRes.putCall != null) vals["put-call"] = signalsRes.putCall;
          setIndicatorValues(vals);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load indexes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const chartTitle = useMemo(() => coreIndexes.find((x) => x.symbol === chartSymbol)?.label ?? "", [chartSymbol]);

  useEffect(() => {
    let cancelled = false;
    async function loadChart() {
      if (!chartSymbol) {
        setChartRows([]);
        setChartName("");
        return;
      }
      setChartLoading(true);
      try {
        const res = await fetch(`/api/stocks/${encodeURIComponent(chartSymbol)}?interval=${interval}`);
        const json = (await res.json()) as StockApiResponse;
        if (!res.ok) throw new Error(json.error ?? "Could not load chart.");
        if (cancelled) return;
        setChartName(json.name ?? chartSymbol);
        setChartRows(
          (json.chart ?? []).map((r, idx) => ({
            at: r.at,
            close: r.close,
            idx,
          }))
        );
      } catch {
        if (!cancelled) setChartRows([]);
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    }
    void loadChart();
    return () => {
      cancelled = true;
    };
  }, [chartSymbol, interval]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-cyan-400/40 bg-gradient-to-br from-slate-900/95 via-slate-800 to-cyan-900/35 px-5 py-4 shadow-lg shadow-cyan-700/25">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="bg-linear-to-r from-cyan-200 via-sky-200 to-violet-200 bg-clip-text text-2xl font-semibold tracking-tight text-transparent">Indexes</h1>
            <p className="mt-1 text-sm text-slate-200">
              Monitor the macro tape with core benchmarks, chart context, and sentiment/volatility indicators.
            </p>
          </div>
          <ShareButton title="Indexes" url="/indexes" />
        </div>
      </section>

      <section className="rounded-2xl border border-sky-400/35 bg-gradient-to-br from-slate-900/90 to-slate-800/80 p-4 shadow-lg shadow-sky-700/20">
        <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="shrink-0 text-sm font-semibold uppercase tracking-wide text-(--muted)">Core Market Indexes</h2>
          <div className="scrollbar-hide flex min-w-0 gap-1 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] sm:flex-wrap sm:overflow-visible sm:pb-0">
            {intervals.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setInterval(k)}
                className={
                  "shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-xs " +
                  (interval === k ? "bg-(--accent) text-(--accent-foreground)" : "border border-(--card-border) hover:bg-(--background)")
                }
              >
                {k}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-(--muted)">Loading index data…</p>
        ) : error ? (
          <p className="text-sm text-rose-300">{error}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {coreIndexes.map((idx) => {
              const row = matrix[idx.symbol]?.[interval];
              return (
                <article
                  key={idx.symbol}
                  className="rounded-xl border border-(--card-border) bg-(--background) p-3 transition hover:border-cyan-400/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{idx.label}</h3>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setInfoItem({ title: idx.label, standard: idx.standard, howToRead: idx.howToRead })}
                        className="rounded-full border border-(--card-border) px-1.5 py-0.5 text-[10px] text-(--muted)"
                      >
                        i
                      </button>
                      <button
                        type="button"
                        onClick={() => setChartSymbol((cur) => (cur === idx.symbol ? null : idx.symbol))}
                        className={
                          "rounded-full border px-1.5 py-0.5 text-[10px] " +
                          (chartSymbol === idx.symbol
                            ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100"
                            : "border-(--card-border) text-(--muted)")
                        }
                        aria-label={`Toggle chart for ${idx.label}`}
                        title="Show chart"
                      >
                        📈
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-lg font-semibold tabular-nums">{formatUsd(row?.price)}</p>
                  <p className={"text-sm font-medium tabular-nums " + colorPct(row?.pct)}>{formatPct(row?.pct)}</p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {chartSymbol ? (
        <section className="rounded-2xl border border-violet-400/35 bg-gradient-to-br from-slate-900/90 to-indigo-900/70 p-4 shadow-lg shadow-violet-700/20">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-(--muted)">
              {chartTitle} Chart ({interval})
            </h2>
            <button
              type="button"
              onClick={() => setChartSymbol(null)}
              className="rounded-md border border-(--card-border) px-2 py-1 text-xs hover:bg-(--background)"
            >
              Hide chart
            </button>
          </div>
          <div className="h-80 rounded-xl border border-(--card-border) bg-(--background) p-2">
            {chartLoading ? (
              <p className="px-2 py-3 text-sm text-(--muted)">Loading chart…</p>
            ) : chartRows.length === 0 ? (
              <p className="px-2 py-3 text-sm text-(--muted)">No chart data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} margin={{ top: 16, right: 8, left: 0, bottom: 4 }}>
                  <XAxis
                    dataKey="idx"
                    minTickGap={28}
                    tick={{ fontSize: 11, fill: "rgba(148,163,184,0.95)" }}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(148,163,184,0.6)" }}
                    tickFormatter={(v) => {
                      const row = chartRows[Number(v)];
                      if (!row) return "";
                      const d = new Date(row.at);
                      return interval === "1D"
                        ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                        : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    width={58}
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => formatNumber(Number(v), 1)}
                  />
                  <Tooltip
                    cursor={false}
                    formatter={(value) => [formatUsd(Number(value)), chartName || chartTitle]}
                    labelFormatter={(label) => {
                      const row = chartRows[Number(label)];
                      if (!row) return "";
                      return new Date(row.at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: interval === "1D" || interval === "1W" ? "numeric" : undefined,
                        minute: interval === "1D" || interval === "1W" ? "2-digit" : undefined,
                      });
                    }}
                  />
                  <Line type="monotone" dataKey="close" stroke="#22d3ee" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-cyan-400/35 bg-gradient-to-br from-slate-900/90 to-slate-800/75 p-4 shadow-lg shadow-cyan-700/20">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-(--muted)">Sentiment & Risk Indicators</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {indicators.map((item) => {
            const value = indicatorValues[item.key] ?? null;
            const rawClass =
              item.key === "vix"
                ? value != null && value >= 30
                  ? "text-rose-300"
                  : value != null && value <= 18
                    ? "text-emerald-300"
                    : "text-amber-300"
                : item.key === "fear-greed"
                  ? value != null && value >= 76
                    ? "text-rose-300"
                    : value != null && value <= 24
                      ? "text-cyan-300"
                      : "text-emerald-300"
                  : "text-violet-200";
            return (
              <article key={item.key} className="rounded-xl border border-(--card-border) bg-gradient-to-br from-slate-900/80 to-slate-800/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold">{item.label}</h3>
                  <button
                    type="button"
                    onClick={() => setInfoItem({ title: item.label, standard: item.standard, howToRead: item.howToRead })}
                    className="rounded-full border border-(--card-border) px-1.5 py-0.5 text-[10px] text-(--muted)"
                  >
                    i
                  </button>
                </div>
                <p className={"mt-2 text-lg font-semibold tabular-nums " + rawClass}>
                  {value == null
                    ? "Data unavailable"
                    : item.format === "percent"
                      ? `${formatNumber(value, 2)}%`
                      : item.format === "price"
                        ? formatUsd(value)
                        : formatNumber(value, 2)}
                </p>
                {item.key === "fear-greed" && sentiment?.fearGreedLabel ? (
                  <p className="mt-1 text-xs text-(--muted)">Current regime: {sentiment.fearGreedLabel}</p>
                ) : null}
                {item.key === "aaii-spread" ? (
                  <p className="mt-1 text-xs text-(--muted)">
                    Bulls {formatNumber(sentiment?.aaiiBullish, 1)}% · Bears {formatNumber(sentiment?.aaiiBearish, 1)}%
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <InfoModal
        open={Boolean(infoItem)}
        title={infoItem?.title ?? ""}
        standard={infoItem?.standard ?? ""}
        howToRead={infoItem?.howToRead ?? ""}
        onClose={() => setInfoItem(null)}
      />
    </div>
  );
}

