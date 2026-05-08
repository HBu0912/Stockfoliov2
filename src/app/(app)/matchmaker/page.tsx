"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StockAnalysisPanel } from "@/components/StockAnalysisPanel";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatNumber, formatUsd } from "@/lib/money";

// ── Preference definitions ───────────────────────────────────────────────────

const SECTORS = [
  "Technology", "Communication Services", "Consumer Discretionary",
  "Consumer Staples", "Healthcare", "Financial Services",
  "Energy", "Industrials", "Materials", "Real Estate", "Utilities",
] as const;
type Sector = (typeof SECTORS)[number];

// Style tags — determined dynamically from Yahoo Finance data
const STYLES = ["Growth", "Value", "Dividend", "Blend"] as const;
type StyleTag = (typeof STYLES)[number];

const CAP_TIERS = [
  { id: "any", label: "Any" },
  { id: "small", label: "Small  (<$2B)" },
  { id: "mid", label: "Mid  ($2B–$10B)" },
  { id: "large", label: "Large  ($10B–$200B)" },
  { id: "mega", label: "Mega  ($200B+)" },
] as const;
type CapTierId = (typeof CAP_TIERS)[number]["id"];

const PERFORMANCE_OPTS = [
  { label: "Any", value: -Infinity },
  { label: "> 5%", value: 5 },
  { label: "> 10%", value: 10 },
  { label: "> 20%", value: 20 },
] as const;

const DIVIDEND_OPTS = [
  { label: "Any", value: 0 },
  { label: "> 1%", value: 1 },
  { label: "> 2%", value: 2 },
  { label: "> 3%", value: 3 },
  { label: "> 5%", value: 5 },
] as const;

const BETA_OPTS = [
  { label: "Any", id: "any", min: -Infinity, max: Infinity },
  { label: "Low (<0.8)", id: "low", min: -Infinity, max: 0.8 },
  { label: "Moderate (0.8–1.5)", id: "mod", min: 0.8, max: 1.5 },
  { label: "High (>1.5)", id: "high", min: 1.5, max: Infinity },
] as const;
type BetaId = "any" | "low" | "mod" | "high";

const ANALYST_OPTS = ["Any", "Buy or Better", "Strong Buy"] as const;
type AnalystFilter = (typeof ANALYST_OPTS)[number];

type Prefs = {
  styles: StyleTag[];
  sectors: Sector[];
  capTierId: CapTierId;
  minPerf1Y: number;
  minDivYield: number;
  betaId: BetaId;
  analyst: AnalystFilter;
};

const DEFAULT_PREFS: Prefs = {
  styles: [],
  sectors: [],
  capTierId: "any",
  minPerf1Y: -Infinity,
  minDivYield: 0,
  betaId: "any",
  analyst: "Any",
};

// ── Dynamic classification rules (using Yahoo Finance API data) ──────────────

type BasicStockData = {
  symbol: string;
  name: string;
  sector: string | null;
  metrics: {
    marketCap: number | null;
    dividendYield: number | null;
    trailingPE: number | null;
    forwardPE: number | null;
    priceToBook: number | null;
    beta: number | null;
    revenueGrowth: number | null;
  };
  analyst: { strongBuy: number; buy: number; hold: number; sell: number; strongSell: number } | null;
  changePct: number | null;
};

function classifyStyles(d: BasicStockData): StyleTag[] {
  const styles: StyleTag[] = [];
  const dy = (d.metrics.dividendYield ?? 0) * 100;
  const pe = d.metrics.trailingPE;
  const pb = d.metrics.priceToBook;
  const rg = d.metrics.revenueGrowth ?? 0; // decimal (0.15 = 15%)
  const fpe = d.metrics.forwardPE;

  if (dy >= 1.5) styles.push("Dividend");
  if (rg >= 0.1 || (fpe != null && fpe > 25 && dy < 1)) styles.push("Growth");
  if (pe != null && pe > 0 && pe < 20 && pb != null && pb > 0 && pb < 3) styles.push("Value");
  if (styles.length === 0) styles.push("Blend");
  return styles;
}

function capTierFromMarketCap(marketCap: number | null): CapTierId {
  if (marketCap == null) return "any";
  if (marketCap >= 200e9) return "mega";
  if (marketCap >= 10e9) return "large";
  if (marketCap >= 2e9) return "mid";
  return "small";
}

function passesFilters(d: BasicStockData, p: Prefs): boolean {
  const betaOpt = BETA_OPTS.find((b) => b.id === p.betaId) ?? BETA_OPTS[0];

  // Cap tier
  if (p.capTierId !== "any") {
    if (capTierFromMarketCap(d.metrics.marketCap) !== p.capTierId) return false;
  }

  // Style (dynamic classification)
  if (p.styles.length > 0) {
    const stockStyles = classifyStyles(d);
    if (!p.styles.some((s) => stockStyles.includes(s))) return false;
  }

  // 1Y performance (appreciated YTD/1Y)
  if (p.minPerf1Y > -Infinity) {
    if (d.changePct === null || d.changePct < p.minPerf1Y) return false;
  }

  // Dividend yield
  if (p.minDivYield > 0) {
    const dy = (d.metrics.dividendYield ?? 0) * 100;
    if (dy < p.minDivYield) return false;
  }

  // Beta
  if (betaOpt.id !== "any") {
    const beta = d.metrics.beta;
    if (beta == null || beta < betaOpt.min || beta > betaOpt.max) return false;
  }

  // Analyst
  if (p.analyst !== "Any" && d.analyst) {
    const total = d.analyst.strongBuy + d.analyst.buy + d.analyst.hold + d.analyst.sell + d.analyst.strongSell;
    if (total === 0) return false;
    if (p.analyst === "Buy or Better" && (d.analyst.strongBuy + d.analyst.buy) / total < 0.5) return false;
    if (p.analyst === "Strong Buy" && d.analyst.strongBuy / total < 0.4) return false;
  }

  return true;
}

// ── Small reusable components ────────────────────────────────────────────────

function InfoIcon({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative ml-1 inline-flex">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-(--card-border) text-[9px] text-(--muted) transition hover:border-indigo-400 hover:text-indigo-300"
      >?</button>
      {open && (
        <span className="absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 rounded-xl border border-(--card-border) bg-(--card) p-3 text-[11px] leading-relaxed text-(--muted) shadow-2xl">
          {text}
        </span>
      )}
    </span>
  );
}

const PREF_INFO: Record<string, string> = {
  styles: "Dynamically classified from Yahoo Finance data. Growth = 10%+ revenue growth or high forward P/E with no dividend. Value = P/E < 20 and P/B < 3. Dividend = 1.5%+ yield. Blend = everything else.",
  sectors: "Limit to specific industry sectors. Leave empty to see all.",
  capTierId: "Small <$2B · Mid $2B–$10B · Large $10B–$200B · Mega $200B+",
  minPerf1Y: "Minimum 1-year price return (appreciation). >5% means the stock gained at least 5% over the past year.",
  minDivYield: "Annual dividend as % of stock price. Higher yield = more income.",
  betaId: "How much the stock moves vs. the market. Low (<0.8) = defensive. High (>1.5) = volatile.",
  analyst: "Wall Street analyst consensus. 'Buy or Better' = majority buy/strong buy ratings.",
};

function PrefLabel({ label, infoKey }: { label: string; infoKey: string }) {
  return (
    <label className="mb-2 flex items-center text-xs font-semibold uppercase tracking-wider text-(--muted)">
      {label}<InfoIcon text={PREF_INFO[infoKey] ?? ""} />
    </label>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1 text-xs font-medium transition " +
        (active ? "border-indigo-500 bg-indigo-600/30 text-indigo-200" : "border-(--card-border) text-(--muted) hover:border-slate-500 hover:text-foreground")
      }
    >{children}</button>
  );
}

// ── Holding mini-pie ─────────────────────────────────────────────────────────

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "oklch(0.65 0.12 255)", "oklch(0.72 0.14 145)"];

type AccountHolding = { symbol: string; shares: number; lastPrice: number | null; name?: string | null };

function PortfolioPill({ symbol, accounts }: { symbol: string; accounts: Array<{ holdings: AccountHolding[] }> }) {
  const { weight, slices } = (() => {
    const vals = new Map<string, number>();
    let total = 0;
    for (const a of accounts) {
      for (const h of a.holdings) {
        const v = h.shares * (h.lastPrice ?? 0);
        if (v <= 0) continue;
        total += v;
        vals.set(h.symbol.toUpperCase(), (vals.get(h.symbol.toUpperCase()) ?? 0) + v);
      }
    }
    if (total <= 0) return { weight: 0, slices: [] };
    const sorted = [...vals.entries()].sort((a, b) => b[1] - a[1]);
    const w = ((vals.get(symbol.toUpperCase()) ?? 0) / total) * 100;
    const top8 = sorted.slice(0, 8);
    const otherVal = sorted.slice(8).reduce((s, [, v]) => s + v, 0);
    const sliceData = top8.map(([sym, val], i) => ({
      name: sym, value: val, fill: PIE_COLORS[i % PIE_COLORS.length],
      isTarget: sym.toUpperCase() === symbol.toUpperCase(),
    }));
    if (otherVal > 0) sliceData.push({ name: "Other", value: otherVal, fill: "#475569", isTarget: false });
    return { weight: w, slices: sliceData };
  })();

  if (slices.length === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-(--card-border) bg-(--card) px-4 py-3">
      <div className="shrink-0">
        <ResponsiveContainer width={64} height={64}>
          <PieChart>
            <Pie data={slices} dataKey="value" innerRadius="38%" outerRadius="82%" paddingAngle={1} animationDuration={250} stroke="none">
              {slices.map((s, i) => (
                <Cell key={i} fill={s.fill} opacity={s.isTarget ? 1 : 0.4} strokeWidth={s.isTarget ? 2 : 0} stroke={s.isTarget ? "#818cf8" : "none"} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as { name: string; value: number };
                const total2 = slices.reduce((s, x) => s + x.value, 0);
                return (
                  <div className="rounded-md border border-(--card-border) bg-(--background) px-2 py-1 text-[10px] shadow">
                    {p.name}: {formatNumber((p.value / total2) * 100, 1)}%
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold">Your Portfolio</p>
        {weight > 0 ? (
          <>
            <p className="text-sm font-bold text-indigo-300">{formatNumber(weight, 2)}%</p>
            <p className="text-[10px] text-(--muted)">current allocation to {symbol}</p>
          </>
        ) : (
          <>
            <p className="text-[10px] text-(--muted)">Not currently held</p>
            <p className="text-[10px] text-indigo-400">Click ♥ to add to watchlist</p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

const LS_LIKED = "pf-matchmaker-liked";
const LS_PREFS = "pf-matchmaker-prefs";

type LikedStock = {
  symbol: string;
  name: string;
  price: number | null;
  changePct: number | null;
  sector: string | null;
  likedAt: number;
};

type Phase = "prefs" | "swiping" | "liked";

export default function MatchmakerPage() {
  const [phase, setPhase] = useState<Phase>("prefs");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [liked, setLiked] = useState<LikedStock[]>([]);
  const [accounts, setAccounts] = useState<Array<{ holdings: AccountHolding[] }>>([]);

  // Swipe state
  const [queue, setQueue] = useState<string[]>([]);
  const [queueIdx, setQueueIdx] = useState(0);
  const [currentSymbol, setCurrentSymbol] = useState<string | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [seenSymbols, setSeenSymbols] = useState<Set<string>>(new Set());
  const [noMore, setNoMore] = useState(false);
  const [swipeAnim, setSwipeAnim] = useState<"like" | "pass" | null>(null);
  const [currentBasicData, setCurrentBasicData] = useState<BasicStockData | null>(null);

  const prefetchRef = useRef<BasicStockData | null>(null);
  const prefetchSymbolRef = useRef<string | null>(null);

  // Load persisted state
  useEffect(() => {
    try { const r = localStorage.getItem(LS_LIKED); if (r) setLiked(JSON.parse(r) as LikedStock[]); } catch { /* ignore */ }
    try { const r = localStorage.getItem(LS_PREFS); if (r) setPrefs({ ...DEFAULT_PREFS, ...(JSON.parse(r) as Prefs) }); } catch { /* ignore */ }
  }, []);

  // Load accounts for portfolio pie
  useEffect(() => {
    fetch("/api/accounts").then((r) => r.ok ? r.json() : { accounts: [] })
      .then((d: { accounts?: Array<{ holdings: AccountHolding[] }> }) => setAccounts(d.accounts ?? []))
      .catch(() => { /* ignore */ });
  }, []);

  function saveLiked(next: LikedStock[]) {
    setLiked(next);
    try { localStorage.setItem(LS_LIKED, JSON.stringify(next)); } catch { /* ignore */ }
  }

  function savePrefs(next: Prefs) {
    setPrefs(next);
    try { localStorage.setItem(LS_PREFS, JSON.stringify(next)); } catch { /* ignore */ }
  }

  // Fetch basic stock data for filtering
  const fetchBasic = useCallback(async (symbol: string): Promise<BasicStockData | null> => {
    try {
      const res = await fetch(`/api/stocks/${encodeURIComponent(symbol)}?interval=1Y`);
      if (!res.ok) return null;
      const d = await res.json() as Record<string, unknown>;
      const m = (d.metrics ?? {}) as Record<string, unknown>;
      const a = d.analyst as BasicStockData["analyst"] ?? null;
      return {
        symbol: String(d.symbol ?? symbol),
        name: String(d.name ?? symbol),
        sector: (d.sector as string | null) ?? null,
        changePct: (d.changePct as number | null) ?? null,
        metrics: {
          marketCap: (m.marketCap as number | null) ?? null,
          dividendYield: (m.dividendYield as number | null) ?? null,
          trailingPE: (m.trailingPE as number | null) ?? null,
          forwardPE: (m.forwardPE as number | null) ?? null,
          priceToBook: (m.priceToBook as number | null) ?? null,
          beta: (m.beta as number | null) ?? null,
          revenueGrowth: (m.revenueGrowth as number | null) ?? null,
        },
        analyst: a,
      };
    } catch { return null; }
  }, []);

  const advanceQueue = useCallback(
    async (currentQueue: string[], startIdx: number, currentPrefs: Prefs, currentSeen: Set<string>) => {
      let idx = startIdx;
      while (idx < currentQueue.length) {
        const sym = currentQueue[idx];
        if (currentSeen.has(sym)) { idx++; continue; }

        setQueueIdx(idx + 1);
        setCardLoading(true);
        setCurrentSymbol(null);
        setCurrentBasicData(null);

        let data: BasicStockData | null = null;
        if (prefetchRef.current && prefetchSymbolRef.current === sym) {
          data = prefetchRef.current;
          prefetchRef.current = null;
          prefetchSymbolRef.current = null;
        } else {
          data = await fetchBasic(sym);
        }

        setCardLoading(false);

        if (!data || !passesFilters(data, currentPrefs)) {
          setSeenSymbols((prev) => new Set([...prev, sym]));
          idx++;
          continue;
        }

        setCurrentSymbol(data.symbol);
        setCurrentBasicData(data);
        setSeenSymbols((prev) => new Set([...prev, sym]));

        // Prefetch next
        const nextSym = currentQueue[idx + 1];
        if (nextSym && !currentSeen.has(nextSym) && nextSym !== prefetchSymbolRef.current) {
          prefetchSymbolRef.current = nextSym;
          fetchBasic(nextSym).then((d) => {
            if (prefetchSymbolRef.current === nextSym) prefetchRef.current = d;
          });
        }
        return;
      }
      setCurrentSymbol(null);
      setCardLoading(false);
      setNoMore(true);
    },
    [fetchBasic]
  );

  async function startSwiping() {
    const params = new URLSearchParams();
    if (prefs.sectors.length > 0) params.set("sectors", prefs.sectors.join(","));
    if (prefs.capTierId !== "any") params.set("capTier", prefs.capTierId);
    params.set("exclude", [...seenSymbols].join(","));

    setPhase("swiping");
    setNoMore(false);
    setCurrentSymbol(null);
    setCardLoading(true);

    const res = await fetch(`/api/matchmaker/stocks?${params.toString()}`);
    const d = (await res.json()) as { symbols: string[] };
    const newQueue = d.symbols ?? [];
    setQueue(newQueue);
    setQueueIdx(0);
    await advanceQueue(newQueue, 0, prefs, seenSymbols);
  }

  function handleLike() {
    if (!currentSymbol || !currentBasicData) return;
    setSwipeAnim("like");
    const allAccHoldings = accounts.flatMap((a) => a.holdings);
    const holding = allAccHoldings.find((h) => h.symbol.toUpperCase() === currentSymbol.toUpperCase());
    saveLiked([
      {
        symbol: currentSymbol,
        name: currentBasicData.name,
        price: holding?.lastPrice ?? null,
        changePct: currentBasicData.changePct,
        sector: currentBasicData.sector,
        likedAt: Date.now(),
      },
      ...liked.filter((l) => l.symbol !== currentSymbol),
    ]);
    setTimeout(() => {
      setSwipeAnim(null);
      void advanceQueue(queue, queueIdx, prefs, seenSymbols);
    }, 320);
  }

  function handlePass() {
    if (!currentSymbol) return;
    setSwipeAnim("pass");
    setTimeout(() => {
      setSwipeAnim(null);
      void advanceQueue(queue, queueIdx, prefs, seenSymbols);
    }, 320);
  }

  function toggleStyle(s: StyleTag) {
    savePrefs({ ...prefs, styles: prefs.styles.includes(s) ? prefs.styles.filter((x) => x !== s) : [...prefs.styles, s] });
  }
  function toggleSector(s: Sector) {
    savePrefs({ ...prefs, sectors: prefs.sectors.includes(s) ? prefs.sectors.filter((x) => x !== s) : [...prefs.sectors, s] });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="relative px-3 py-5 sm:px-5 sm:py-6">
      {/* Page header */}
      <div className="mx-auto mb-5 flex max-w-5xl items-center justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Stock Matchmaker</h1>
          <p className="mt-0.5 text-xs text-(--muted)">
            Set your preferences, then swipe to discover stocks that match your style.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPhase("liked")}
            className={"relative rounded-lg border px-3 py-1.5 text-xs font-medium transition " + (phase === "liked" ? "border-(--accent) bg-(--card) text-foreground" : "border-(--card-border) text-(--muted) hover:text-foreground")}
          >
            ❤️ Liked
            {liked.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white">
                {liked.length > 99 ? "99+" : liked.length}
              </span>
            )}
          </button>
          {phase === "swiping" && (
            <button type="button" onClick={() => setPhase("prefs")} className="rounded-lg border border-(--card-border) px-3 py-1.5 text-xs font-medium text-(--muted) hover:text-foreground">⚙ Prefs</button>
          )}
          {phase === "liked" && (
            <button type="button" onClick={() => setPhase("prefs")} className="rounded-lg border border-(--card-border) px-3 py-1.5 text-xs font-medium text-(--muted) hover:text-foreground">← Prefs</button>
          )}
        </div>
      </div>

      {/* ── Preferences ─────────────────────────────────────────────────────── */}
      {phase === "prefs" && (
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="rounded-2xl border border-(--card-border) bg-(--card) p-4">
            <PrefLabel label="Investment Style" infoKey="styles" />
            <p className="mb-3 text-xs text-(--muted)">Classified dynamically from Yahoo Finance data. Leave empty to see all styles.</p>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <Pill key={s} active={prefs.styles.includes(s)} onClick={() => toggleStyle(s)}>
                  {s === "Growth" && "📈 "}{s === "Value" && "💎 "}{s === "Dividend" && "💰 "}{s === "Blend" && "🔀 "}{s}
                </Pill>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-(--card-border) bg-(--card) p-4">
            <PrefLabel label="Sectors" infoKey="sectors" />
            <p className="mb-3 text-xs text-(--muted)">Leave empty to see all sectors.</p>
            <div className="flex flex-wrap gap-2">
              {SECTORS.map((s) => (
                <Pill key={s} active={prefs.sectors.includes(s)} onClick={() => toggleSector(s)}>{s}</Pill>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-(--card-border) bg-(--card) p-4">
              <PrefLabel label="Market Cap" infoKey="capTierId" />
              <div className="flex flex-wrap gap-2">
                {CAP_TIERS.map((t) => (
                  <Pill key={t.id} active={prefs.capTierId === t.id} onClick={() => savePrefs({ ...prefs, capTierId: t.id })}>{t.label}</Pill>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-(--card-border) bg-(--card) p-4">
              <PrefLabel label="Appreciated YTD / 1Y" infoKey="minPerf1Y" />
              <div className="flex flex-wrap gap-2">
                {PERFORMANCE_OPTS.map((o) => (
                  <Pill key={o.label} active={prefs.minPerf1Y === o.value} onClick={() => savePrefs({ ...prefs, minPerf1Y: o.value })}>{o.label}</Pill>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-(--card-border) bg-(--card) p-4">
              <PrefLabel label="Min Dividend Yield" infoKey="minDivYield" />
              <div className="flex flex-wrap gap-2">
                {DIVIDEND_OPTS.map((o) => (
                  <Pill key={o.label} active={prefs.minDivYield === o.value} onClick={() => savePrefs({ ...prefs, minDivYield: o.value })}>{o.label}</Pill>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-(--card-border) bg-(--card) p-4">
              <PrefLabel label="Volatility (Beta)" infoKey="betaId" />
              <div className="flex flex-wrap gap-2">
                {BETA_OPTS.map((o) => (
                  <Pill key={o.id} active={prefs.betaId === o.id} onClick={() => savePrefs({ ...prefs, betaId: o.id as BetaId })}>{o.label}</Pill>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-(--card-border) bg-(--card) p-4">
            <PrefLabel label="Analyst Consensus" infoKey="analyst" />
            <div className="flex flex-wrap gap-2">
              {ANALYST_OPTS.map((o) => (
                <Pill key={o} active={prefs.analyst === o} onClick={() => savePrefs({ ...prefs, analyst: o })}>{o}</Pill>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pb-2">
            <button type="button" onClick={() => savePrefs(DEFAULT_PREFS)} className="rounded-xl border border-(--card-border) px-4 py-2 text-sm text-(--muted) hover:text-foreground">Reset all</button>
            <button type="button" onClick={() => void startSwiping()} className="rounded-xl bg-indigo-600 px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:bg-indigo-500">Find Stocks →</button>
          </div>
        </div>
      )}

      {/* ── Swipe phase ──────────────────────────────────────────────────────── */}
      {phase === "swiping" && (
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 text-center text-xs text-(--muted)">
            {noMore ? "You've seen all matching stocks." : cardLoading ? "Finding your next match…" : currentSymbol ? `Stock ${queueIdx} of ${queue.length}` : ""}
          </p>

          {/* No more */}
          {noMore && (
            <div className="rounded-2xl border border-(--card-border) bg-(--card) p-10 text-center">
              <p className="text-4xl">🎉</p>
              <p className="mt-3 font-semibold">You&apos;ve seen everything!</p>
              <p className="mt-1 text-sm text-(--muted)">{liked.length > 0 ? `You liked ${liked.length} stock${liked.length !== 1 ? "s" : ""}. Check your liked list!` : "Try adjusting your preferences for more results."}</p>
              <div className="mt-5 flex justify-center gap-3">
                <button type="button" onClick={() => setPhase("prefs")} className="rounded-xl border border-(--card-border) px-4 py-2 text-sm text-(--muted) hover:text-foreground">Adjust Prefs</button>
                {liked.length > 0 && <button type="button" onClick={() => setPhase("liked")} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500">View Liked ❤️</button>}
              </div>
            </div>
          )}

          {/* Loading */}
          {cardLoading && !noMore && (
            <div className="animate-pulse rounded-2xl border border-(--card-border) bg-(--card) p-6 space-y-4">
              <div className="h-8 w-48 rounded-lg bg-(--background)" />
              <div className="h-64 rounded-xl bg-(--background)" />
              <div className="grid grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-(--background)" />)}
              </div>
            </div>
          )}

          {/* Stock card with sticky like/pass buttons */}
          {currentSymbol && !cardLoading && !noMore && (
            <div className={
              "transition-all duration-300 " +
              (swipeAnim === "like" ? "translate-x-16 rotate-2 opacity-0" : swipeAnim === "pass" ? "-translate-x-16 -rotate-2 opacity-0" : "translate-x-0 rotate-0 opacity-100")
            }>
              {/* Portfolio allocation pill */}
              {accounts.length > 0 && (
                <div className="mb-3">
                  <PortfolioPill symbol={currentSymbol} accounts={accounts} />
                </div>
              )}

              {/* Full Charts-quality panel */}
              <div className="rounded-2xl border border-(--card-border) bg-(--card) overflow-hidden">
                <StockAnalysisPanel symbol={currentSymbol} showOpenPageButton={true} defaultInterval="3M" />
              </div>
            </div>
          )}

          {/* Sticky like/pass buttons — fixed left and right */}
          {currentSymbol && !cardLoading && !noMore && (
            <>
              {/* Pass — fixed left */}
              <button
                type="button"
                onClick={handlePass}
                className="fixed left-3 top-1/2 z-40 -translate-y-1/2 flex h-14 w-14 items-center justify-center rounded-full border-2 border-(--card-border) bg-(--card) text-xl shadow-xl transition hover:border-slate-400 active:scale-95 sm:left-6"
                aria-label="Pass"
              >
                ✕
              </button>
              {/* Like — fixed right */}
              <button
                type="button"
                onClick={handleLike}
                className="fixed right-3 top-1/2 z-40 -translate-y-1/2 flex h-14 w-14 items-center justify-center rounded-full border-2 border-rose-500/60 bg-rose-600/20 text-xl shadow-xl transition hover:border-rose-400 hover:bg-rose-600/35 active:scale-95 sm:right-6"
                aria-label="Like"
              >
                ♥
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Liked stocks ─────────────────────────────────────────────────────── */}
      {phase === "liked" && (
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Your Liked Stocks <span className="text-(--muted)">({liked.length})</span></h2>
            {liked.length > 0 && (
              <button type="button" onClick={() => { if (confirm("Clear all liked stocks?")) saveLiked([]); }} className="text-xs text-(--muted) hover:text-rose-400">Clear all</button>
            )}
          </div>

          {liked.length === 0 ? (
            <div className="rounded-2xl border border-(--card-border) bg-(--card) p-10 text-center">
              <p className="text-4xl">💔</p>
              <p className="mt-3 text-(--muted)">No liked stocks yet.</p>
              <button type="button" onClick={() => setPhase("prefs")} className="mt-4 rounded-xl bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Start Discovering</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {liked.map((l) => (
                <div key={l.symbol} className="relative rounded-2xl border border-(--card-border) bg-(--card) p-4">
                  <button type="button" onClick={() => saveLiked(liked.filter((x) => x.symbol !== l.symbol))} className="absolute right-3 top-3 text-xs text-(--muted) hover:text-rose-400">✕</button>
                  <div className="pr-5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold">{l.symbol}</span>
                      {l.changePct != null && (
                        <span className={"text-xs font-medium tabular-nums " + (l.changePct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                          {l.changePct >= 0 ? "+" : ""}{formatNumber(l.changePct, 2)}%
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-(--muted)">{l.name}</p>
                    {l.sector && <span className="mt-1.5 inline-block rounded-full border border-indigo-700/40 bg-indigo-900/20 px-2 py-0.5 text-[10px] text-indigo-300">{l.sector}</span>}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    {l.price != null && <p className="text-sm font-semibold">{formatUsd(l.price)}</p>}
                    <p className="text-[10px] text-(--muted)">{new Date(l.likedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex justify-center">
            <button type="button" onClick={() => void startSwiping()} className="rounded-xl bg-indigo-600 px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:bg-indigo-500">Discover More →</button>
          </div>
        </div>
      )}
    </div>
  );
}
