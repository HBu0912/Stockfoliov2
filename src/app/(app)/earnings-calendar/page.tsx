"use client";

import { formatNumber } from "@/lib/money";
import { useEffect, useMemo, useState } from "react";

type Item = {
  symbol: string;
  shortName: string;
  earningsDate: string | null;
  session: "premarket" | "aftermarket" | "time-unknown";
  website: string | null;
  earningsLink: string;
  epsEstimate: number | null;
  epsActual: number | null;
  epsBeat: boolean | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  revenueBeat: boolean | null;
};

function dateKey(v: string | null) {
  if (!v) return "No date";
  return new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function EarningsCalendarPage() {
  const [symbolsInput, setSymbolsInput] = useState("AAPL,MSFT,NVDA,AMZN,GOOGL,META,TSLA,JPM,NFLX,AVGO");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/earnings/calendar?symbols=${encodeURIComponent(symbolsInput)}`, { cache: "no-store" });
      const json = (await res.json()) as { items?: Item[] };
      setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/earnings/calendar?symbols=${encodeURIComponent(symbolsInput)}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as { items?: Item[] };
        if (!cancelled) setItems(json.items ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of items) {
      const key = dateKey(it.earningsDate);
      map.set(key, [...(map.get(key) ?? []), it]);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-(--card-border) bg-(--card) p-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Earnings Calendar</h1>
        <p className="mt-1 text-sm text-(--muted)">
          Clear daily earnings view with premarket and aftermarket grouping, plus beat/miss checks.
        </p>
      </section>

      <section className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <label className="flex-1">
            <span className="mb-1 block text-sm text-(--muted)">Symbols (comma separated)</span>
            <input
              className="w-full rounded-lg border border-(--card-border) bg-transparent px-3 py-2 text-sm"
              value={symbolsInput}
              onChange={(e) => setSymbolsInput(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            Refresh
          </button>
        </form>
      </section>

      {loading ? (
        <div className="text-sm text-(--muted)">Loading earnings calendar...</div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, dayItems]) => {
            const pre = dayItems.filter((x) => x.session === "premarket");
            const post = dayItems.filter((x) => x.session === "aftermarket");
            const unknown = dayItems.filter((x) => x.session === "time-unknown");
            return (
              <section key={day} className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
                <h2 className="mb-3 text-lg font-semibold">{day}</h2>

                {[
                  { label: "Premarket", rows: pre },
                  { label: "Aftermarket", rows: post },
                  { label: "Time Not Listed", rows: unknown },
                ].map((g) => (
                  <div key={g.label} className="mb-4 last:mb-0">
                    <h3 className="mb-2 text-sm font-semibold text-(--muted)">{g.label}</h3>
                    <div className="space-y-2">
                      {g.rows.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-(--card-border) px-3 py-2 text-xs text-(--muted)">
                          No companies listed.
                        </div>
                      ) : (
                        g.rows.map((r) => (
                          <div key={`${day}-${g.label}-${r.symbol}`} className="grid gap-2 rounded-lg border border-(--card-border) px-3 py-2 text-sm lg:grid-cols-[80px_minmax(0,1.2fr)_1fr_1fr_220px]">
                            <div className="font-semibold">{r.symbol}</div>
                            <div className="truncate text-(--muted)">{r.shortName}</div>
                            <div>
                              EPS: {formatNumber(r.epsActual, 2)} / {formatNumber(r.epsEstimate, 2)}{" "}
                              <span className={r.epsBeat == null ? "text-(--muted)" : r.epsBeat ? "text-emerald-600" : "text-rose-600"}>
                                {r.epsBeat == null ? "N/A" : r.epsBeat ? "Beat" : "Miss"}
                              </span>
                            </div>
                            <div>
                              Rev: {formatNumber(r.revenueActual, 0)} / {formatNumber(r.revenueEstimate, 0)}{" "}
                              <span className={r.revenueBeat == null ? "text-(--muted)" : r.revenueBeat ? "text-emerald-600" : "text-rose-600"}>
                                {r.revenueBeat == null ? "N/A" : r.revenueBeat ? "Beat" : "Miss"}
                              </span>
                            </div>
                            <div className="flex gap-3 text-xs">
                              <a className="text-sky-600 hover:underline" href={r.earningsLink} target="_blank" rel="noreferrer">
                                Yahoo Earnings
                              </a>
                              {r.website ? (
                                <a className="text-sky-600 hover:underline" href={r.website} target="_blank" rel="noreferrer">
                                  Company Site
                                </a>
                              ) : (
                                <span className="text-(--muted)">No site</span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
