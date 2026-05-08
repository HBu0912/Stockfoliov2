"use client";

import { FAMOUS_INVESTORS } from "@/lib/famous-investors";
import { formatNumber, formatUsd } from "@/lib/money";
import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)",
  "oklch(0.65 0.12 255)", "oklch(0.72 0.14 145)", "oklch(0.75 0.12 30)",
  "oklch(0.6 0.1 300)", "oklch(0.7 0.1 200)",
];

type Holding = { symbol: string; shares: number; lastPrice: number | null };
type Account = { id: string; holdings: Holding[] };
type WeightEntry = { symbol: string; weightPct: number };

function toMap(items: WeightEntry[]) {
  const m = new Map<string, number>();
  for (const it of items) m.set(it.symbol.toUpperCase(), it.weightPct);
  return m;
}

function buildPieSlices(weights: WeightEntry[]) {
  const sorted = [...weights].sort((a, b) => b.weightPct - a.weightPct);
  const top = sorted.slice(0, 9);
  const otherPct = sorted.slice(9).reduce((s, r) => s + r.weightPct, 0);
  const slices = top.map((e, i) => ({ name: e.symbol, value: e.weightPct, fill: COLORS[i % COLORS.length] }));
  if (otherPct > 0) slices.push({ name: "Other", value: otherPct, fill: COLORS[9] });
  return slices;
}

function buildInsights(
  overlapPct: number,
  yourWeights: WeightEntry[],
  selected: (typeof FAMOUS_INVESTORS)[0],
  compRows: Array<{ symbol: string; my: number; their: number; delta: number; overlap: number }>
): string[] {
  const insights: string[] = [];
  const name = selected.name.split(" (")[0];
  const sharedCount = compRows.filter((r) => r.my > 0 && r.their > 0).length;
  const yourCount = yourWeights.length;
  const theirCount = selected.holdings.length;

  if (overlapPct >= 40) {
    insights.push(`Strong alignment with ${name} — ${formatNumber(overlapPct, 1)}% portfolio overlap. Your positions mirror their highest-conviction bets.`);
  } else if (overlapPct >= 20) {
    insights.push(`Moderate overlap of ${formatNumber(overlapPct, 1)}% with ${name}. You share ${sharedCount} ticker${sharedCount !== 1 ? "s" : ""}, but diverge on several key positions.`);
  } else {
    insights.push(`Low overlap of ${formatNumber(overlapPct, 1)}% with ${name}. Your portfolio takes a distinctly different approach from theirs.`);
  }

  const topOverweight = compRows.filter((r) => r.my > 0 && r.their === 0).slice(0, 3).map((r) => r.symbol);
  if (topOverweight.length > 0) {
    insights.push(`You hold ${topOverweight.join(", ")} which ${name} does not currently — these are your unique conviction plays.`);
  }

  const theirExclusive = compRows.filter((r) => r.their > 0 && r.my === 0).slice(0, 3).map((r) => r.symbol);
  if (theirExclusive.length > 0) {
    insights.push(`${name} holds ${theirExclusive.join(", ")} that you don't — potential names to research based on their thesis: "${selected.strategy}"`);
  }

  const bigDiffs = compRows.filter((r) => r.my > 0 && r.their > 0 && Math.abs(r.delta) > 5).slice(0, 2);
  for (const d of bigDiffs) {
    if (d.delta > 0) {
      insights.push(`You are ${formatNumber(d.delta, 1)}pp more concentrated in ${d.symbol} than ${name}. Consider if this aligns with your conviction level.`);
    } else {
      insights.push(`${name} carries ${formatNumber(Math.abs(d.delta), 1)}pp more ${d.symbol} than you — they appear to have higher conviction here.`);
    }
  }

  if (yourCount > theirCount * 1.5) {
    insights.push(`Your portfolio (${yourCount} tickers) is more diversified than ${name}'s concentrated ${theirCount}-position approach.`);
  } else if (theirCount > yourCount * 1.5) {
    insights.push(`${name} runs a more concentrated book (${theirCount} positions) vs your ${yourCount} holdings. Concentration can amplify both gains and losses.`);
  }

  insights.push(`Strategy note: ${selected.strategy}`);
  return insights;
}

export default function InvestorComparePage() {
  const [selectedId, setSelectedId] = useState(FAMOUS_INVESTORS[0]?.id ?? "");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzeOpen, setAnalyzeOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/accounts", { cache: "no-store" });
        const json = (await res.json()) as { accounts?: Account[] };
        if (!cancelled) setAccounts(json.accounts ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selected = useMemo(
    () => FAMOUS_INVESTORS.find((x) => x.id === selectedId) ?? FAMOUS_INVESTORS[0],
    [selectedId]
  );

  const yourWeights = useMemo((): WeightEntry[] => {
    const values = new Map<string, number>();
    let total = 0;
    for (const a of accounts) {
      for (const h of a.holdings ?? []) {
        const v = h.shares * (h.lastPrice ?? 0);
        total += v;
        values.set(h.symbol.toUpperCase(), (values.get(h.symbol.toUpperCase()) ?? 0) + v);
      }
    }
    if (total <= 0) return [];
    return [...values.entries()]
      .map(([symbol, value]) => ({ symbol, weightPct: (value / total) * 100 }))
      .sort((a, b) => b.weightPct - a.weightPct);
  }, [accounts]);

  const compRows = useMemo(() => {
    if (!selected) return [];
    const mine = toMap(yourWeights);
    const theirs = toMap(selected.holdings);
    const symbols = new Set([...mine.keys(), ...theirs.keys()]);
    return [...symbols]
      .map((symbol) => {
        const my = mine.get(symbol) ?? 0;
        const their = theirs.get(symbol) ?? 0;
        return { symbol, my, their, overlap: Math.min(my, their), delta: my - their };
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [selected, yourWeights]);

  const overlapPct = useMemo(() => compRows.reduce((sum, r) => sum + r.overlap, 0), [compRows]);
  const sharedTickers = useMemo(() => compRows.filter((r) => r.my > 0 && r.their > 0), [compRows]);

  const yourPieSlices = useMemo(() => buildPieSlices(yourWeights), [yourWeights]);
  const investorPieSlices = useMemo(() => buildPieSlices(selected?.holdings ?? []), [selected]);
  const insights = useMemo(() => {
    if (!selected || yourWeights.length === 0) return [];
    return buildInsights(overlapPct, yourWeights, selected, compRows);
  }, [overlapPct, yourWeights, selected, compRows]);

  const [pieHeight] = useState(200);

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <section className="rounded-2xl border border-(--card-border) bg-(--card) p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Famous Investor Compare</h1>
            <p className="mt-1 text-sm text-(--muted)">
              Pick a famous investor and compare their portfolio allocations to yours.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {yourWeights.length > 0 && (
              <button
                type="button"
                onClick={() => setAnalyzeOpen(true)}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-500"
              >
                ✦ Analyze
              </button>
            )}
          </div>
        </div>

        {/* Investor selector */}
        <div className="mt-4 grid gap-4 sm:grid-cols-[280px_minmax(0,1fr)]">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-(--muted)">Select Investor</label>
            <select
              className="w-full rounded-lg border border-(--card-border) bg-(--background) px-3 py-2 text-sm"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {FAMOUS_INVESTORS.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
            {selected && (
              <div className="mt-3 space-y-1.5 text-xs text-(--muted)">
                <p>{selected.strategy}</p>
                <p>Updated: {selected.updatedAt}</p>
                <a className="text-sky-400 hover:underline" href={selected.sourceUrl} target="_blank" rel="noreferrer">
                  {selected.sourceLabel} ↗
                </a>
              </div>
            )}
          </div>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-(--card-border) bg-(--background) p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-(--muted)">Portfolio Overlap</p>
              <p className={
                "mt-1 text-2xl font-bold tabular-nums " +
                (overlapPct >= 30 ? "text-emerald-400" : overlapPct >= 15 ? "text-amber-400" : "text-rose-400")
              }>{formatNumber(overlapPct, 1)}%</p>
            </div>
            <div className="rounded-xl border border-(--card-border) bg-(--background) p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-(--muted)">Shared Tickers</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-indigo-400">{sharedTickers.length}</p>
            </div>
            <div className="rounded-xl border border-(--card-border) bg-(--background) p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-(--muted)">Your Positions</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{yourWeights.length}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Side-by-side pie charts */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Your pie */}
        <div className="rounded-2xl border border-(--card-border) bg-(--card) p-4">
          <p className="mb-3 text-sm font-semibold">Your Portfolio</p>
          {loading ? (
            <div className="flex h-48 items-center justify-center"><p className="text-sm text-(--muted)">Loading...</p></div>
          ) : yourPieSlices.length === 0 ? (
            <p className="text-sm text-(--muted)">No holdings with prices yet. Add holdings to see your allocation.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={pieHeight}>
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as { name: string; value: number };
                      return (
                        <div className="rounded-lg border border-(--card-border) bg-(--background) px-2 py-1.5 text-xs shadow">
                          <p className="font-semibold">{p.name}</p>
                          <p>{formatNumber(p.value, 1)}%</p>
                        </div>
                      );
                    }}
                  />
                  <Pie data={yourPieSlices} dataKey="value" nameKey="name" innerRadius="40%" outerRadius="78%" paddingAngle={2} animationDuration={350} stroke="var(--card)" strokeWidth={1} cornerRadius={4}>
                    {yourPieSlices.map((_, i) => <Cell key={i} fill={yourPieSlices[i].fill} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {yourPieSlices.map((s) => (
                  <div key={s.name} className="flex items-center justify-between gap-1.5">
                    <span className="flex items-center gap-1.5 text-(--muted)">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.fill }} />
                      {s.name}
                    </span>
                    <span className="font-medium">{formatNumber(s.value, 1)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Investor pie */}
        <div className="rounded-2xl border border-(--card-border) bg-(--card) p-4">
          <p className="mb-3 text-sm font-semibold">{selected?.name ?? "Investor"}</p>
          {investorPieSlices.length === 0 ? (
            <p className="text-sm text-(--muted)">No holdings data.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={pieHeight}>
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as { name: string; value: number };
                      return (
                        <div className="rounded-lg border border-(--card-border) bg-(--background) px-2 py-1.5 text-xs shadow">
                          <p className="font-semibold">{p.name}</p>
                          <p>{formatNumber(p.value, 1)}%</p>
                        </div>
                      );
                    }}
                  />
                  <Pie data={investorPieSlices} dataKey="value" nameKey="name" innerRadius="40%" outerRadius="78%" paddingAngle={2} animationDuration={350} stroke="var(--card)" strokeWidth={1} cornerRadius={4}>
                    {investorPieSlices.map((_, i) => <Cell key={i} fill={investorPieSlices[i].fill} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {investorPieSlices.map((s) => (
                  <div key={s.name} className="flex items-center justify-between gap-1.5">
                    <span className="flex items-center gap-1.5 text-(--muted)">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.fill }} />
                      {s.name}
                    </span>
                    <span className="font-medium">{formatNumber(s.value, 1)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Shared holdings bubbles */}
      {sharedTickers.length > 0 && (
        <section className="rounded-2xl border border-(--card-border) bg-(--card) p-4">
          <h2 className="mb-3 text-sm font-semibold">
            Shared Holdings <span className="text-(--muted)">({sharedTickers.length})</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {sharedTickers.map((r) => {
              const diff = r.delta;
              return (
                <div
                  key={r.symbol}
                  className="rounded-xl border border-(--card-border) bg-(--background) px-3 py-2 text-center"
                  style={{ minWidth: "4.5rem" }}
                >
                  <p className="text-xs font-bold">{r.symbol}</p>
                  <div className="mt-1 text-[10px] leading-tight text-(--muted)">
                    <p>You: <span className="font-medium text-foreground">{formatNumber(r.my, 1)}%</span></p>
                    <p>Inv: <span className="font-medium text-foreground">{formatNumber(r.their, 1)}%</span></p>
                  </div>
                  <p className={
                    "mt-1 text-[10px] font-semibold tabular-nums " +
                    (diff > 0 ? "text-emerald-400" : diff < 0 ? "text-rose-400" : "text-(--muted)")
                  }>
                    {diff > 0 ? "+" : ""}{formatNumber(diff, 1)}pp
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-(--muted)">pp = percentage point difference (positive = you own more).</p>
        </section>
      )}

      {/* Full comparison table */}
      <section className="rounded-2xl border border-(--card-border) bg-(--card) p-4">
        <h2 className="mb-1 text-sm font-semibold">Full Allocation Comparison</h2>
        <p className="mb-3 text-xs text-(--muted)">
          Sorted by magnitude of difference. Green = you are overweight, red = investor is overweight.
        </p>
        {loading ? (
          <p className="text-sm text-(--muted)">Loading portfolio...</p>
        ) : (
          <div className="space-y-1.5">
            {compRows.slice(0, 20).map((r) => (
              <div
                key={r.symbol}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-(--card-border) px-3 py-2 text-sm"
              >
                <span className="w-16 shrink-0 font-mono font-semibold">{r.symbol}</span>
                <div className="flex flex-1 items-center gap-1 min-w-0">
                  {/* You bar */}
                  <div className="w-full max-w-32 overflow-hidden rounded-full bg-slate-800 h-1.5">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, r.my * 4)}%` }} />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs text-(--muted)">You {formatNumber(r.my, 1)}%</span>
                </div>
                <div className="flex flex-1 items-center gap-1 min-w-0">
                  {/* Investor bar */}
                  <div className="w-full max-w-32 overflow-hidden rounded-full bg-slate-800 h-1.5">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, r.their * 4)}%` }} />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs text-(--muted)">Inv {formatNumber(r.their, 1)}%</span>
                </div>
                <span className={
                  "w-16 shrink-0 text-right text-xs font-semibold tabular-nums " +
                  (r.delta > 0 ? "text-emerald-400" : r.delta < 0 ? "text-rose-400" : "text-(--muted)")
                }>
                  {r.delta > 0 ? "+" : ""}{formatNumber(r.delta, 1)}pp
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Analyze modal */}
      {analyzeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          onClick={() => setAnalyzeOpen(false)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-t-2xl border border-(--card-border) bg-(--card) shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-(--card-border) px-5 py-4">
              <div>
                <p className="font-semibold">Portfolio Analysis</p>
                <p className="text-xs text-(--muted)">vs. {selected?.name}</p>
              </div>
              <button type="button" onClick={() => setAnalyzeOpen(false)} className="rounded-md border border-(--card-border) px-2.5 py-1 text-xs text-(--muted) hover:text-foreground">Close</button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-3 pb-[env(safe-area-inset-bottom)]">
              {insights.map((insight, i) => (
                <div key={i} className="flex gap-3 rounded-lg border border-(--card-border) bg-(--background) px-3 py-3 text-sm">
                  <span className="mt-0.5 shrink-0 text-indigo-400">✦</span>
                  <p className="text-xs leading-relaxed text-(--muted)">{insight}</p>
                </div>
              ))}
              <p className="pt-2 text-[10px] text-(--muted) text-center">Analysis based on reported 13F holdings. Not financial advice.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
