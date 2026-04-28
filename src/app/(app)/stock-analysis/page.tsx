"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StockAnalysisPanel } from "@/components/StockAnalysisPanel";

const LS_SYMBOL = "pf-stock-analysis-symbol";

function normalizeTicker(text: string): string {
  return text.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

function StockAnalysisContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlSym = params.get("symbol") ? normalizeTicker(params.get("symbol")!) : "";

  const didInit = useRef(false);
  const [ready, setReady] = useState(false);
  const [activeSymbol, setActiveSymbol] = useState("AAPL");
  const [input, setInput] = useState("AAPL");

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const usp = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    const fromUrl = usp.get("symbol") ? normalizeTicker(usp.get("symbol")!) : "";
    const fromStorage = normalizeTicker(
      typeof window !== "undefined" ? (localStorage.getItem(LS_SYMBOL) ?? "") : ""
    );
    const initial = fromUrl || fromStorage || "AAPL";
    setActiveSymbol(initial);
    setInput(initial);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!urlSym || urlSym === activeSymbol) return;
    setActiveSymbol(urlSym);
    setInput(urlSym);
  }, [urlSym, ready, activeSymbol]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(LS_SYMBOL, activeSymbol);
    } catch {
      // ignore
    }
    const cur = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (cur.get("symbol") === activeSymbol) return;
    cur.set("symbol", activeSymbol);
    router.replace(`${pathname}?${cur.toString()}`, { scroll: false });
  }, [activeSymbol, ready, router, pathname]);

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
        {ready ? (
          <StockAnalysisPanel key={activeSymbol} symbol={activeSymbol} showOpenPageButton={false} />
        ) : (
          <p className="text-sm text-(--muted)">Loading…</p>
        )}
      </section>
    </div>
  );
}

export default function StockAnalysisPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-(--card-border) bg-(--card) px-5 py-8 text-sm text-(--muted) shadow-sm">
          Loading stock analysis…
        </div>
      }
    >
      <StockAnalysisContent />
    </Suspense>
  );
}
