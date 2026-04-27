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

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-(--card-border) bg-(--card) px-5 py-4 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Stock Comparison</h1>
        <p className="mt-1 text-sm text-(--muted)">
          Compare 2-3 ticker symbols side by side using Yahoo Finance metrics.
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

        {error && (
          <p className="mt-2 rounded-md border border-red-400/35 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}
      </section>

      <section className="space-y-3">
        {stocks.length === 0 ? (
          <div className="rounded-2xl border border-(--card-border) bg-(--card) px-4 py-8 text-center text-sm text-(--muted) shadow-sm">
            Add 2-3 symbols, then click Compare Stocks.
          </div>
        ) : (
          <div className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="w-[170px] whitespace-nowrap border border-(--card-border) bg-(--background) px-3 py-2 text-center font-semibold">
                      Metrics
                    </th>
                    {stocks.map((stock) => (
                      <th
                        key={`head-${stock.symbol}`}
                        className="border border-(--card-border) bg-(--background) px-3 py-2 text-center"
                      >
                        <p className="text-sm font-semibold">{stock.symbol}</p>
                        <p className="truncate text-xs text-(--muted)">{stock.name}</p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metricConfigs.map((metric) => (
                    <tr key={`row-${metric.key}`}>
                      <td className="w-[170px] whitespace-nowrap border border-(--card-border) bg-(--background) px-3 py-2 text-center font-medium">
                        <span className="inline-flex items-center gap-1">
                          {metric.label}
                          <span className="group relative inline-flex">
                            <button
                              type="button"
                              className="h-4 w-4 rounded-full border border-(--card-border) text-[10px] font-semibold text-(--muted)"
                              aria-label={`${metric.label} description`}
                            >
                              i
                            </button>
                            <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 w-56 -translate-x-1/2 rounded-md border border-(--card-border) bg-(--background) px-2 py-1 text-left text-xs font-normal text-(--muted) opacity-0 shadow group-hover:opacity-100">
                              {metric.description}
                            </span>
                          </span>
                        </span>
                      </td>
                      {stocks.map((stock) => {
                        const value = stock[metric.key] as number | null;
                        const isWinner = winnerMap.get(metric.key)?.has(stock.symbol) ?? false;
                        return (
                          <td
                            key={`${metric.key}-${stock.symbol}`}
                            className={
                              "border px-3 py-2 text-center " +
                              (isWinner
                                ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-200 font-semibold"
                                : "border-(--card-border) bg-(--background)")
                            }
                          >
                            {metric.format(value)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
