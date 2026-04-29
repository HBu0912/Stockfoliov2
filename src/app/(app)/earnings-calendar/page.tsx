"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type EarningsItem = {
  symbol: string;
  shortName: string;
  earningsDate: string | null;
  reportTimeEt: string | null;
  logoUrl: string | null;
  earningsLink: string;
};

function dateKey(iso: string | null): string {
  if (!iso) return "Date Unavailable";
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function EarningsCalendarPage() {
  const [items, setItems] = useState<EarningsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/earnings/calendar", { cache: "no-store" });
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
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<string, EarningsItem[]>();
    for (const it of items) {
      const k = dateKey(it.earningsDate);
      m.set(k, [...(m.get(k) ?? []), it]);
    }
    return [...m.entries()];
  }, [items]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-(--card-border) bg-(--card) p-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Earnings Calendar</h1>
        <p className="mt-1 text-sm text-(--muted)">
          Companies grouped by earnings date first. This view ignores premarket/aftermarket for now.
        </p>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-(--card-border) bg-(--card) p-4 text-sm text-(--muted)">
          Loading earnings...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-400/50 bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border border-(--card-border) bg-(--card) p-4 text-sm text-(--muted)">
          No earnings found.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, rows]) => (
            <section key={day} className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold">{day}</h2>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((r) => (
                  <a
                    key={`${day}-${r.symbol}-${r.earningsDate ?? "na"}`}
                    href={r.earningsLink}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg border border-(--card-border) px-3 py-2 text-xs hover:bg-(--background)"
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
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
