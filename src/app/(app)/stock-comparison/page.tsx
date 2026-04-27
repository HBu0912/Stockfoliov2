"use client";

import { useState } from "react";
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
  format: (value: number | null) => string;
};

const metricConfigs: MetricConfig[] = [
  { key: "price", label: "Price", format: (v) => formatUsd(v) },
  { key: "marketCap", label: "Market Cap", format: (v) => formatMarketCap(v) },
  { key: "beta", label: "Beta", format: (v) => formatNumber(v, 2) },
  { key: "trailingPE", label: "P/E", format: (v) => formatNumber(v, 2) },
  { key: "forwardPE", label: "Forward P/E", format: (v) => formatNumber(v, 2) },
  { key: "pegRatio", label: "PEG Ratio", format: (v) => formatNumber(v, 2) },
  { key: "priceToBook", label: "Price/Book", format: (v) => formatNumber(v, 2) },
  {
    key: "profitMargin",
    label: "Profit Margin",
    format: (v) => (v == null ? "—" : `${formatNumber(v * 100, 2)}%`),
  },
  {
    key: "returnOnEquity",
    label: "Return on Equity",
    format: (v) => (v == null ? "—" : `${formatNumber(v * 100, 2)}%`),
  },
  {
    key: "dividendYield",
    label: "Dividend Yield",
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
          metricConfigs.map((metric) => (
            <article
              key={metric.key}
              className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm"
            >
              <div className="mb-3">
                <span className="inline-flex rounded-full border border-(--card-border) bg-(--background) px-3 py-1 text-sm font-medium">
                  {metric.label}
                </span>
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {stocks.map((stock) => {
                  const value = stock[metric.key] as number | null;
                  return (
                    <div
                      key={`${metric.key}-${stock.symbol}`}
                      className="rounded-2xl border border-(--card-border) bg-(--background) px-3 py-2"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-(--muted)">
                        {stock.symbol}
                      </p>
                      <p className="text-sm font-medium">{metric.format(value)}</p>
                      <p className="truncate text-xs text-(--muted)">{stock.name}</p>
                    </div>
                  );
                })}
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
