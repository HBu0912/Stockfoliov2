"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatMarketCap, formatNumber, formatUsd } from "@/lib/money";
import { TickerSymbol } from "@/components/TickerSymbol";
import { StockComparisonOverlayChart, type CompareIntervalKey } from "@/components/StockComparisonOverlayChart";
import { ShareButton } from "@/components/ShareButton";

type ComparedStock = {
  symbol: string;
  name: string;
  price: number;
  marketCap: number | null;
  beta: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  pegRatio: number | null;
  priceToBook: number | null;
  profitMargin: number | null;
  returnOnEquity: number | null;
  dividendYield: number | null;
};

type MetricConfig = {
  key: keyof ComparedStock;
  label: string;
  description: string;
  wins: "higher" | "lower";
  format: (value: number | null) => string;
};

const metricConfigs: MetricConfig[] = [
  {
    key: "price",
    label: "Price",
    description: "Current market price per share.",
    wins: "higher",
    format: (v) => formatUsd(v),
  },
  {
    key: "marketCap",
    label: "Market Cap",
    description: "Total company equity value (share price times shares outstanding).",
    wins: "higher",
    format: (v) => formatMarketCap(v),
  },
  {
    key: "beta",
    label: "Beta",
    description: "How volatile the stock is relative to the market.",
    wins: "lower",
    format: (v) => formatNumber(v, 2),
  },
  {
    key: "trailingPE",
    label: "P/E",
    description: "Price divided by trailing 12-month earnings per share.",
    wins: "lower",
    format: (v) => formatNumber(v, 2),
  },
  {
    key: "forwardPE",
    label: "Forward P/E",
    description: "Price divided by expected next-12-month earnings per share.",
    wins: "lower",
    format: (v) => formatNumber(v, 2),
  },
  {
    key: "pegRatio",
    label: "PEG Ratio",
    description: "P/E adjusted by expected earnings growth rate.",
    wins: "lower",
    format: (v) => formatNumber(v, 2),
  },
  {
    key: "priceToBook",
    label: "Price/Book",
    description: "Market price relative to book value per share.",
    wins: "lower",
    format: (v) => formatNumber(v, 2),
  },
  {
    key: "profitMargin",
    label: "Profit Margin",
    description: "Share of revenue kept as net profit.",
    wins: "higher",
    format: (v) => (v == null ? "—" : `${formatNumber(v * 100, 2)}%`),
  },
  {
    key: "returnOnEquity",
    label: "Return on Equity",
    description: "Net income generated per dollar of shareholder equity.",
    wins: "higher",
    format: (v) => (v == null ? "—" : `${formatNumber(v * 100, 2)}%`),
  },
  {
    key: "dividendYield",
    label: "Dividend Yield",
    description: "Annual dividend payout as a percentage of share price.",
    wins: "higher",
    format: (v) => (v == null ? "—" : `${formatNumber(v, 2)}%`),
  },
];

function normalizeTicker(text: string): string {
  return text.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

const compareIntervals: CompareIntervalKey[] = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y", "ALL"];

const LS_TICKERS = "pf-stock-comparison-tickers";
const LS_INTERVAL = "pf-stock-comparison-interval";
const MAX_COMPARE = 5;
const tickerNameColors = [
  "#60a5fa",
  "#f59e0b",
  "#a78bfa",
  "#06b6d4",
  "#8b5cf6",
];

export default function StockComparisonPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [tickerInput, setTickerInput] = useState("");
  const [tickers, setTickers] = useState<string[]>([]);
  const [stocks, setStocks] = useState<ComparedStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartInterval, setChartInterval] = useState<CompareIntervalKey>("1M");
  const [activeTab, setActiveTab] = useState<"overlay" | "metrics">("overlay");
  const [hydrated, setHydrated] = useState(false);

  const urlSymbols = useMemo(
    () =>
      (params.get("symbols") ?? "")
        .split(",")
        .map((s) => normalizeTicker(s))
        .filter(Boolean)
        .slice(0, MAX_COMPARE),
    [params]
  );

  useEffect(() => {
    try {
      if (urlSymbols.length > 0) {
        setTickers(urlSymbols);
      } else {
        const raw = localStorage.getItem(LS_TICKERS);
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) {
            const cleaned = [
              ...new Set(parsed.map((x) => normalizeTicker(String(x))).filter(Boolean)),
            ].slice(0, MAX_COMPARE);
            setTickers(cleaned);
          }
        }
      }
      const iv = localStorage.getItem(LS_INTERVAL);
      if (iv && compareIntervals.includes(iv as CompareIntervalKey)) {
        setChartInterval(iv as CompareIntervalKey);
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, [urlSymbols]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LS_TICKERS, JSON.stringify(tickers));
    } catch {
      // ignore
    }
    const cur = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (tickers.length > 0) cur.set("symbols", tickers.join(","));
    else cur.delete("symbols");
    router.replace(`${pathname}?${cur.toString()}`, { scroll: false });
  }, [tickers, hydrated, router, pathname]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LS_INTERVAL, chartInterval);
    } catch {
      // ignore
    }
  }, [chartInterval, hydrated]);

  const tickersKey = tickers.join(",");

  useEffect(() => {
    if (!hydrated) return;
    if (tickers.length < 2) {
      setStocks([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const params = new URLSearchParams({ symbols: tickers.join(",") });
        const res = await fetch(`/api/stocks/compare?${params.toString()}`);
        const data = (await res.json().catch(() => ({}))) as {
          stocks?: ComparedStock[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.stocks) {
          setError(data.error ?? "Could not compare symbols.");
          setStocks([]);
          return;
        }
        setStocks(data.stocks);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, tickersKey]);

  function addTicker() {
    const symbol = normalizeTicker(tickerInput);
    if (!symbol) return;
    if (tickers.includes(symbol)) {
      setTickerInput("");
      return;
    }
    if (tickers.length >= MAX_COMPARE) return;
    setTickers((prev) => [...prev, symbol]);
    setTickerInput("");
  }

  function removeTicker(symbol: string) {
    setTickers((prev) => prev.filter((s) => s !== symbol));
  }

  const winnerMap = useMemo(() => {
    const winners = new Map<string, Set<string>>();
    for (const metric of metricConfigs) {
      const values = stocks
        .map((stock) => ({ symbol: stock.symbol, value: stock[metric.key] }))
        .filter((row): row is { symbol: string; value: number } => row.value != null);
      if (values.length === 0) {
        winners.set(metric.key, new Set());
        continue;
      }
      const target =
        metric.wins === "higher"
          ? Math.max(...values.map((x) => x.value))
          : Math.min(...values.map((x) => x.value));
      winners.set(
        metric.key,
        new Set(values.filter((x) => x.value === target).map((x) => x.symbol))
      );
    }
    return winners;
  }, [stocks]);

  const chartSymbols = tickers.length >= 2 ? tickers : [];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-cyan-400/40 bg-gradient-to-br from-slate-900/95 to-indigo-900/70 px-5 py-4 shadow-lg shadow-cyan-700/25">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="bg-linear-to-r from-cyan-200 via-sky-200 to-violet-200 bg-clip-text text-2xl font-semibold tracking-tight text-transparent">Stock Comparison</h1>
            <p className="mt-1 text-sm text-slate-300">Compare tickers against each other.</p>
          </div>
          <ShareButton
            title={`Stock Comparison: ${tickers.join(", ") || "selection"}`}
            url={`/stock-comparison?symbols=${encodeURIComponent(tickers.join(","))}`}
          />
        </div>
      </div>

      <section className="rounded-2xl border border-sky-400/35 bg-gradient-to-br from-slate-900/90 to-slate-800/80 p-4 shadow-lg shadow-sky-700/20">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex-1">
            <span className="mb-1 block text-sm text-slate-300">Ticker symbol</span>
            <input
              className="w-full rounded-md border border-cyan-400/30 bg-slate-900/80 px-3 py-2 text-sm font-mono uppercase"
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTicker();
                }
              }}
              placeholder="AAPL"
            />
          </label>
          <button
            type="button"
            onClick={addTicker}
            disabled={tickers.length >= MAX_COMPARE}
            className="rounded-md border border-violet-400/35 bg-violet-500/15 px-3 py-2 text-sm text-violet-100 hover:bg-violet-500/25 disabled:opacity-60"
          >
            Add Symbol
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {tickers.map((symbol) => (
            <span
              key={symbol}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-slate-900/75 px-3 py-1 text-sm font-mono"
            >
              {symbol}
              <button
                type="button"
                onClick={() => removeTicker(symbol)}
                className="text-(--muted) hover:text-foreground"
                aria-label={`Remove ${symbol}`}
              >
                x
              </button>
            </span>
          ))}
        </div>

        {error && (
          <p className="mt-2 rounded-md border border-red-400/35 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}
      </section>

      <section className="space-y-3">
        {tickers.length < 2 ? (
          <div className="rounded-2xl border border-sky-400/35 bg-gradient-to-br from-slate-900/90 to-slate-800/75 px-4 py-8 text-center text-sm text-slate-300 shadow-lg shadow-sky-700/20">
            Add at least two symbols (up to five). Your list is saved for next visit.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-cyan-400/30 bg-slate-900/80 p-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("overlay")}
                  className={
                    "rounded-md px-3 py-1.5 text-xs font-semibold " +
                    (activeTab === "overlay"
                      ? "bg-(--accent) text-(--accent-foreground)"
                      : "border border-(--card-border) hover:bg-(--background)")
                  }
                >
                  Overlay Performance
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("metrics")}
                  className={
                    "rounded-md px-3 py-1.5 text-xs font-semibold " +
                    (activeTab === "metrics"
                      ? "bg-(--accent) text-(--accent-foreground)"
                      : "border border-(--card-border) hover:bg-(--background)")
                  }
                >
                  Comparison Metrics
                </button>
              </div>

              {activeTab === "overlay" && (
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-violet-400/30 bg-slate-900/80 px-3 py-2 shadow-lg shadow-violet-700/15">
                  <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-300">
                    Chart window
                  </p>
                  <div className="scrollbar-hide flex max-w-full flex-nowrap gap-1 overflow-x-auto [-webkit-overflow-scrolling:touch] sm:flex-wrap sm:overflow-visible">
                    {compareIntervals.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setChartInterval(k)}
                        className={
                          "shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-xs " +
                          (chartInterval === k
                            ? "bg-(--accent) text-(--accent-foreground)"
                            : "border border-(--card-border) hover:bg-(--background)")
                        }
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "overlay" && (
                <StockComparisonOverlayChart
                  symbols={chartSymbols}
                  interval={chartInterval}
                  heightClassName="h-[min(64vh,680px)] min-h-[340px] w-full"
                />
              )}
              {loading && stocks.length === 0 && (
                <p className="text-center text-sm text-(--muted)">Loading comparison…</p>
              )}

              {stocks.length > 0 && activeTab === "metrics" && (
                <div className="rounded-2xl border border-sky-400/30 bg-gradient-to-br from-slate-900/90 to-slate-800/75 p-4 shadow-lg shadow-sky-700/20 ring-1 ring-black/5 dark:ring-white/10">
                  <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-base font-semibold tracking-tight text-foreground">Comparison metrics</p>
                    <p className="text-xs text-(--muted)">
                      Highlighted cells are strongest for that metric (ties can share the highlight).
                    </p>
                  </div>

                  <div className="rounded-xl">
                    <div className="min-w-0 space-y-0">
                      <div
                        className="grid gap-2 border-b border-(--card-border) pb-2"
                        style={{
                          gridTemplateColumns: `minmax(100px,120px) repeat(${stocks.length}, minmax(0,1fr))`,
                        }}
                      >
                        <div className="flex h-11 items-center rounded-lg bg-indigo-600 px-2 text-xs font-bold uppercase tracking-wide text-white dark:bg-indigo-500">
                          Metric
                        </div>
                        {stocks.map((stock, colIdx) => (
                          <div
                            key={`head-${stock.symbol}`}
                            className={
                              "flex h-11 w-full min-w-0 items-center justify-center overflow-hidden rounded-lg border px-2 " +
                              (colIdx % 2 === 0
                                ? "border-zinc-200/90 bg-zinc-50 dark:border-zinc-600/60 dark:bg-zinc-800/50"
                                : "border-zinc-200/90 bg-white dark:border-zinc-600/60 dark:bg-zinc-900/40")
                            }
                          >
                            <span
                              className="block w-full min-w-0"
                              style={{ color: tickerNameColors[colIdx % tickerNameColors.length] }}
                            >
                              <TickerSymbol
                                symbol={stock.symbol}
                                className="block w-full min-w-0 truncate text-center text-sm font-extrabold tracking-tight underline-offset-2 hover:underline"
                              />
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-2 space-y-1">
                        {metricConfigs.map((metric, rowIdx) => (
                          <div
                            key={`metric-${metric.key}`}
                            className={
                              "grid gap-2 rounded-lg px-1 py-1.5 transition-colors " +
                              (rowIdx % 2 === 0
                                ? "bg-zinc-50/80 dark:bg-zinc-900/25"
                                : "bg-transparent")
                            }
                            style={{
                              gridTemplateColumns: `minmax(100px,120px) repeat(${stocks.length}, minmax(0,1fr))`,
                            }}
                          >
                            <div className="flex min-h-10 min-w-0 items-center justify-between gap-1.5 rounded-md bg-indigo-600 pl-2 pr-1.5 text-xs font-semibold text-white dark:bg-indigo-500">
                              <span className="min-w-0 pr-1 leading-tight">{metric.label}</span>
                              <span className="group relative inline-flex shrink-0">
                                <button
                                  type="button"
                                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white text-[10px] font-bold text-zinc-500 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                                  aria-label={`${metric.label} description`}
                                >
                                  i
                                </button>
                                <span className="pointer-events-none absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-(--card-border) bg-(--card) px-2 py-1.5 text-left text-[11px] font-normal leading-snug text-(--muted) opacity-0 shadow-lg whitespace-normal break-words group-hover:opacity-100">
                                  {metric.description}
                                </span>
                              </span>
                            </div>

                            {stocks.map((stock, colIdx) => {
                              const value = stock[metric.key] as number | null;
                              const isWinner = winnerMap.get(metric.key)?.has(stock.symbol) ?? false;
                              const baseCol = "border-zinc-300/80 bg-zinc-100/70 dark:border-zinc-700/50 dark:bg-zinc-900/40";
                              return (
                                <div
                                  key={`${metric.key}-${stock.symbol}`}
                                  className={
                                    "flex min-h-10 items-center justify-center overflow-hidden rounded-lg border px-2 text-center text-sm tabular-nums " +
                                    (isWinner
                                      ? "border-emerald-600 bg-emerald-200/90 font-semibold text-emerald-950 shadow-sm dark:border-emerald-400 dark:bg-emerald-500/35 dark:text-emerald-50"
                                      : baseCol + " font-medium text-zinc-500 dark:text-zinc-400")
                                  }
                                  title={metric.format(value)}
                                >
                                  <span className="block min-w-0 truncate">{metric.format(value)}</span>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
