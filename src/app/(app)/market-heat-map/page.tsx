"use client";

import { useEffect, useMemo, useState } from "react";

type IntervalKey = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "5Y" | "ALL";
type ViewKey = "heat" | "bubble";

type Item = {
  symbol: string;
  name: string;
  sector: string;
  marketCap: number;
  changePct: number;
};

const intervals: IntervalKey[] = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y", "ALL"];

function colorForChange(pct: number): string {
  const clamped = Math.max(-8, Math.min(8, pct));
  if (clamped >= 0) {
    const alpha = 0.22 + (clamped / 8) * 0.55;
    return `rgba(16,185,129,${alpha.toFixed(2)})`;
  }
  const alpha = 0.22 + (Math.abs(clamped) / 8) * 0.55;
  return `rgba(239,68,68,${alpha.toFixed(2)})`;
}

function formatPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export default function MarketHeatMapPage() {
  const [interval, setInterval] = useState<IntervalKey>("1D");
  const [view, setView] = useState<ViewKey>("heat");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectorFilter, setSectorFilter] = useState<string>("All");

  function changeInterval(next: IntervalKey) {
    if (next === interval) return;
    setLoading(true);
    setInterval(next);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/market-heat-map?interval=${interval}`, { cache: "no-store" });
        const json = (await res.json()) as { items?: Item[] };
        if (!cancelled) setItems(json.items ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [interval]);

  const sectors = useMemo(
    () => ["All", ...new Set(items.map((x) => x.sector).sort((a, b) => a.localeCompare(b)))],
    [items]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of items) {
      if (!map.has(it.sector)) map.set(it.sector, []);
      map.get(it.sector)!.push(it);
    }
    for (const [k, arr] of map) {
      arr.sort((a, b) => b.marketCap - a.marketCap);
      map.set(k, arr);
    }
    return [...map.entries()].sort((a, b) => b[1].reduce((s, x) => s + x.marketCap, 0) - a[1].reduce((s, x) => s + x.marketCap, 0));
  }, [items]);

  const bubbleItems = useMemo(() => {
    const src = sectorFilter === "All" ? items : items.filter((x) => x.sector === sectorFilter);
    const top = [...src].sort((a, b) => b.marketCap - a.marketCap).slice(0, 30);
    const maxCap = Math.max(...top.map((x) => x.marketCap), 1);
    return top.map((it, idx) => {
      const size = 24 + Math.sqrt(it.marketCap / maxCap) * 76;
      const y = Math.max(-10, Math.min(10, it.changePct));
      const x = 6 + (idx % 8) * 12 + (idx % 2 ? 3 : 0);
      return { ...it, size, y, x };
    });
  }, [items, sectorFilter]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-(--card-border) bg-(--card) p-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Market Heat Map</h1>
        <p className="mt-1 text-sm text-(--muted)">
          Sector-based market map sized by market cap with a bubble-map mode around the 0% line.
        </p>
      </section>

      <section className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1">
            {intervals.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => changeInterval(k)}
                className={
                  "rounded-md px-2 py-1 text-xs " +
                  (interval === k
                    ? "bg-(--accent) text-(--accent-foreground)"
                    : "border border-(--card-border) hover:bg-(--background)")
                }
              >
                {k}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-lg border border-(--card-border) p-1 text-xs">
            <button
              type="button"
              onClick={() => setView("heat")}
              className={"rounded-md px-2 py-1 " + (view === "heat" ? "bg-(--accent) text-(--accent-foreground)" : "")}
            >
              Heat Map
            </button>
            <button
              type="button"
              onClick={() => setView("bubble")}
              className={"rounded-md px-2 py-1 " + (view === "bubble" ? "bg-(--accent) text-(--accent-foreground)" : "")}
            >
              Bubble Map
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-(--card-border) bg-(--card) p-6 text-sm text-(--muted)">Loading map data...</div>
      ) : view === "heat" ? (
        <div className="space-y-4">
          {grouped.map(([sector, rows]) => {
            const total = rows.reduce((s, r) => s + r.marketCap, 0);
            return (
              <section key={sector} className="rounded-2xl border border-(--card-border) bg-(--card) p-3 shadow-sm">
                <h2 className="mb-2 text-sm font-semibold">{sector}</h2>
                <div className="grid auto-rows-[64px] grid-cols-12 gap-2">
                  {rows.map((r) => {
                    const span = Math.max(2, Math.min(6, Math.round((r.marketCap / total) * 40)));
                    return (
                      <div
                        key={r.symbol}
                        className="flex min-w-0 flex-col justify-between rounded-md border border-black/10 p-2 text-xs text-slate-950"
                        style={{ gridColumn: `span ${span}`, background: colorForChange(r.changePct) }}
                        title={`${r.name} ${formatPct(r.changePct)}`}
                      >
                        <div className="truncate font-bold">{r.symbol}</div>
                        <div className="truncate">{formatPct(r.changePct)}</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm text-(--muted)">Bubble size = market cap, vertical position = % change vs 0% line.</p>
            <select
              className="rounded-md border border-(--card-border) bg-transparent px-2 py-1 text-xs"
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
            >
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="relative h-[520px] rounded-xl border border-(--card-border) bg-(--background)">
            <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-(--card-border)" />
            <div className="absolute right-2 top-[calc(50%-10px)] text-[10px] text-(--muted)">0%</div>
            {bubbleItems.map((b) => (
              <div
                key={b.symbol}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 text-[10px] font-semibold text-slate-900"
                style={{
                  left: `${b.x}%`,
                  top: `${50 - b.y * 3.6}%`,
                  width: `${b.size}px`,
                  height: `${b.size}px`,
                  background: colorForChange(b.changePct),
                }}
                title={`${b.name} ${formatPct(b.changePct)}`}
              >
                {b.symbol}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
