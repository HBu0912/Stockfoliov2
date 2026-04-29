"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type EarningsItem = {
  symbol: string;
  shortName: string;
  earningsDate: string | null;
  session: "premarket" | "aftermarket" | "time-unknown";
  reportTimeEt: string | null;
  logoUrl: string | null;
  earningsLink: string;
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
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function EarningsCalendarPage() {
  const [items, setItems] = useState<EarningsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => {
    const base = startOfWeekMonday(new Date());
    const out = new Date(base);
    out.setDate(base.getDate() + weekOffset * 7);
    return out;
  }, [weekOffset]);

  const weekdays = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const weekEnd = new Date(weekdays[4]);
        weekEnd.setHours(23, 59, 59, 999);
        const params = new URLSearchParams({
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
        });
        const res = await fetch(`/api/earnings/calendar?${params.toString()}`, { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as { items?: EarningsItem[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setItems([]);
          setError(json.error ?? "Could not load earnings.");
          return;
        }
        setItems(json.items ?? []);
      } catch {
        if (!cancelled) {
          setItems([]);
          setError("Could not load earnings.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [weekStart, weekdays]);

  const grouped = useMemo(() => {
    const byDay = new Map<string, EarningsItem[]>();
    for (const d of weekdays) byDay.set(d.toDateString(), []);
    for (const it of items) {
      if (!it.earningsDate) continue;
      const d = new Date(it.earningsDate);
      const k = d.toDateString();
      if (!byDay.has(k)) continue;
      byDay.set(k, [...(byDay.get(k) ?? []), it]);
    }
    return weekdays.map((day) => {
      const rows = byDay.get(day.toDateString()) ?? [];
      return {
        day,
        premarket: rows.filter((x) => x.session === "premarket"),
        aftermarket: rows.filter((x) => x.session === "aftermarket"),
      };
    });
  }, [items, weekdays]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-(--card-border) bg-(--card) p-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Earnings Calendar</h1>
        <p className="mt-1 text-sm text-(--muted)">
          See upcoming earnings by day, with ticker, logo, and expected report time.
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
            >
              This Week
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

      {loading ? (
        <div className="rounded-2xl border border-(--card-border) bg-(--card) p-4 text-sm text-(--muted)">
          Loading earnings...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-400/50 bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {grouped.map((col) => (
            <section key={col.day.toDateString()} className="rounded-2xl border border-(--card-border) bg-(--card) p-3 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">{dayLabel(col.day)}</h2>

              {[
                { label: "Premarket", rows: col.premarket },
                { label: "Aftermarket", rows: col.aftermarket },
              ].map((group) => (
                <div key={group.label} className="mb-4 last:mb-0">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--muted)">{group.label}</h3>
                  <div className="space-y-2">
                    {group.rows.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-(--card-border) px-2 py-2 text-xs text-(--muted)">None</div>
                    ) : (
                      group.rows.map((r) => (
                        <a
                          key={`${group.label}-${r.symbol}-${r.earningsDate ?? "na"}`}
                          href={r.earningsLink}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-lg border border-(--card-border) px-2 py-2 text-xs hover:bg-(--background)"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              {r.logoUrl ? (
                                <Image
                                  src={r.logoUrl}
                                  alt={`${r.shortName} logo`}
                                  width={16}
                                  height={16}
                                  className="h-4 w-4 rounded-sm"
                                  unoptimized
                                />
                              ) : (
                                <div className="h-4 w-4 rounded-sm bg-(--card-border)" />
                              )}
                              <span className="font-semibold">{r.symbol}</span>
                            </div>
                            <span className="text-(--muted)">{r.reportTimeEt ?? "TBD"}</span>
                          </div>
                          <div className="mt-1 truncate text-(--muted)">{r.shortName}</div>
                        </a>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
