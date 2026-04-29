"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, Treemap } from "recharts";

type IntervalKey = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "5Y" | "ALL";
type ViewKey = "heat" | "bubble";

type Item = {
  symbol: string;
  name: string;
  sector: string;
  marketCap: number;
  changePct: number;
};

type TreemapNode = {
  name: string;
  size: number;
  symbol?: string;
  changePct?: number;
  children?: TreemapNode[];
};

const intervals: IntervalKey[] = ["1D", "1W", "1M", "3M", "YTD", "1Y", "5Y", "ALL"];

function colorForChange(pct: number): string {
  const clamped = Math.max(-10, Math.min(10, pct));
  if (clamped >= 0) {
    const alpha = 0.38 + (clamped / 10) * 0.58;
    return `rgba(22,163,74,${alpha.toFixed(2)})`;
  }
  const alpha = 0.38 + (Math.abs(clamped) / 10) * 0.58;
  return `rgba(220,38,38,${alpha.toFixed(2)})`;
}

function formatPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function HeatTile(props: {
  depth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  symbol?: string;
  changePct?: number;
}) {
  const { depth, x, y, width, height, name, symbol, changePct } = props;
  if (width <= 0 || height <= 0) return null;
  if (depth === 1) {
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill="#0f172a" stroke="#0b1220" strokeWidth={1} />
        <text x={x + 6} y={y + 14} fill="#cbd5e1" fontSize={11} fontWeight={700}>
          {name}
        </text>
      </g>
    );
  }
  const pct = changePct ?? 0;
  const canShowBig = width > 68 && height > 48;
  const canShowSmall = width > 36 && height > 22;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={colorForChange(pct)}
        stroke="#0f172a"
        strokeWidth={1}
      />
      {canShowBig ? (
        <>
          <text x={x + 6} y={y + 16} fill="#f8fafc" fontSize={12} fontWeight={700}>
            {symbol ?? name}
          </text>
          <text x={x + 6} y={y + 31} fill="#e2e8f0" fontSize={11}>
            {formatPct(pct)}
          </text>
        </>
      ) : canShowSmall ? (
        <text x={x + 4} y={y + 14} fill="#f8fafc" fontSize={10} fontWeight={700}>
          {symbol ?? name}
        </text>
      ) : null}
    </g>
  );
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

  const treemapData = useMemo<TreemapNode[]>(() => {
    const bySector = new Map<string, Item[]>();
    for (const item of items) {
      if (!bySector.has(item.sector)) bySector.set(item.sector, []);
      bySector.get(item.sector)!.push(item);
    }
    return [...bySector.entries()]
      .map(([sector, rows]) => ({
        name: sector,
        size: rows.reduce((s, r) => s + r.marketCap, 0),
        children: rows.map((r) => ({
          name: r.name,
          symbol: r.symbol,
          size: r.marketCap,
          changePct: r.changePct,
        })),
      }))
      .sort((a, b) => b.size - a.size);
  }, [items]);

  const bubbleItems = useMemo(() => {
    const src = sectorFilter === "All" ? items : items.filter((x) => x.sector === sectorFilter);
    const top = [...src].sort((a, b) => b.marketCap - a.marketCap).slice(0, 30);
    const maxCap = Math.max(...top.map((x) => x.marketCap), 1);
    return top.map((it, idx) => {
      const size = 26 + Math.sqrt(it.marketCap / maxCap) * 84;
      const y = Math.max(-10, Math.min(10, it.changePct));
      const x = 8 + (idx % 8) * 11 + (idx % 2 ? 2.5 : 0);
      const drift = 6 + (idx % 5) * 1.6;
      const duration = 4.2 + (idx % 7) * 0.6;
      const delay = (idx % 9) * 0.23;
      return { ...it, size, y, x, drift, duration, delay };
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
        <section className="rounded-2xl border border-(--card-border) bg-slate-950 p-2 shadow-sm">
          <div className="h-[720px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={treemapData}
                dataKey="size"
                stroke="#0b1220"
                content={<HeatTile depth={0} x={0} y={0} width={0} height={0} name="" />}
                isAnimationActive
                animationDuration={350}
                ratio={1.2}
              />
            </ResponsiveContainer>
          </div>
        </section>
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
                className="bubble-float absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 text-[10px] font-semibold text-slate-900"
                style={{
                  left: `${b.x}%`,
                  top: `${50 - b.y * 3.6}%`,
                  width: `${b.size}px`,
                  height: `${b.size}px`,
                  background: colorForChange(b.changePct),
                  animationDuration: `${b.duration}s`,
                  animationDelay: `${b.delay}s`,
                  ["--drift-px" as string]: `${b.drift}px`,
                }}
                title={`${b.name} ${formatPct(b.changePct)}`}
              >
                {b.symbol}
              </div>
            ))}
          </div>
        </section>
      )}
      <style jsx>{`
        .bubble-float {
          animation-name: bubbleFloat;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
          will-change: transform;
        }
        @keyframes bubbleFloat {
          0% {
            transform: translate(-50%, -50%) translateY(0px);
          }
          25% {
            transform: translate(-50%, -50%) translateY(calc(var(--drift-px) * -0.7));
          }
          50% {
            transform: translate(-50%, -50%) translateY(calc(var(--drift-px) * -1));
          }
          75% {
            transform: translate(-50%, -50%) translateY(calc(var(--drift-px) * -0.35));
          }
          100% {
            transform: translate(-50%, -50%) translateY(0px);
          }
        }
      `}</style>
    </div>
  );
}
