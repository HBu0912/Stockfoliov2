"use client";

import { useMemo, useState } from "react";
import { formatMarketCap, formatNumber, formatUsd } from "@/lib/money";

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
  better: "higher" | "lower";
  format: (value: number | null) => string;
};

const metricConfigs: MetricConfig[] = [
  { key: "price", label: "Price", better: "higher", format: (v) => formatUsd(v) },
  { key: "marketCap", label: "Market Cap", better: "higher", format: (v) => formatMarketCap(v) },
  { key: "beta", label: "Beta", better: "lower", format: (v) => formatNumber(v, 2) },
  { key: "trailingPE", label: "P/E", better: "lower", format: (v) => formatNumber(v, 2) },
  { key: "forwardPE", label: "Forward P/E", better: "lower", format: (v) => formatNumber(v, 2) },
  { key: "pegRatio", label: "PEG Ratio", better: "lower", format: (v) => formatNumber(v, 2) },
  { key: "priceToBook", label: "Price/Book", better: "lower", format: (v) => formatNumber(v, 2) },
  {
    key: "profitMargin",
    label: "Profit Margin",
    better: "higher",
    format: (v) => (v == null ? "—" : `${formatNumber(v * 100, 2)}%`),
  },
  {
    key: "returnOnEquity",
    label: "Return on Equity",
    better: "higher",
    format: (v) => (v == null ? "—" : `${formatNumber(v * 100, 2)}%`),
  },
  {
    key: "dividendYield",
    label: "Dividend Yield",
    better: "higher",
    format: (v) => (v == null ? "—" : `${formatNumber(v * 100, 2)}%`),
  },
];

function normalizeTicker(text: string): string {
  return text.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

export default function StockComparisonPage() {
  const [tickerInput, setTickerInput] = useState("");
  const [tickers, setTickers] = useState<string[]>(["AAPL", "MSFT"]);
  const [stocks, setStocks] = useState<ComparedStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCompare = tickers.length >= 2 && tickers.length <= 3;

  function addTicker() {
    const symbol = normalizeTicker(tickerInput);
    if (!symbol) return;
    if (tickers.includes(symbol)) {
      setTickerInput("");
      return;
    }
    if (tickers.length >= 3) return;
    setTickers((prev) => [...prev, symbol]);
    setTickerInput("");
  }

  function removeTicker(symbol: string) {
    setTickers((prev) => prev.filter((s) => s !== symbol));
  }

  async function runComparison() {
    if (!canCompare) {
      setError("Choose at least 2 and at most 3 symbols.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ symbols: tickers.join(",") });
      const res = await fetch(`/api/stocks/compare?${params.toString()}`);
      const data = (await res.json().catch(() => ({}))) as {
        stocks?: ComparedStock[];
        error?: string;
      };
      if (!res.ok || !data.stocks) {
        setError(data.error ?? "Could not compare symbols.");
        return;
      }
      setStocks(data.stocks);
    } finally {
      setLoading(false);
    }
  }

  const winnersByMetric = useMemo(() => {
    const winnerMap = new Map<string, Set<string>>();
    for (const metric of metricConfigs) {
      const present = stocks
        .map((stock) => ({
          symbol: stock.symbol,
          value: stock[metric.key],
        }))
        .filter((row): row is { symbol: string; value: number } => row.value != null);
      if (present.length === 0) continue;
      const target =
        metric.better === "higher"
          ? Math.max(...present.map((p) => p.value))
          : Math.min(...present.map((p) => p.value));
      winnerMap.set(
        metric.key,
        new Set(present.filter((p) => p.value === target).map((p) => p.symbol))
      );
    }
    return winnerMap;
  }, [stocks]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-(--card-border) bg-(--card) px-5 py-4 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Stock Comparison</h1>
        <p className="mt-1 text-sm text-(--muted)">
          Compare 2-3 ticker symbols side by side and highlight the metric winners.
        </p>
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
            disabled={tickers.length >= 3}
            className="rounded-md border border-(--card-border) px-3 py-2 text-sm hover:bg-(--background) disabled:opacity-60"
          >
            Add Symbol
          </button>
          <button
            type="button"
            onClick={() => void runComparison()}
            disabled={!canCompare || loading}
            className="rounded-md bg-(--accent) px-3 py-2 text-sm font-medium text-(--accent-foreground) disabled:opacity-60"
          >
            {loading ? "Comparing..." : "Compare Stocks"}
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

        <p className="mt-2 text-xs text-(--muted)">
          Beta, P/E, forward P/E, PEG, and Price/Book are treated as lower-is-better. Other
          metrics are higher-is-better.
        </p>
        {error && (
          <p className="mt-2 rounded-md border border-red-400/35 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-(--card-border) bg-(--card) shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-(--background)">
                <th className="border-b border-(--card-border) px-4 py-3 text-left font-medium">
                  Metric
                </th>
                {stocks.map((stock) => (
                  <th
                    key={stock.symbol}
                    className="border-b border-(--card-border) px-4 py-3 text-left font-medium"
                  >
                    <p className="font-semibold">{stock.symbol}</p>
                    <p className="text-xs text-(--muted)">{stock.name}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stocks.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-(--muted)"
                  >
                    Add 2-3 symbols, then click Compare Stocks.
                  </td>
                </tr>
              ) : (
                metricConfigs.map((metric) => (
                  <tr key={metric.key} className="border-t border-(--card-border)">
                    <td className="px-4 py-3">
                      <p className="font-medium">{metric.label}</p>
                      <p className="text-xs text-(--muted)">
                        {metric.better === "higher" ? "Higher wins" : "Lower wins"}
                      </p>
                    </td>
                    {stocks.map((stock) => {
                      const value = stock[metric.key] as number | null;
                      const isWinner = winnersByMetric.get(metric.key)?.has(stock.symbol) ?? false;
                      return (
                        <td
                          key={`${metric.key}-${stock.symbol}`}
                          className={
                            "px-4 py-3 " +
                            (isWinner
                              ? "bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "")
                          }
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>{metric.format(value)}</span>
                            {isWinner && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-300">
                                Winner
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
