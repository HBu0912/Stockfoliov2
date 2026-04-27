"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StockAnalysisPanel } from "@/components/StockAnalysisPanel";

function normalizeTicker(text: string): string {
  return text.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

export default function StockAnalysisPage() {
  const params = useSearchParams();
  const paramSymbol = useMemo(() => normalizeTicker(params.get("symbol") ?? "AAPL"), [params]);
  const [input, setInput] = useState(paramSymbol);
  const [activeSymbol, setActiveSymbol] = useState(paramSymbol);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-(--card-border) bg-(--card) px-5 py-4 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Stock Analysis</h1>
        <p className="mt-1 text-sm text-(--muted)">
          Deep-dive a ticker with chart performance, valuation, profitability, and 52-week range.
        </p>
      </div>

      <section className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const next = normalizeTicker(input);
            if (next) setActiveSymbol(next);
          }}
        >
          <label className="flex-1">
            <span className="mb-1 block text-sm text-(--muted)">Ticker</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              className="w-full rounded-md border border-(--card-border) bg-(--background) px-3 py-2 text-sm font-mono"
              placeholder="AAPL"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-(--accent) px-3 py-2 text-sm font-medium text-(--accent-foreground)"
          >
            Analyze
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
        <StockAnalysisPanel
          key={activeSymbol}
          symbol={activeSymbol}
          showOpenPageButton={false}
        />
      </section>
    </div>
  );
}
