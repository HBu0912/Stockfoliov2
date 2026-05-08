"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CalendarItem = {
  symbol: string;
  name: string;
  earningsDate: string;
  reportTime: "Morning" | "Night" | "N/A";
  marketCap: string | null;
  epsForecast: string | null;
};

type CalendarMeta = {
  date: string;
  scannedDates: number;
  failedDates: number;
  returned: number;
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

type ActualMap = Record<
  string,
  { status: "beat" | "miss" | "unknown"; actual: number | null; estimate: number | null }
>;

function toDateParam(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIsoDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatDateLabel(dateStr: string): string {
  const d = parseIsoDateLocal(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CalendarPage() {
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [meta, setMeta] = useState<CalendarMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => toDateParam(new Date()));
  const [actualBySymbol, setActualBySymbol] = useState<ActualMap>({});
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setActualBySymbol({});
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        const res = await fetch(`/api/calendar?date=${encodeURIComponent(selectedDate)}&offset=0&limit=20`, {
          cache: "no-store",
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));
        const json = (await res.json().catch(() => ({}))) as {
          items?: CalendarItem[];
          meta?: CalendarMeta;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setItems([]);
          setMeta(null);
          setError(json.error ?? "Could not load calendar.");
          return;
        }
        setItems(json.items ?? []);
        setMeta(json.meta ?? null);
      } catch {
        if (!cancelled) {
          setItems([]);
          setMeta(null);
          setError("Calendar request timed out. Please refresh to try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const isPastDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return parseIsoDateLocal(selectedDate).getTime() < today.getTime();
  }, [selectedDate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isPastDate || items.length === 0) {
        setActualBySymbol({});
        return;
      }
      const symbols = [...new Set(items.map((i) => i.symbol))];
      try {
        const res = await fetch("/api/calendar/beat-status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ symbols }),
        });
        const json = (await res.json().catch(() => ({}))) as { statuses?: ActualMap };
        if (!cancelled && res.ok) setActualBySymbol(json.statuses ?? {});
      } catch {
        if (!cancelled) setActualBySymbol({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items, isPastDate]);

  function shiftDay(delta: number) {
    const base = parseIsoDateLocal(selectedDate);
    base.setDate(base.getDate() + delta);
    setSelectedDate(toDateParam(base));
  }

  async function loadMore() {
    if (!meta?.hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextOffset = items.length;
      const res = await fetch(
        `/api/calendar?date=${encodeURIComponent(selectedDate)}&offset=${nextOffset}&limit=20`,
        { cache: "no-store" }
      );
      const json = (await res.json().catch(() => ({}))) as {
        items?: CalendarItem[];
        meta?: CalendarMeta;
      };
      if (!res.ok) return;
      setItems((prev) => [...prev, ...(json.items ?? [])]);
      if (json.meta) setMeta(json.meta);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-cyan-400/40 bg-gradient-to-br from-slate-900/95 to-indigo-900/70 p-5 shadow-lg shadow-cyan-700/25">
        <h1 className="bg-linear-to-r from-cyan-200 via-sky-200 to-violet-200 bg-clip-text text-2xl font-semibold tracking-tight text-transparent">Calendar</h1>
        <p className="mt-1 text-sm text-slate-200">Select a date to view earnings list.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => dateInputRef.current?.showPicker?.()}
            className="rounded-md border border-cyan-400/35 bg-cyan-500/10 px-3 py-1.5 text-sm hover:bg-cyan-500/20"
            aria-label="Open calendar"
          >
            📅
          </button>
          <button
            type="button"
            onClick={() => shiftDay(-1)}
            className="rounded-md border border-violet-400/35 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-100 hover:bg-violet-500/20"
          >
            Yesterday
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-md border border-cyan-400/30 bg-slate-900/80 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => shiftDay(1)}
            className="rounded-md border border-violet-400/35 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-100 hover:bg-violet-500/20"
          >
            Tomorrow
          </button>
        </div>
        {meta ? (
          <p className="mt-2 text-xs text-(--muted)">
            Showing {formatDateLabel(meta.date)} • {items.length} / {meta.total} tickers
          </p>
        ) : null}
      </section>

      {loading ? (
        <div className="rounded-2xl border border-sky-400/35 bg-gradient-to-br from-slate-900/90 to-slate-800/75 p-4 text-sm text-slate-300">
          Loading calendar...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-400/50 bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-sky-400/35 bg-gradient-to-br from-slate-900/90 to-slate-800/75 p-4 text-sm text-slate-300">
          No earnings found.
        </div>
      ) : (
        <div className="rounded-2xl border border-violet-400/35 bg-gradient-to-br from-slate-900/90 to-indigo-900/65 p-3 shadow-lg shadow-violet-700/20">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-(--card-border) text-left text-xs uppercase tracking-wide text-(--muted)">
                  <th className="px-2 py-2">Ticker</th>
                  <th className="px-2 py-2">Company Name</th>
                  <th className="px-2 py-2">Time</th>
                  <th className="px-2 py-2">Market Cap</th>
                  <th className="px-2 py-2">Est</th>
                  {isPastDate ? <th className="px-2 py-2">Actual</th> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const actual = actualBySymbol[row.symbol];
                  const estValue = row.epsForecast == null ? null : Number(String(row.epsForecast).replace(/[^0-9.-]/g, ""));
                  const est = Number.isFinite(estValue) ? estValue : null;
                  const actualClass =
                    actual?.actual != null && est != null && actual.actual > est
                      ? "text-emerald-500"
                      : actual?.actual != null && est != null
                        ? "text-rose-500"
                        : "";
                  return (
                  <tr key={`${row.earningsDate}-${row.symbol}`} className="border-b border-(--card-border)/70 last:border-b-0">
                    <td className="px-2 py-2 font-semibold">{row.symbol}</td>
                    <td className="px-2 py-2 text-(--muted)">{row.name}</td>
                    <td className="px-2 py-2">
                      {row.reportTime === "Morning" ? "☀️" : row.reportTime === "Night" ? "🌑" : "N/A"}
                    </td>
                    <td className="px-2 py-2">{row.marketCap ?? "N/A"}</td>
                    <td className="px-2 py-2">{row.epsForecast ?? "N/A"}</td>
                    {isPastDate ? (
                      <td className={`px-2 py-2 font-medium ${actualClass}`}>
                        {actual?.actual != null ? actual.actual.toFixed(2) : "N/A"}
                      </td>
                    ) : null}
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
          {meta?.hasMore ? (
            <div className="pt-3">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="rounded-md border border-(--card-border) px-3 py-1.5 text-xs text-(--muted) hover:bg-(--background) disabled:opacity-60"
              >
                {loadingMore ? "Loading..." : "Load More (+20)"}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
