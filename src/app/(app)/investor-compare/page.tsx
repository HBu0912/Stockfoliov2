"use client";

import { FAMOUS_INVESTORS } from "@/lib/famous-investors";
import { formatNumber } from "@/lib/money";
import { useEffect, useMemo, useState } from "react";

type Holding = { symbol: string; shares: number; lastPrice: number | null };
type Account = { id: string; holdings: Holding[] };

function toMap(items: Array<{ symbol: string; weightPct: number }>) {
  const m = new Map<string, number>();
  for (const it of items) m.set(it.symbol.toUpperCase(), it.weightPct);
  return m;
}

export default function InvestorComparePage() {
  const [selectedId, setSelectedId] = useState(FAMOUS_INVESTORS[0]?.id ?? "");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

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
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => FAMOUS_INVESTORS.find((x) => x.id === selectedId) ?? FAMOUS_INVESTORS[0],
    [selectedId]
  );

  const yourWeights = useMemo(() => {
    const values = new Map<string, number>();
    let total = 0;
    for (const a of accounts) {
      for (const h of a.holdings ?? []) {
        const v = h.shares * (h.lastPrice ?? 0);
        total += v;
        values.set(h.symbol.toUpperCase(), (values.get(h.symbol.toUpperCase()) ?? 0) + v);
      }
    }
    if (total <= 0) return [] as Array<{ symbol: string; weightPct: number }>;
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
        return {
          symbol,
          my,
          their,
          overlap: Math.min(my, their),
          delta: my - their,
        };
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [selected, yourWeights]);

  const overlapPct = useMemo(
    () => compRows.reduce((sum, r) => sum + r.overlap, 0),
    [compRows]
  );

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-(--card-border) bg-(--card) p-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Famous Investor Compare</h1>
        <p className="mt-1 text-sm text-(--muted)">
          Pick an investor and compare allocations side-by-side against your portfolio.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
          <label className="text-sm font-medium">Choose investor</label>
          <select
            className="mt-2 w-full rounded-lg border border-(--card-border) bg-transparent px-3 py-2 text-sm"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {FAMOUS_INVESTORS.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          {selected && (
            <div className="mt-4 space-y-3 text-sm">
              <p className="text-(--muted)">{selected.strategy}</p>
              <p className="text-xs text-(--muted)">Updated: {selected.updatedAt}</p>
              <a className="text-xs text-sky-600 hover:underline" href={selected.sourceUrl} target="_blank" rel="noreferrer">
                {selected.sourceLabel}
              </a>
            </div>
          )}
        </aside>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-(--card-border) bg-(--card) p-4">
              <div className="text-xs text-(--muted)">Similarity score</div>
              <div className="mt-1 text-2xl font-semibold">{formatNumber(overlapPct, 1)}%</div>
            </div>
            <div className="rounded-xl border border-(--card-border) bg-(--card) p-4">
              <div className="text-xs text-(--muted)">Your tickers</div>
              <div className="mt-1 text-2xl font-semibold">{yourWeights.length}</div>
            </div>
            <div className="rounded-xl border border-(--card-border) bg-(--card) p-4">
              <div className="text-xs text-(--muted)">Investor top positions</div>
              <div className="mt-1 text-2xl font-semibold">{selected?.holdings.length ?? 0}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
            <h2 className="text-base font-semibold">Top similarities & differences</h2>
            <p className="mb-3 text-xs text-(--muted)">
              Positive delta means you are more overweight than the selected investor.
            </p>
            <div className="space-y-2">
              {loading ? (
                <div className="text-sm text-(--muted)">Loading your portfolio...</div>
              ) : (
                compRows.slice(0, 14).map((r) => (
                  <div key={r.symbol} className="grid grid-cols-[86px_1fr_1fr_82px] items-center gap-2 rounded-lg border border-(--card-border) px-3 py-2 text-sm">
                    <div className="font-semibold">{r.symbol}</div>
                    <div className="text-(--muted)">You: {formatNumber(r.my, 1)}%</div>
                    <div className="text-(--muted)">Investor: {formatNumber(r.their, 1)}%</div>
                    <div className={r.delta >= 0 ? "text-emerald-600" : "text-rose-600"}>
                      {r.delta >= 0 ? "+" : ""}
                      {formatNumber(r.delta, 1)}%
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
