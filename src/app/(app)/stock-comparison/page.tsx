"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMarketCap, formatNumber, formatUsd } from "@/lib/money";
import { TickerSymbol } from "@/components/TickerSymbol";
import { StockComparisonOverlayChart, type CompareIntervalKey } from "@/components/StockComparisonOverlayChart";

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
    format: (v) => (v == null ? "—" : `${formatNumber(v * 100, 2)}%`),
  },
];

function normalizeTicker(text: string): string {
  return text.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

const compareIntervals: CompareIntervalKey[] = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y", "ALL"];

const LS_TICKERS = "pf-stock-comparison-tickers";
const LS_INTERVAL = "pf-stock-comparison-interval";
const MAX_COMPARE = 5;

export default function StockComparisonPage() {
  const [tickerInput, setTickerInput] = useState("");
  const [tickers, setTickers] = useState<string[]>([]);
  const [stocks, setStocks] = useState<ComparedStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartInterval, setChartInterval] = useState<CompareIntervalKey>("1M");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
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
      const iv = localStorage.getItem(LS_INTERVAL);
      if (iv && compareIntervals.includes(iv as CompareIntervalKey)) {
        setChartInterval(iv as CompareIntervalKey);
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LS_TICKERS, JSON.stringify(tickers));
    } catch {
      // ignore
    }
  }, [tickers, hydrated]);

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
      <div className="rounded-2xl border border-(--card-border) bg-(--card) px-5 py-4 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Stock Comparison</h1>
        <p className="mt-1 text-sm text-(--muted)">Add 2–5 tickers; comparison and chart update automatically.</p>
      </div>

      <section className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <label className="flex-1">
            <span className="mb-1 block text-sm text-(--muted)">Ticker symbol</span>
            <input
              className="w-full rounded-md border border-(--card-border) bg-(--background) px-3 py-2 text-sm font-mono uppercase"
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
            className="rounded-md border border-(--card-border) px-3 py-2 text-sm hover:bg-(--background) disabled:opacity-60"
          >
            Add Symbol
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {tickers.map((symbol) => (
            <span
              key={symbol}
              className="inline-flex items-center gap-2 rounded-full border border-(--card-border) bg-(--background) px-3 py-1 text-sm font-mono"
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
          <div className="rounded-2xl border border-(--card-border) bg-(--card) px-4 py-8 text-center text-sm text-(--muted) shadow-sm">
            Add at least two symbols (up to five). Your list is saved for next visit.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-(--card-border) bg-(--card) px-3 py-2 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-(--muted)">Chart window</p>
              <div className="flex flex-wrap gap-1">
                {compareIntervals.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setChartInterval(k)}
                    className={
                      "rounded-md px-2 py-1 text-xs " +
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

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(280px,0.92fr)] lg:items-start">
              <div className="min-w-0">
                <StockComparisonOverlayChart
                  symbols={chartSymbols}
                  interval={chartInterval}
                  heightClassName="h-[min(62vh,640px)] min-h-[320px] w-full"
                />
                {loading && stocks.length === 0 && (
                  <p className="mt-2 text-center text-sm text-(--muted) lg:text-left">Loading comparison…</p>
                )}
              </div>

              <div className="min-w-0">
                {stocks.length > 0 && (
                  <div className="rounded-2xl border border-(--card-border) bg-(--card) p-3 shadow-sm">
                    <div className="mb-2 flex flex-nowrap items-center justify-between gap-2 overflow-hidden">
                      <p className="shrink-0 text-sm font-semibold">Metrics</p>
                      <p className="truncate text-xs text-(--muted)">Green = best per row</p>
                    </div>

                    <div className="overflow-x-auto">
                      <div
                        className="space-y-1"
                        style={{ minWidth: `${112 + stocks.length * 72}px` }}
                      >
                        <div
                          className="grid gap-1.5"
                          style={{
                            gridTemplateColumns: `minmax(88px,112px) repeat(${stocks.length}, minmax(64px,1fr))`,
                          }}
                        >
                          <div className="flex h-9 items-center whitespace-nowrap rounded-lg border border-(--card-border) bg-(--background) px-2 text-xs font-semibold text-(--muted)">
                            Metric
                          </div>
                          {stocks.map((stock) => (
                            <div
                              key={`head-${stock.symbol}`}
                              className="flex h-9 w-full min-w-0 items-center justify-center overflow-hidden rounded-lg border border-(--card-border) bg-(--background) px-1"
                            >
                              <TickerSymbol
                                symbol={stock.symbol}
                                className="block w-full min-w-0 truncate text-center text-xs font-semibold font-sans underline-offset-2 hover:underline"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="divide-y divide-(--card-border) rounded-xl border border-(--card-border) bg-(--background)">
                          {metricConfigs.map((metric) => (
                            <div
                              key={`metric-${metric.key}`}
                              className="grid gap-1.5 px-1.5 py-1"
                              style={{
                                gridTemplateColumns: `minmax(88px,112px) repeat(${stocks.length}, minmax(64px,1fr))`,
                              }}
                            >
                              <div className="flex min-h-9 min-w-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-(--muted)">
                                <span className="min-w-0 truncate">{metric.label}</span>
                                <span className="group relative inline-flex shrink-0">
                                  <button
                                    type="button"
                                    className="h-4 w-4 shrink-0 rounded-full border border-(--card-border) text-[10px] font-semibold text-(--muted)"
                                    aria-label={`${metric.label} description`}
                                  >
                                    i
                                  </button>
                                  <span className="pointer-events-none absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-(--card-border) bg-(--card) px-2 py-1 text-left text-[11px] font-normal leading-snug text-(--muted) opacity-0 shadow-lg whitespace-normal break-words group-hover:opacity-100">
                                    {metric.description}
                                  </span>
                                </span>
                              </div>

                              {stocks.map((stock) => {
                                const value = stock[metric.key] as number | null;
                                const isWinner = winnerMap.get(metric.key)?.has(stock.symbol) ?? false;
                                return (
                                  <div
                                    key={`${metric.key}-${stock.symbol}`}
                                    className={
                                      "flex min-h-9 items-center justify-center overflow-hidden whitespace-nowrap rounded-lg border px-1 text-center text-xs tabular-nums " +
                                      (isWinner
                                        ? "border-emerald-400/70 bg-emerald-500/10 font-semibold text-emerald-200"
                                        : "border-transparent bg-(--card) text-foreground/90")
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
          </div>
        )}
      </section>
    </div>
  );
}
