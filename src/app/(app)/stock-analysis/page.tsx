"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StockAnalysisPanel } from "@/components/StockAnalysisPanel";
import { ShareButton } from "@/components/ShareButton";

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
      <div className="rounded-2xl border border-cyan-400/40 bg-gradient-to-br from-slate-900/95 to-indigo-900/70 px-5 py-4 shadow-lg shadow-cyan-700/25">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="bg-linear-to-r from-cyan-200 via-sky-200 to-violet-200 bg-clip-text text-2xl font-semibold tracking-tight text-transparent">Charts</h1>
            <p className="mt-1 text-sm text-slate-300">
              Deep-dive a ticker with chart performance, valuation, profitability, and 52-week range.
            </p>
          </div>
          <ShareButton title={`Charts: ${activeSymbol}`} url={`/stock-analysis?symbol=${encodeURIComponent(activeSymbol)}`} />
        </div>
      </div>

      <section className="rounded-2xl border border-sky-400/35 bg-gradient-to-br from-slate-900/90 to-slate-800/80 p-4 shadow-lg shadow-sky-700/20">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const next = normalizeTicker(input);
            if (next) setActiveSymbol(next);
          }}
        >
          <label className="flex-1">
            <span className="mb-1 block text-sm text-slate-300">Ticker</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              className="w-full rounded-md border border-cyan-400/30 bg-slate-900/80 px-3 py-2 text-sm font-mono"
              placeholder="AAPL"
            />
          </label>
          <button
            type="submit"
            className="rounded-md border border-cyan-400/40 bg-cyan-500/80 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400"
          >
            Analyze
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-violet-400/35 bg-gradient-to-br from-slate-900/90 to-indigo-900/65 p-4 shadow-lg shadow-violet-700/20">
        {ready ? (
          <StockAnalysisPanel key={activeSymbol} symbol={activeSymbol} showOpenPageButton={false} defaultInterval="1D" />
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
