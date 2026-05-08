"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const RATING_LABELS = ["Strong Sell", "Sell", "Hold", "Buy", "Strong Buy"] as const;

type Tallies = Record<1 | 2 | 3 | 4 | 5, number>;
type SymPack = { tallies: Tallies; myVote: number | null; voters: Array<{ userId: string; name: string; rating: number }> };

const ZERO_TALLIES: Tallies = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function nextAfter(queue: string[], sym: string): string {
  if (!queue.length) return sym;
  const i = queue.indexOf(sym);
  if (i < 0) return queue[0]!;
  return queue[(i + 1) % queue.length]!;
}

const RATING_FILL: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "bg-rose-500/35",
  2: "bg-orange-500/35",
  3: "bg-slate-400/30",
  4: "bg-cyan-500/35",
  5: "bg-emerald-500/35",
};

export function ArenaConvictionPanel({
  arenaId,
  tickers,
  externalSymbol,
  onExternalSymbolConsumed,
  embedded = false,
}: {
  arenaId: string;
  tickers: string[];
  externalSymbol: string | null;
  onExternalSymbolConsumed?: () => void;
  embedded?: boolean;
}) {
  const [bySymbol, setBySymbol] = useState<Record<string, SymPack>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeSymbol, setActiveSymbol] = useState("");
  const [phase, setPhase] = useState<"vote" | "results">("vote");
  const queueRef = useRef<string[]>([]);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const r = await fetch(`/api/arenas/${arenaId}/votes`);
      const d = (await r.json()) as { bySymbol?: Record<string, SymPack>; error?: string };
      if (!r.ok) throw new Error(d.error ?? "Could not load votes");
      setBySymbol(d.bySymbol ?? {});
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not load votes");
    } finally {
      setLoading(false);
    }
  }, [arenaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const symbolList = useMemo(() => {
    const u = new Set<string>();
    for (const t of tickers) u.add(t.trim().toUpperCase());
    for (const k of Object.keys(bySymbol)) u.add(k);
    return [...u].sort((a, b) => a.localeCompare(b));
  }, [tickers, bySymbol]);

  /** Stable when the ticker *universe* is unchanged; do not depend on `symbolList` reference or tally-only `bySymbol` updates. */
  const queueKey = symbolList.join(",");
  useEffect(() => {
    if (!queueKey) {
      queueRef.current = [];
      setActiveSymbol("");
      return;
    }
    const list = queueKey.split(",");
    queueRef.current = shuffle(list);
    setActiveSymbol((cur) => (cur && list.includes(cur) ? cur : queueRef.current[0]!));
    setPhase("vote");
  }, [queueKey]);

  useEffect(() => {
    if (!externalSymbol) return;
    const sym = externalSymbol.trim().toUpperCase();
    if (/^[A-Z][A-Z0-9.\-]{0,14}$/.test(sym)) {
      setActiveSymbol(sym);
      if (!queueRef.current.includes(sym)) queueRef.current = [sym, ...queueRef.current];
      setPhase("vote");
    }
    onExternalSymbolConsumed?.();
  }, [externalSymbol, onExternalSymbolConsumed]);

  const pack = activeSymbol ? bySymbol[activeSymbol] : undefined;
  const tallies = pack?.tallies ?? ZERO_TALLIES;
  const totalVotes = (Object.values(tallies) as number[]).reduce((a, b) => a + b, 0);

  async function submitRating(rating: number) {
    if (!activeSymbol) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/arenas/${arenaId}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: activeSymbol, rating }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Could not save vote");
      await load();
      setPhase("results");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Could not save vote");
    } finally {
      setSaving(false);
    }
  }

  function goNextTicker() {
    if (!activeSymbol) return;
    const q = queueRef.current.length ? queueRef.current : [activeSymbol];
    const next = nextAfter(q, activeSymbol);
    setActiveSymbol(next);
    setPhase("vote");
  }

  const shell = embedded ? "flex min-h-0 flex-1 flex-col gap-2" : "rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm";

  return (
    <div className={shell}>
      {!embedded ? (
        <div>
          <h3 className="text-lg font-semibold">Conviction votes</h3>
          <p className="mt-0.5 text-xs text-(--muted)">Vote, review the arena tally, then go to the next ticker.</p>
        </div>
      ) : null}

      {err ? <p className="shrink-0 text-xs text-red-500">{err}</p> : null}
      {loading && !Object.keys(bySymbol).length ? <p className="shrink-0 text-sm text-(--muted)">Loading votes…</p> : null}

      <label className="flex shrink-0 flex-col gap-1 text-[11px] text-(--muted)">
        Ticker
        <select
          value={activeSymbol && symbolList.includes(activeSymbol) ? activeSymbol : ""}
          onChange={(e) => {
            const v = e.target.value;
            setPhase("vote");
            setActiveSymbol(v);
            if (v && !queueRef.current.includes(v)) queueRef.current = [v, ...queueRef.current];
          }}
          className="rounded-lg border border-(--card-border) bg-(--background) px-2 py-2 text-sm font-mono"
        >
          {symbolList.length === 0 ? <option value="">—</option> : null}
          {symbolList.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-(--card-border) bg-(--background) p-3">
          {!activeSymbol || !symbolList.length ? (
            <p className="py-8 text-center text-sm text-(--muted)">Add arena holdings to unlock conviction flash cards.</p>
          ) : phase === "vote" ? (
            <div className="flex min-h-full flex-col justify-center gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-(--muted)">How does the arena feel about</p>
              <p className="text-4xl font-bold tracking-tight text-foreground drop-shadow-sm sm:text-5xl">{activeSymbol}</p>
              <p className="max-w-xs text-xs text-(--muted)">Choose one rating to submit your vote.</p>
              <div className="space-y-2">
                {([1, 2, 3, 4, 5] as const).map((r) => {
                  const tone =
                    r === 1
                      ? "border-rose-500/50 bg-rose-500/10 text-rose-100"
                      : r === 2
                        ? "border-orange-500/45 bg-orange-500/10 text-orange-100"
                        : r === 3
                          ? "border-slate-500/45 bg-slate-500/10 text-slate-100"
                          : r === 4
                            ? "border-cyan-500/45 bg-cyan-500/10 text-cyan-100"
                            : "border-emerald-500/45 bg-emerald-500/10 text-emerald-100";
                  const share = totalVotes > 0 ? (tallies[r] / totalVotes) * 100 : 0;
                  return (
                    <button
                      key={r}
                      type="button"
                      disabled={saving}
                      onClick={() => void submitRating(r)}
                      className={
                        "relative flex w-full items-center justify-between overflow-hidden rounded-lg border px-3 py-2.5 text-left text-[11px] font-semibold transition hover:brightness-110 disabled:opacity-50 " +
                        tone
                      }
                    >
                      {totalVotes > 0 ? (
                        <span
                          className={"pointer-events-none absolute inset-y-0 left-0 " + RATING_FILL[r]}
                          style={{ width: `${share}%` }}
                          aria-hidden
                        />
                      ) : null}
                      <span className="relative z-10">{RATING_LABELS[r - 1]}</span>
                      <span className="relative z-10 text-[10px] opacity-80">
                        {tallies[r]} ({totalVotes > 0 ? `${share.toFixed(0)}%` : "0%"})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pb-1">
              <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-emerald-200/90">Arena tally · {activeSymbol}</p>
              <div className="space-y-2">
                {([1, 2, 3, 4, 5] as const).map((r) => {
                  const count = tallies[r];
                  const width = totalVotes > 0 ? Math.max((count / totalVotes) * 100, count > 0 ? 4 : 0) : 0;
                  const bg =
                    r === 1
                      ? "#f43f5e"
                      : r === 2
                        ? "#fb923c"
                        : r === 3
                          ? "#94a3b8"
                          : r === 4
                            ? "#22d3ee"
                            : "#34d399";
                  return (
                    <div key={r} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span>{RATING_LABELS[r - 1]}</span>
                        <span className="text-(--muted)">
                          {count} vote{count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded bg-(--card)">
                        <div className="h-full rounded" style={{ width: `${width}%`, backgroundColor: bg }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[11px] font-semibold text-(--muted)">
                Total votes: <span className="text-foreground">{totalVotes}</span>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-(--muted)">Votes</p>
                <ul className="max-h-36 space-y-1 overflow-y-auto pr-1 text-left text-xs">
                  {(pack?.voters ?? []).length === 0 ? (
                    <li className="text-(--muted)">No votes yet.</li>
                  ) : (
                    (pack?.voters ?? []).map((v) => (
                      <li key={v.userId} className="flex justify-between gap-2 rounded-md border border-(--card-border)/50 bg-(--card) px-2 py-1">
                        <span className="truncate">{v.name}</span>
                        <span className="shrink-0 font-mono text-[11px] text-(--muted)">{RATING_LABELS[v.rating - 1]}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>

        {phase === "results" && activeSymbol && symbolList.length > 0 ? (
          <div className="relative z-20 flex shrink-0 justify-end border-t border-(--card-border) pt-2">
            <button
              type="button"
              onClick={goNextTicker}
              className="rounded-md bg-(--accent) px-4 py-2 text-xs font-semibold text-(--accent-foreground) shadow-sm"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
