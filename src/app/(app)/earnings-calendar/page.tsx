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

function startOfWeekMonday(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const day = out.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  out.setDate(out.getDate() + diff);
  return out;
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export default function EarningsCalendarPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/earnings/calendar", { cache: "no-store" });
        const json = (await res.json()) as { items?: Item[] };
        if (!cancelled) setItems(json.items ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const weekStart = useMemo(() => {
    const base = startOfWeekMonday(new Date());
    const shifted = new Date(base);
    shifted.setDate(base.getDate() + weekOffset * 7);
    return shifted;
  }, [weekOffset]);

  const weekdays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      return day;
    });
  }, [weekStart]);

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const day of weekdays) {
      map.set(day.toDateString(), []);
    }
    for (const it of items) {
      if (!it.earningsDate) continue;
      const dt = new Date(it.earningsDate);
      if (dt < weekdays[0] || dt > new Date(weekdays[4].getTime() + 24 * 60 * 60 * 1000 - 1)) continue;
      const k = startOfWeekMonday(dt);
      const idx = Math.floor((dt.getTime() - k.getTime()) / (24 * 60 * 60 * 1000));
      if (idx < 0 || idx > 4) continue;
      const matchDay = new Date(k);
      matchDay.setDate(k.getDate() + idx);
      const key = matchDay.toDateString();
      map.set(key, [...(map.get(key) ?? []), it]);
    }
    return [...map.entries()];
  }, [items, weekdays]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-(--card-border) bg-(--card) p-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Earnings Calendar</h1>
        <p className="mt-1 text-sm text-(--muted)">
          Week-by-week earnings view grouped by weekday, premarket, and aftermarket.
        </p>
      </section>

      <section className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-(--muted)">
            {weekdays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} -{" "}
            {weekdays[4].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w - 1)}
              className="rounded-lg border border-(--card-border) px-3 py-1.5 text-sm hover:bg-(--card)"
            >
              Prev Week
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="rounded-lg border border-(--card-border) px-3 py-1.5 text-sm hover:bg-(--card)"
              title="Calendar: jump to current week"
            >
              📅 This Week
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w + 1)}
              className="rounded-lg border border-(--card-border) px-3 py-1.5 text-sm hover:bg-(--card)"
            >
              Next Week
            </button>
          </div>
        </div>
      </section>
      <section className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
        <div className="text-sm text-(--muted)">
          Earnings are auto-loaded for this week. Use the calendar week toggle above to browse other weeks.
        </div>
      </section>

      {loading ? (
        <div className="text-sm text-(--muted)">Loading earnings calendar...</div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([dayKey, dayItems], idx) => {
            const day = weekdays[idx];
            const pre = dayItems.filter((x) => x.session === "premarket");
            const post = dayItems.filter((x) => x.session === "aftermarket");
            const unknown = dayItems.filter((x) => x.session === "time-unknown");
            return (
              <section key={dayKey} className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
                <h2 className="mb-3 text-lg font-semibold">{dayLabel(day)}</h2>

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
                          <div key={`${dayKey}-${g.label}-${r.symbol}`} className="grid gap-2 rounded-lg border border-(--card-border) px-3 py-2 text-sm lg:grid-cols-[80px_minmax(0,1.2fr)_1fr_1fr_220px]">
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
