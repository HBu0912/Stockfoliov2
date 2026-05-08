"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HoldingPie } from "@/components/HoldingPie";
import { HoldingsTable } from "@/components/HoldingsTable";
import { QuickTickerModal } from "@/components/QuickTickerModal";
import { formatPctChangeLine } from "@/lib/feed-copy";
import { formatNumber, formatUsd } from "@/lib/money";
import type { Account, Holding } from "@prisma/client";

type AccountWithH = Account & { holdings: Holding[] };
type FeedRow = {
  id: string;
  symbol: string;
  title: string;
  kind: string;
  pct: number;
  oldShares: number;
  newShares: number;
  accountName: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
};
const ANALYZE_INTERVALS = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y", "ALL"] as const;
type AnalyzeInterval = (typeof ANALYZE_INTERVALS)[number];
const LS_HIDE_VALUES = "pf-hide-values";
type HoldingMover = {
  symbol: string;
  name: string | null;
  price: number;
  changePct: number;
  weight: number;
};
type PortfolioAnalysis = {
  weightedBeta: number | null;
  avgPe: number | null;
  avgForwardPe: number | null;
  weightedPeg: number | null;
  weightedProfitMargin: number | null;
  weightedRoe: number | null;
  weightedDividendYield: number | null;
  weightedPriceToBook: number | null;
  weightedEvToRevenue: number | null;
  weightedEvToEbitda: number | null;
  weightedGrossMargin: number | null;
  weightedOperatingMargin: number | null;
  strengths: string[];
  weaknesses: string[];
};

function Info({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-(--card-border) text-[10px] text-(--muted)">
      i
      <span className="pointer-events-none absolute right-0 top-5 z-20 hidden w-60 rounded-md border border-(--card-border) bg-(--background) p-2 text-xs text-(--muted) shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  );
}

export default function OverviewPage() {
  const [accounts, setAccounts] = useState<AccountWithH[] | null>(null);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [addAccOpen, setAddAccOpen] = useState(false);
  const [addAccName, setAddAccName] = useState("");
  const [addSym, setAddSym] = useState("");
  const [addShares, setAddShares] = useState("1");
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [refreshText, setRefreshText] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem("pf-last-refreshed");
      return stored ? new Date(stored) : null;
    } catch { return null; }
  });
  const [hideValues, setHideValues] = useState(false);
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [portfolioTrendOpen, setPortfolioTrendOpen] = useState(false);
  const [analyzeInterval, setAnalyzeInterval] = useState<AnalyzeInterval>("1M");
  const [moversLoading, setMoversLoading] = useState(false);
  const [movers, setMovers] = useState<Array<{ symbol: string; changePct: number }>>([]);
  const [overviewPieHeight, setOverviewPieHeight] = useState(260);
  const [feedTab, setFeedTab] = useState<"feed" | "movers">("movers");
  const [holdingMovers, setHoldingMovers] = useState<HoldingMover[]>([]);
  const [holdingMoversLoading, setHoldingMoversLoading] = useState(false);
  const [moversRefreshToken, setMoversRefreshToken] = useState(0);
  const [quickChartSymbol, setQuickChartSymbol] = useState<{ symbol: string; name: string | null } | null>(null);

  // Drag-to-scroll refs for Today's Movers
  const moversScrollRef = useRef<HTMLDivElement>(null);
  const moversDragRef = useRef<{
    startY: number;
    startOffset: number;
    moved: boolean;
  } | null>(null);

  function getTranslateY(el: HTMLElement): number {
    const mat = new DOMMatrixReadOnly(window.getComputedStyle(el).transform);
    return mat.m42;
  }

  function onMoversPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = moversScrollRef.current;
    if (!el) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const currentY = getTranslateY(el);
    moversDragRef.current = { startY: e.clientY, startOffset: currentY, moved: false };
    el.style.animation = "none";
    el.style.transform = `translateY(${currentY}px)`;
  }

  function onMoversPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = moversDragRef.current;
    const el = moversScrollRef.current;
    if (!drag || !el) return;
    const delta = e.clientY - drag.startY;
    if (Math.abs(delta) > 4) drag.moved = true;
    if (!drag.moved) return;
    let newY = drag.startOffset + delta;
    const halfH = el.scrollHeight / 2;
    if (halfH > 0) {
      newY = newY % halfH;
      if (newY > 0) newY -= halfH;
    }
    el.style.transform = `translateY(${newY}px)`;
  }

  function onMoversPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const drag = moversDragRef.current;
    const el = moversScrollRef.current;
    if (!drag || !el) return;
    const delta = e.clientY - drag.startY;
    const moved = drag.moved;
    let finalY = drag.startOffset + delta;
    const halfH = el.scrollHeight / 2;
    if (halfH > 0) {
      finalY = finalY % halfH;
      if (finalY > 0) finalY -= halfH;
    }
    const duration = Math.max(3, holdingMovers.length * 2.8 / 1.44);
    const progress = halfH > 0 ? Math.abs(finalY) / halfH : 0;
    const delay = -(progress * duration);
    el.style.transform = "";
    el.style.animation = `scroll-up ${duration}s linear ${delay}s infinite`;
    moversDragRef.current = null;
    // If user dragged, cancel the next click so the chart modal doesn't open
    if (moved) {
      const onCapture = (ev: Event) => { ev.stopPropagation(); window.removeEventListener("click", onCapture, true); };
      window.addEventListener("click", onCapture, true);
    }
  }

  useEffect(() => {
    function pickPieHeight() {
      const w = typeof window !== "undefined" ? window.innerWidth : 1024;
      if (w < 480) setOverviewPieHeight(220);
      else if (w < 1024) setOverviewPieHeight(280);
      else setOverviewPieHeight(320);
    }
    pickPieHeight();
    window.addEventListener("resize", pickPieHeight);
    return () => window.removeEventListener("resize", pickPieHeight);
  }, []);

  useEffect(() => {
    try {
      setHideValues(localStorage.getItem(LS_HIDE_VALUES) === "1");
    } catch {
      // ignore
    }
  }, []);

  const load = useCallback(async () => {
    setErr(null);
    const [accountsRes, feedRes] = await Promise.all([
      fetch("/api/accounts"),
      fetch("/api/feed"),
    ]);
    if (!accountsRes.ok) {
      setErr("Could not load accounts");
      return;
    }
    const d = (await accountsRes.json()) as { accounts: AccountWithH[] };
    setAccounts(d.accounts);
    if (feedRes.ok) {
      const f = (await feedRes.json()) as { items: FeedRow[] };
      setFeed(f.items);
    }
    setSelectedAccountId((current) =>
      current === "__overview__" || (current && d.accounts.some((a) => a.id === current))
        ? current
        : "__overview__"
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const fn = () => void load();
    window.addEventListener("prices-refreshed", fn);
    return () => window.removeEventListener("prices-refreshed", fn);
  }, [load]);

  const onOverview = selectedAccountId === "__overview__";
  const selectedAccount = useMemo(
    () => accounts?.find((a) => a.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  );

  const totalPortfolioValue = useMemo(
    () =>
      (accounts ?? [])
        .flatMap((a) => a.holdings)
        .reduce((sum, h) => sum + h.shares * (h.lastPrice ?? 0), 0),
    [accounts]
  );
  const totalHoldingsCount = useMemo(() => {
    const set = new Set<string>();
    for (const account of accounts ?? []) {
      for (const holding of account.holdings) {
        set.add(holding.symbol.toUpperCase());
      }
    }
    return set.size;
  }, [accounts]);
  const selectedAccountValue = useMemo(
    () =>
      selectedAccount?.holdings.reduce(
        (sum, h) => sum + h.shares * (h.lastPrice ?? 0),
        0
      ) ?? 0,
    [selectedAccount]
  );

  const mergedOverviewHoldings = useMemo(() => {
    const map = new Map<string, Holding>();
    for (const account of accounts ?? []) {
      for (const holding of account.holdings) {
        const key = holding.symbol.toUpperCase();
        const existing = map.get(key);
        if (!existing) {
          map.set(key, { ...holding, symbol: key });
          continue;
        }
        map.set(key, {
          ...existing,
          shares: existing.shares + holding.shares,
          lastPrice: holding.lastPrice ?? existing.lastPrice,
          marketCap: holding.marketCap ?? existing.marketCap,
          marketCapText: holding.marketCapText ?? existing.marketCapText,
        });
      }
    }
    return [...map.values()].sort(
      (a, b) => (b.lastPrice ?? 0) * b.shares - (a.lastPrice ?? 0) * a.shares
    );
  }, [accounts]);

  const viewHoldings = onOverview ? mergedOverviewHoldings : selectedAccount?.holdings ?? [];
  const viewValue = onOverview ? totalPortfolioValue : selectedAccountValue;
  const viewFeed = useMemo(
    () =>
      onOverview
        ? feed.slice(0, 8)
        : feed.filter((x) => x.accountName === selectedAccount?.name).slice(0, 8),
    [feed, onOverview, selectedAccount?.name]
  );
  const top5Holdings = useMemo(() => {
    const total = Math.max(1, viewValue);
    return [...viewHoldings]
      .sort((a, b) => b.shares * (b.lastPrice ?? 0) - a.shares * (a.lastPrice ?? 0))
      .slice(0, 5)
      .map((h) => {
        const value = h.shares * (h.lastPrice ?? 0);
        return {
          symbol: h.symbol.toUpperCase(),
          weightPct: (value / total) * 100,
          value,
        };
      });
  }, [viewHoldings, viewValue]);

  useEffect(() => {
    let cancelled = false;
    async function loadAnalysis() {
      if (!portfolioTrendOpen || !viewHoldings.length) {
        setAnalysis(null);
        return;
      }
      const top = [...viewHoldings]
        .sort((a, b) => b.shares * (b.lastPrice ?? 0) - a.shares * (a.lastPrice ?? 0))
        .slice(0, 12);
      const totalValue = Math.max(1, viewHoldings.reduce((s, h) => s + h.shares * (h.lastPrice ?? 0), 0));
      const isCoreIndex = (h: Holding) => /SPY|IVV|VOO|QQQ|DIA|VTI|SCHB|ITOT|ONEQ|NASDAQ|S&P|DOW/i.test(`${h.symbol} ${h.name ?? ""}`);
      const details = await Promise.all(
        top.map(async (h) => {
          const weight = ((h.shares * (h.lastPrice ?? 0)) / totalValue) * 100;
          try {
            const res = await fetch(`/api/stocks/${encodeURIComponent(h.symbol)}?interval=1M&newsLimit=1&newsOffset=0`);
            if (!res.ok) return { weight, coreIndex: isCoreIndex(h), beta: null, pe: null, forwardPE: null, margin: null };
            const d = (await res.json()) as {
              metrics?: {
                beta?: number | null;
                trailingPE?: number | null;
                forwardPE?: number | null;
                pegRatio?: number | null;
                profitMargin?: number | null;
                returnOnEquity?: number | null;
                dividendYield?: number | null;
                priceToBook?: number | null;
                enterpriseToRevenue?: number | null;
                enterpriseToEbitda?: number | null;
                grossMargins?: number | null;
                operatingMargins?: number | null;
              };
            };
            return {
              weight,
              coreIndex: isCoreIndex(h),
              beta: d.metrics?.beta ?? null,
              pe: d.metrics?.trailingPE ?? null,
              forwardPE: d.metrics?.forwardPE ?? null,
              peg: d.metrics?.pegRatio ?? null,
              margin: d.metrics?.profitMargin ?? null,
              roe: d.metrics?.returnOnEquity ?? null,
              dividend: d.metrics?.dividendYield ?? null,
              pb: d.metrics?.priceToBook ?? null,
              evRev: d.metrics?.enterpriseToRevenue ?? null,
              evEbitda: d.metrics?.enterpriseToEbitda ?? null,
              grossMargin: d.metrics?.grossMargins ?? null,
              operatingMargin: d.metrics?.operatingMargins ?? null,
              symbol: h.symbol,
            };
          } catch {
            return { weight, coreIndex: isCoreIndex(h), beta: null, pe: null, forwardPE: null, peg: null, margin: null, roe: null, dividend: null, pb: null, evRev: null, evEbitda: null, grossMargin: null, operatingMargin: null, symbol: h.symbol };
          }
        })
      );
      if (cancelled) return;
      const totalW = Math.max(1, details.reduce((s, x) => s + x.weight, 0));
      const weightedBeta = details.reduce((s, x) => s + (x.beta ?? 1) * x.weight, 0) / totalW;
      const avgPe = details.reduce((s, x) => s + (x.pe ?? 0) * x.weight, 0) / totalW;
      const avgForwardPe = details.reduce((s, x) => s + (x.forwardPE ?? 0) * x.weight, 0) / totalW;
      const weightedPeg = details.reduce((s, x) => s + (x.peg ?? 0) * x.weight, 0) / totalW;
      const weightedProfitMargin = details.reduce((s, x) => s + (x.margin ?? 0) * x.weight, 0) / totalW;
      const weightedRoe = details.reduce((s, x) => s + (x.roe ?? 0) * x.weight, 0) / totalW;
      const weightedDividendYield = details.reduce((s, x) => s + (x.dividend ?? 0) * x.weight, 0) / totalW;
      const weightedPriceToBook = details.reduce((s, x) => s + (x.pb ?? 0) * x.weight, 0) / totalW;
      const weightedEvToRevenue = details.reduce((s, x) => s + (x.evRev ?? 0) * x.weight, 0) / totalW;
      const weightedEvToEbitda = details.reduce((s, x) => s + (x.evEbitda ?? 0) * x.weight, 0) / totalW;
      const weightedGrossMargin = details.reduce((s, x) => s + (x.grossMargin ?? 0) * x.weight, 0) / totalW;
      const weightedOperatingMargin = details.reduce((s, x) => s + (x.operatingMargin ?? 0) * x.weight, 0) / totalW;
      const indexEtfPct = details.filter((x) => x.coreIndex).reduce((s, x) => s + x.weight, 0);
      const top3 = top.slice(0, 3).reduce((s, h) => s + (h.shares * (h.lastPrice ?? 0) / totalValue) * 100, 0);
      const topNames = top.slice(0, 3).map((h) => h.symbol);
      const strengths: string[] = [];
      const weaknesses: string[] = [];
      if (indexEtfPct >= 45)
        strengths.push(`Diversification backbone is strong: about ${formatNumber(indexEtfPct, 1)}% sits in core index ETFs, reducing single-company dependency.`);
      if (weightedBeta < 1.1)
        strengths.push(`Risk profile is controlled with weighted beta near ${formatNumber(weightedBeta, 2)}, which can cushion volatility versus high-beta portfolios.`);
      if (avgForwardPe > 0 && avgForwardPe < 26)
        strengths.push(`Valuation setup is balanced: weighted forward P/E around ${formatNumber(avgForwardPe, 1)} does not imply extreme growth pricing.`);
      if (weightedProfitMargin > 0.12 || weightedRoe > 0.14)
        strengths.push(`Quality factors are supportive with weighted profitability metrics (margin ${formatNumber(weightedProfitMargin * 100, 1)}%, ROE ${formatNumber(weightedRoe * 100, 1)}%).`);
      if (top3 > 62 && indexEtfPct < 35)
        weaknesses.push(`Concentration risk is elevated: top names (${topNames.join(", ")}) dominate about ${formatNumber(top3, 1)}% outside broad index ballast.`);
      if (weightedBeta > 1.3)
        weaknesses.push(`Volatility risk is above average with beta near ${formatNumber(weightedBeta, 2)}, so drawdowns can accelerate during risk-off moves.`);
      if (avgForwardPe > 36 || weightedPeg > 2.2)
        weaknesses.push(`Valuation sensitivity is high (forward P/E ${formatNumber(avgForwardPe, 1)}, PEG ${formatNumber(weightedPeg, 2)}), requiring strong execution to sustain multiples.`);
      if (!strengths.length) strengths.push("Construction appears balanced with no single dominant strength signal.");
      if (!weaknesses.length) weaknesses.push("No major structural weakness detected from current top-weighted holdings.");
      setAnalysis({
        weightedBeta: Number.isFinite(weightedBeta) ? weightedBeta : null,
        avgPe: Number.isFinite(avgPe) ? avgPe : null,
        avgForwardPe: Number.isFinite(avgForwardPe) ? avgForwardPe : null,
        weightedPeg: Number.isFinite(weightedPeg) ? weightedPeg : null,
        weightedProfitMargin: Number.isFinite(weightedProfitMargin) ? weightedProfitMargin : null,
        weightedRoe: Number.isFinite(weightedRoe) ? weightedRoe : null,
        weightedDividendYield: Number.isFinite(weightedDividendYield) ? weightedDividendYield : null,
        weightedPriceToBook: Number.isFinite(weightedPriceToBook) ? weightedPriceToBook : null,
        weightedEvToRevenue: Number.isFinite(weightedEvToRevenue) ? weightedEvToRevenue : null,
        weightedEvToEbitda: Number.isFinite(weightedEvToEbitda) ? weightedEvToEbitda : null,
        weightedGrossMargin: Number.isFinite(weightedGrossMargin) ? weightedGrossMargin : null,
        weightedOperatingMargin: Number.isFinite(weightedOperatingMargin) ? weightedOperatingMargin : null,
        strengths: strengths.slice(0, 4),
        weaknesses: weaknesses.slice(0, 4),
      });
    }
    void loadAnalysis();
    return () => {
      cancelled = true;
    };
  }, [portfolioTrendOpen, viewHoldings]);

  useEffect(() => {
    let cancelled = false;
    async function loadMovers() {
      if (!portfolioTrendOpen || viewHoldings.length === 0) {
        setMovers([]);
        return;
      }
      setMoversLoading(true);
      try {
        const top = [...viewHoldings]
          .sort((a, b) => b.shares * (b.lastPrice ?? 0) - a.shares * (a.lastPrice ?? 0))
          .slice(0, 20);
        const rows = await Promise.all(
          top.map(async (h) => {
            try {
              const res = await fetch(`/api/stocks/${encodeURIComponent(h.symbol)}?interval=${analyzeInterval}`);
              const d = (await res.json().catch(() => ({}))) as { changePct?: number | null };
              if (!res.ok || typeof d.changePct !== "number" || !Number.isFinite(d.changePct)) return null;
              return { symbol: h.symbol.toUpperCase(), changePct: d.changePct };
            } catch {
              return null;
            }
          })
        );
        if (!cancelled) setMovers(rows.filter((x): x is { symbol: string; changePct: number } => Boolean(x)));
      } finally {
        if (!cancelled) setMoversLoading(false);
      }
    }
    void loadMovers();
    return () => {
      cancelled = true;
    };
  }, [portfolioTrendOpen, analyzeInterval, viewHoldings]);

  useEffect(() => {
    let cancelled = false;
    async function loadHoldingMovers() {
      if (!viewHoldings.length || viewValue === 0) {
        setHoldingMovers([]);
        return;
      }
      setHoldingMoversLoading(true);
      try {
        const total = Math.max(1, viewValue);
        // Sort by value descending, take top 40
        const top = [...viewHoldings]
          .sort((a, b) => b.shares * (b.lastPrice ?? 0) - a.shares * (a.lastPrice ?? 0))
          .slice(0, 40);

        // Compute weights locally (no API needed)
        const withWeights = top.map((h) => ({
          h,
          weight: (h.shares * (h.lastPrice ?? 0)) / total * 100,
        }));

        // Pre-filter: must have weight > 5% OR be potentially significant — we fetch all via batch
        const symbols = withWeights.map(({ h }) => h.symbol.toUpperCase()).join(",");
        const res = await fetch(`/api/stocks/batch-quotes?symbols=${encodeURIComponent(symbols)}`);
        if (!res.ok || cancelled) return;

        const data = (await res.json()) as {
          quotes: Array<{ symbol: string; price: number | null; changePct: number | null; name: string | null }>;
        };
        const quoteMap = new Map(data.quotes.map((q) => [q.symbol, q]));

        const movers: HoldingMover[] = [];
        for (const { h, weight } of withWeights) {
          const sym = h.symbol.toUpperCase();
          const q = quoteMap.get(sym);
          if (!q) continue;
          const changePct = q.changePct;
          if (changePct === null || !Number.isFinite(changePct)) continue;
          if (weight < 5 && Math.abs(changePct) < 1.5) continue;
          movers.push({
            symbol: sym,
            name: h.name ?? q.name ?? null,
            price: h.lastPrice ?? q.price ?? 0,
            changePct,
            weight,
          });
        }

        if (!cancelled)
          setHoldingMovers(movers.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)));
      } finally {
        if (!cancelled) setHoldingMoversLoading(false);
      }
    }
    void loadHoldingMovers();
    return () => { cancelled = true; };
  }, [viewHoldings, viewValue, moversRefreshToken]);

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!addAccName.trim()) return;
    const r = await fetch("/api/accounts", {
      method: "POST",
      body: JSON.stringify({ name: addAccName.trim() }),
    });
    if (!r.ok) return void setErr("Could not add account");
    setAddAccName("");
    setAddAccOpen(false);
    await load();
  }

  async function addHolding(e: React.FormEvent) {
    e.preventDefault();
    const sh = parseFloat(addShares);
    if (!selectedAccountId || !addSym.trim() || Number.isNaN(sh) || sh <= 0) return;
    const r = await fetch("/api/holdings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: selectedAccountId,
        symbol: addSym.trim(),
        shares: sh,
      }),
    });
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) return void setErr(d.error ?? "Could not add holding");
    setAddSym("");
    setAddShares("1");
    setErr(null);
    await load();
  }

  async function editHolding(id: string, nextShares: number) {
    const r = await fetch(`/api/holdings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shares: nextShares }),
    });
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      return void setErr(d.error ?? "Update failed");
    }
    await load();
  }

  async function removeHolding(id: string) {
    if (!confirm("Remove this ticker line from this account?")) return;
    const r = await fetch(`/api/holdings/${id}`, { method: "DELETE" });
    if (!r.ok) return void setErr("Could not remove");
    await load();
  }

  async function refreshAllPrices() {
    setRefreshingPrices(true);
    try {
      const res = await fetch("/api/holdings/refresh", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        updatedCount?: number;
        skippedCount?: number;
        error?: string;
      };
      if (!res.ok) {
        setRefreshText(data.error ?? "Could not refresh prices right now.");
        return;
      }
      window.dispatchEvent(new Event("prices-refreshed"));
      setRefreshText(`Updated ${data.updatedCount ?? 0}, skipped ${data.skippedCount ?? 0}`);
      const now = new Date();
      setLastRefreshed(now);
      try { localStorage.setItem("pf-last-refreshed", now.toISOString()); } catch { /* ignore */ }
      setMoversRefreshToken((t) => t + 1);
    } finally {
      setRefreshingPrices(false);
      setTimeout(() => setRefreshText(null), 2800);
    }
  }

  if (accounts === null) return <p className="text-(--muted)">Loading...</p>;

  return (
    <>
    <div className="min-w-0 space-y-5">
      <div className="rounded-2xl border border-cyan-400/45 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900/70 px-4 py-4 shadow-xl shadow-cyan-700/30 sm:px-5">
        <div className="min-w-0">
          <h1 className="bg-linear-to-r from-cyan-200 via-sky-200 to-violet-200 bg-clip-text text-xl font-semibold tracking-tight text-transparent sm:text-2xl">Stockfolio Dashboard</h1>
          <p className="mt-1 text-sm text-slate-200">Keep tabs on your full investment portfolio</p>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-400/35 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {err}
        </div>
      )}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="min-w-0 rounded-2xl border border-sky-400/40 bg-gradient-to-b from-slate-900/90 to-slate-800/80 p-4 shadow-lg shadow-sky-700/30">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">Accounts</h2>
              <button
                type="button"
                onClick={() =>
                  setHideValues((v) => {
                    const next = !v;
                    try {
                      localStorage.setItem(LS_HIDE_VALUES, next ? "1" : "0");
                    } catch {
                      // ignore
                    }
                    window.dispatchEvent(new Event("privacy-visibility-changed"));
                    return next;
                  })
                }
                className="rounded-md border border-cyan-500/30 px-1.5 py-0.5 text-xs hover:bg-cyan-500/15"
                aria-label={hideValues ? "Show account values" : "Hide account values"}
              >
                {hideValues ? "🙈" : "👁️"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setAddAccOpen((v) => !v)}
              className="rounded-md border border-violet-500/35 bg-violet-500/10 px-2 py-1 text-xs text-violet-100 hover:bg-violet-500/20"
            >
              {addAccOpen ? "Close" : "Add"}
            </button>
          </div>

          {addAccOpen && (
            <form
              onSubmit={addAccount}
              className="mb-3 space-y-2 rounded-lg border border-cyan-400/25 bg-slate-900/70 p-2.5"
            >
              <input
                className="w-full rounded-md border border-cyan-400/30 bg-slate-900/85 px-2 py-1.5 text-sm"
                value={addAccName}
                onChange={(e) => setAddAccName(e.target.value)}
                placeholder="Account name"
                required
              />
              <button
                type="submit"
                className="w-full rounded-md bg-(--accent) px-2 py-1.5 text-xs font-medium text-(--accent-foreground)"
              >
                Create account
              </button>
            </form>
          )}

          <ul className="space-y-1.5">
            <li>
              <button
                type="button"
                onClick={() => setSelectedAccountId("__overview__")}
                className={
                  "w-full rounded-lg border px-3 py-2 text-left transition " +
                  (onOverview
                    ? "border-cyan-400/60 bg-cyan-500/10 shadow-sm shadow-cyan-900/30"
                    : "border-(--card-border) hover:bg-white/5")
                }
              >
                <p className="text-sm font-medium">Consolidated Overview</p>
                <p className="text-xs text-(--muted)">
                  Total across all accounts · {totalHoldingsCount} holdings
                </p>
              </button>
              <div className="mx-1 mt-2 border-b border-(--card-border)/70" />
            </li>
            {accounts.map((account) => {
              const subtotal = account.holdings.reduce(
                (sum, h) => sum + h.shares * (h.lastPrice ?? 0),
                0
              );
              const active = account.id === selectedAccountId;
              return (
                <li key={account.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedAccountId(account.id)}
                    className={
                      "w-full rounded-lg border px-3 py-2 text-left transition " +
                      (active
                        ? "border-cyan-400/60 bg-cyan-500/10 shadow-sm shadow-cyan-900/30"
                        : "border-(--card-border) hover:bg-white/5")
                    }
                  >
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-medium">{account.name}</span>
                      <span className="text-xs text-(--muted)">{hideValues ? "••••" : formatUsd(subtotal)}</span>
                    </div>
                    <p className="text-xs text-(--muted)">{account.holdings.length} holdings</p>
                  </button>
                </li>
              );
            })}
          </ul>

          {!onOverview && (
            <form
              onSubmit={addHolding}
              className="mt-4 space-y-2 rounded-lg border border-violet-400/25 bg-slate-900/70 p-2.5"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-(--muted)">
                Update holding
              </p>
              <input
                value={selectedAccount?.name ?? "No account"}
                disabled
                className="w-full rounded-md border border-violet-400/30 bg-slate-900/85 px-2 py-1.5 text-sm"
              />
              <input
                className="w-full rounded-md border border-violet-400/30 bg-slate-900/85 px-2 py-1.5 text-sm font-mono uppercase"
                value={addSym}
                onChange={(e) => setAddSym(e.target.value.toUpperCase())}
                placeholder="Ticker (AAPL)"
                required
              />
              <input
                type="number"
                min={0.0001}
                step="any"
                className="w-full rounded-md border border-violet-400/30 bg-slate-900/85 px-2 py-1.5 text-sm"
                value={addShares}
                onChange={(e) => setAddShares(e.target.value)}
                placeholder="Total shares"
                required
              />
              <button
                type="submit"
                disabled={!selectedAccount}
                className="w-full rounded-md bg-(--accent) px-3 py-2 text-sm font-medium text-(--accent-foreground) disabled:cursor-not-allowed disabled:opacity-60"
              >
                Update
              </button>
            </form>
          )}
        </aside>

        <section className="min-w-0 space-y-5">
          <div className="grid min-w-0 items-stretch gap-5 xl:grid-cols-12">
            <div className="min-w-0 rounded-2xl border border-cyan-400/40 bg-gradient-to-br from-slate-900/95 to-slate-800/80 p-3 shadow-lg shadow-cyan-700/30 sm:p-4 xl:col-span-7 min-h-0" style={{ minHeight: overviewPieHeight + 100 }}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 text-sm font-medium text-(--muted)">
                  {onOverview
                    ? "Consolidated Overview"
                    : selectedAccount
                    ? `${selectedAccount.name} mix`
                    : "Account mix"}
                </h3>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <button
                    type="button"
                    onClick={() => void refreshAllPrices()}
                    disabled={refreshingPrices}
                    className="rounded-md border border-cyan-500/35 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-60"
                  >
                    {refreshingPrices ? "Refreshing..." : "↻ Refresh"}
                  </button>
                  <span className="text-[10px] text-(--muted)">
                    {lastRefreshed
                      ? `Last refreshed: ${lastRefreshed.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })} ${lastRefreshed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
                      : refreshText
                      ? refreshText
                      : "Last refreshed: —"}
                  </span>
                </div>
              </div>
              <p className="text-xl font-semibold">{hideValues ? "••••" : formatUsd(viewValue)}</p>
              <div className="relative mt-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setPortfolioTrendOpen(true)}
                  className="absolute top-0 right-0 z-10 rounded-md border border-cyan-500/35 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-500/20"
                >
                  Analyze
                </button>
                <HoldingPie holdings={viewHoldings} height={overviewPieHeight} showDollar={!hideValues} />
              </div>
            </div>

            <div className="min-w-0 rounded-2xl border border-violet-400/40 bg-gradient-to-br from-slate-900/95 to-indigo-900/70 p-3 shadow-lg shadow-violet-700/30 sm:p-4 xl:col-span-5 min-h-0 flex flex-col" style={{ minHeight: overviewPieHeight + 100 }}>
              {/* Tab toggle — Today's Movers first */}
              <div className="mb-2 flex items-center gap-2">
                <div className="flex gap-1 rounded-lg border border-(--card-border) bg-black/20 p-0.5">
                  <button
                    type="button"
                    onClick={() => setFeedTab("movers")}
                    className={
                      "rounded-md px-3 py-1 text-xs font-medium transition " +
                      (feedTab === "movers"
                        ? "bg-violet-500/30 text-violet-100"
                        : "text-(--muted) hover:text-foreground")
                    }
                  >
                    Today&apos;s Movers
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedTab("feed")}
                    className={
                      "rounded-md px-3 py-1 text-xs font-medium transition " +
                      (feedTab === "feed"
                        ? "bg-violet-500/30 text-violet-100"
                        : "text-(--muted) hover:text-foreground")
                    }
                  >
                    Investing Feed
                  </button>
                </div>
              </div>

              {feedTab === "movers" ? (
                <div
                  className="relative mt-1 flex-1 cursor-grab overflow-hidden rounded-xl border border-violet-500/20 bg-black/20 active:cursor-grabbing select-none"
                  style={{ minHeight: 0 }}
                  onPointerDown={onMoversPointerDown}
                  onPointerMove={onMoversPointerMove}
                  onPointerUp={onMoversPointerUp}
                  onPointerCancel={onMoversPointerUp}
                >
                  {holdingMoversLoading ? (
                    <p className="p-3 text-sm text-(--muted)">Loading movers…</p>
                  ) : holdingMovers.length === 0 ? (
                    <p className="p-3 text-sm text-(--muted)">No significant movers today.</p>
                  ) : (
                    <div
                      ref={moversScrollRef}
                      className="movers-scroll absolute inset-x-0 top-0"
                      style={{ "--scroll-duration": `${Math.max(3, holdingMovers.length * 2.8 / 1.44)}s` } as React.CSSProperties}
                    >
                      {[...holdingMovers, ...holdingMovers].map((m, i) => {
                        const up = m.changePct >= 0;
                        const changeAmt = (m.price * m.changePct) / (100 + m.changePct);
                        return (
                          <button
                            key={`${m.symbol}-${i}`}
                            type="button"
                            onClick={() => setQuickChartSymbol({ symbol: m.symbol, name: m.name })}
                            className="flex w-full items-center justify-between gap-2 border-b border-violet-500/15 px-3 py-2.5 text-left transition-colors hover:bg-violet-500/10 active:bg-violet-500/20"
                          >
                            <div className="min-w-0">
                              <p className="font-mono text-sm font-semibold">{m.symbol}</p>
                              {m.name && (
                                <p className="truncate text-xs text-(--muted)">{m.name}</p>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-medium tabular-nums">{formatUsd(m.price)}</p>
                              <p className={"text-xs font-medium tabular-nums " + (up ? "text-emerald-300" : "text-rose-300")}>
                                {up ? "+" : ""}{formatUsd(changeAmt)} ({up ? "+" : ""}{formatNumber(m.changePct, 2)}%)
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-1 flex-1 overflow-hidden">
                  <p className="mb-2 text-xs text-(--muted)">
                    {onOverview
                      ? "All recent activity"
                      : `Recent activity for ${selectedAccount?.name ?? "this account"}`}
                  </p>
                  {viewFeed.length === 0 ? (
                    <p className="text-sm text-(--muted)">No activity yet.</p>
                  ) : (
                    <ul className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                      {viewFeed.map((e) => (
                        <li
                          key={e.id}
                          className="rounded-lg border border-violet-500/20 bg-black/25 px-3 py-2 text-xs text-foreground/90"
                        >
                          {formatPctChangeLine({
                            userLabel: e.user.name || e.user.email.split("@")[0],
                            symbol: e.symbol,
                            title: e.title,
                            kind: e.kind,
                            pct: e.pct,
                            oldShares: e.oldShares,
                            newShares: e.newShares,
                            at: e.createdAt,
                            accountName: onOverview ? undefined : e.accountName,
                          })}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-sky-400/40 bg-gradient-to-br from-slate-900/90 to-slate-800/80 p-4 shadow-lg shadow-sky-700/30">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {onOverview
                  ? "Consolidated Overview"
                  : selectedAccount
                  ? `${selectedAccount.name} Holdings`
                  : "Holdings"}
              </h3>
              <p className="text-sm text-(--muted)">
                {viewHoldings.length} line{viewHoldings.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="mt-3">
              <HoldingsTable
                holdings={viewHoldings}
                accountTotal={viewValue}
                hideValues={hideValues}
                onEditShares={onOverview ? undefined : editHolding}
                onRemove={onOverview ? undefined : removeHolding}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
    {quickChartSymbol && (
      <QuickTickerModal
        symbol={quickChartSymbol.symbol}
        name={quickChartSymbol.name}
        onClose={() => setQuickChartSymbol(null)}
      />
    )}

    {portfolioTrendOpen ? (
      <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4">
        <div className="scrollbar-hide mt-auto max-h-[min(92dvh,940px)] w-full overflow-y-auto overscroll-y-contain rounded-t-2xl border border-cyan-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/80 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:mt-0 sm:max-w-4xl sm:rounded-2xl">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-cyan-200">Portfolio Analyze Command Center</h3>
              <p className="text-xs text-slate-300">{onOverview ? "Consolidated overview metrics" : `${selectedAccount?.name ?? "Account"} metrics`}</p>
            </div>
            <button
              type="button"
              onClick={() => setPortfolioTrendOpen(false)}
              className="rounded-md border border-(--card-border) px-2 py-1 text-xs text-(--muted) hover:bg-(--background)"
            >
              Close
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-cyan-500/35 bg-cyan-500/15 p-3 text-center">
              <p className="text-[11px] text-cyan-200">
                Beta-weighted exposure <Info text="Portfolio beta weighted by position size. Above 1 tends to move more than the market." />
              </p>
              <p className="mt-1 text-2xl font-semibold text-cyan-100">{analysis?.weightedBeta != null ? analysis.weightedBeta.toFixed(2) : "—"}</p>
            </div>
            <div className="rounded-xl border border-violet-500/35 bg-violet-500/15 p-3 text-center">
              <p className="text-[11px] text-violet-200">
                Volatility profile <Info text="Measured from weighted beta of top weighted holdings: High if beta > 1.20, Low if beta < 0.95, otherwise Moderate." />
              </p>
              <p className="mt-1 text-2xl font-semibold text-violet-100">
                {analysis?.weightedBeta != null ? (analysis.weightedBeta > 1.2 ? "High" : analysis.weightedBeta < 0.95 ? "Low" : "Moderate") : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/15 p-3 text-center">
              <p className="text-[11px] text-amber-200">
                Weighted forward P/E <Info text="Forward P/E weighted by holding size using next-12-month earnings estimates." />
              </p>
              <p className="mt-1 text-2xl font-semibold text-amber-100">{analysis?.avgForwardPe != null ? analysis.avgForwardPe.toFixed(1) : "—"}</p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 p-3">
              <p className="text-xs font-semibold text-cyan-200">
                Top 5 holdings <Info text="Largest positions by percent of portfolio." />
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {top5Holdings.length ? top5Holdings.map((r, i) => (
                  <li key={`${r.symbol}-h-${i}`} className="flex items-center justify-between rounded-md border border-cyan-500/25 bg-black/20 px-2 py-1">
                    <span className="font-mono">{r.symbol}</span>
                    <span className="text-cyan-100">{formatNumber(r.weightPct, 1)}%</span>
                  </li>
                )) : <li className="text-(--muted)">No holdings yet.</li>}
              </ul>
            </div>
            <div className="rounded-xl border border-fuchsia-500/35 bg-fuchsia-500/10 p-3">
              <p className="text-xs font-semibold text-fuchsia-200">
                Core weighted metrics <Info text="Weighted valuation and income metrics based on position sizes." />
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-(--card-border) bg-black/20 p-2 text-center">PEG<br /><span className="text-sm font-semibold">{analysis?.weightedPeg != null ? analysis.weightedPeg.toFixed(2) : "—"}</span></div>
                <div className="rounded-md border border-(--card-border) bg-black/20 p-2 text-center">Div Yield<br /><span className="text-sm font-semibold">{analysis?.weightedDividendYield != null ? `${analysis.weightedDividendYield.toFixed(2)}%` : "—"}</span></div>
                <div className="rounded-md border border-(--card-border) bg-black/20 p-2 text-center">P/E<br /><span className="text-sm font-semibold">{analysis?.avgPe != null ? analysis.avgPe.toFixed(1) : "—"}</span></div>
                <div className="rounded-md border border-(--card-border) bg-black/20 p-2 text-center">P/B<br /><span className="text-sm font-semibold">{analysis?.weightedPriceToBook != null ? analysis.weightedPriceToBook.toFixed(2) : "—"}</span></div>
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-(--card-border) bg-(--background) p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-(--muted)">
                Top movers <Info text="Largest percentage winners and losers over the selected timeframe." />
              </p>
              <div className="flex flex-wrap gap-1">
                {ANALYZE_INTERVALS.map((iv) => (
                  <button
                    key={iv}
                    type="button"
                    onClick={() => setAnalyzeInterval(iv)}
                    className={
                      "rounded-md px-2 py-1 text-[11px] " +
                      (analyzeInterval === iv
                        ? "bg-(--accent) text-(--accent-foreground)"
                        : "border border-(--card-border) hover:bg-(--card)")
                    }
                  >
                    {iv}
                  </button>
                ))}
              </div>
            </div>
            {moversLoading ? (
              <p className="text-sm text-(--muted)">Loading movers…</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs text-emerald-300">Largest % gainers ({analyzeInterval})</p>
                  <ul className="space-y-1">
                    {[...movers].sort((a, b) => b.changePct - a.changePct).slice(0, 5).map((m) => (
                      <li key={`g-${m.symbol}`} className="flex items-center justify-between rounded-md border border-emerald-500/20 px-2 py-1 text-sm">
                        <span className="font-mono">{m.symbol}</span>
                        <span className="text-emerald-300">{m.changePct > 0 ? "+" : ""}{formatNumber(m.changePct, 2)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-xs text-rose-300">Largest % losers ({analyzeInterval})</p>
                  <ul className="space-y-1">
                    {[...movers].sort((a, b) => a.changePct - b.changePct).slice(0, 5).map((m) => (
                      <li key={`l-${m.symbol}`} className="flex items-center justify-between rounded-md border border-rose-500/20 px-2 py-1 text-sm">
                        <span className="font-mono">{m.symbol}</span>
                        <span className="text-rose-300">{formatNumber(m.changePct, 2)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
