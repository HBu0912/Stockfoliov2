"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { HoldingPie } from "@/components/HoldingPie";
import { TickerSymbol } from "@/components/TickerSymbol";
import type { Holding } from "@/generated/prisma";
import { formatPctChangeLine } from "@/lib/feed-copy";

type Row = { label: string; name: string; value: number; pct: number };
type Member = { user: { id: string; name: string | null; email: string }; rows: Row[] };
type Feed = {
  id: string;
  userId: string;
  symbol: string;
  title: string;
  kind: string;
  pct: number;
  oldShares: number;
  newShares: number;
  accountName: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
};
type D = {
  arena: {
    id: string;
    name: string;
    joinCode: string;
    createdById: string;
    meId: string;
    isCreator: boolean;
  };
  portfolios: Member[];
  feeds: Feed[];
};

function toPieHoldings(rows: Row[]) {
  return rows.map((r) => ({
    id: r.label,
    symbol: r.label,
    name: r.name,
    shares: r.value,
    lastPrice: 1,
  })) as unknown as Pick<Holding, "id" | "symbol" | "name" | "shares" | "lastPrice">[];
}

function Info({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-(--card-border) text-[10px] text-(--muted)">
      i
      <span className="pointer-events-none absolute left-1/2 top-5 z-20 hidden w-60 -translate-x-1/2 rounded-md border border-(--card-border) bg-(--background) p-2 text-xs text-(--muted) shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  );
}

export default function ArenaDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [data, setData] = useState<D | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [rename, setRename] = useState("");
  const [memberSort, setMemberSort] = useState<"name" | "topPct">("name");
  const [memberSortDir, setMemberSortDir] = useState<"asc" | "desc">("asc");
  const [otherSortDir, setOtherSortDir] = useState<"asc" | "desc">("desc");

  const load = useCallback(async () => {
    setErr(null);
    const r = await fetch(`/api/arenas/${id}`);
    if (!r.ok) return void setErr("Could not open arena (members only)");
    const d = (await r.json()) as D;
    setData(d);
    setRename(d.arena.name);
    setSelectedUserId((cur) => cur || d.portfolios.find((p) => p.user.id !== d.arena.meId)?.user.id || d.arena.meId);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const me = useMemo(() => data?.portfolios.find((p) => p.user.id === data.arena.meId) ?? null, [data]);
  const selected = useMemo(() => data?.portfolios.find((p) => p.user.id === selectedUserId) ?? null, [data, selectedUserId]);
  const selectedFeed = useMemo(() => (selected ? data?.feeds.filter((f) => f.userId === selected.user.id).slice(0, 25) ?? [] : []), [data, selected]);
  const shared = useMemo(() => {
    if (!me || !selected) return [] as string[];
    const mine = new Set(me.rows.map((r) => r.label));
    return selected.rows.filter((r) => mine.has(r.label)).map((r) => r.label).slice(0, 20);
  }, [me, selected]);
  const overlapScore = useMemo(() => {
    if (!me || !selected) return 0;
    const mine = new Set(me.rows.map((r) => r.label));
    const theirs = new Set(selected.rows.map((r) => r.label));
    const common = [...mine].filter((s) => theirs.has(s)).length;
    const total = new Set([...mine, ...theirs]).size || 1;
    return (common / total) * 100;
  }, [me, selected]);
  const sortedMembers = useMemo(() => {
    const list = [...(data?.portfolios ?? [])];
    list.sort((a, b) => {
      if (memberSort === "name") {
        const an = (a.user.name || a.user.email).toLowerCase();
        const bn = (b.user.name || b.user.email).toLowerCase();
        return memberSortDir === "asc" ? an.localeCompare(bn) : bn.localeCompare(an);
      }
      const ap = a.rows[0]?.pct ?? 0;
      const bp = b.rows[0]?.pct ?? 0;
      return memberSortDir === "asc" ? ap - bp : bp - ap;
    });
    return list;
  }, [data?.portfolios, memberSort, memberSortDir]);
  const otherHoldings = useMemo(() => {
    if (!selected) return [] as Row[];
    return [...selected.rows].sort((a, b) =>
      otherSortDir === "asc" ? a.label.localeCompare(b.label) : b.pct - a.pct
    );
  }, [selected, otherSortDir]);
  const diversification = useMemo(() => {
    if (!selected) return 0;
    const top5 = selected.rows.slice(0, 5).reduce((s, r) => s + r.pct, 0);
    return Math.max(0, Math.min(100, 100 - top5 + Math.min(20, selected.rows.length * 2)));
  }, [selected]);

  async function renameArena(e: React.FormEvent) {
    e.preventDefault();
    if (!rename.trim()) return;
    const r = await fetch(`/api/arenas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: rename.trim() }) });
    if (!r.ok) return void setErr("Could not rename arena");
    await load();
  }

  async function deleteArena() {
    if (!confirm("Are you sure you want to delete this arena for all members?")) return;
    const r = await fetch(`/api/arenas/${id}`, { method: "DELETE" });
    if (!r.ok) return void setErr("Could not delete arena");
    router.push("/arena");
  }

  async function removeMember(userId: string) {
    if (!confirm("Are you sure you want to remove this user from the arena?")) return;
    const r = await fetch(`/api/arenas/${id}/members/${userId}`, { method: "DELETE" });
    if (!r.ok) return void setErr("Could not remove user");
    await load();
  }

  if (err && !data) return <div><p className="text-red-600">{err}</p><Link href="/arena" className="text-(--accent)">Back</Link></div>;
  if (!data) return <p className="text-(--muted)">Loading...</p>;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/arena" className="text-sm text-(--accent)">← All arenas</Link>
        <h1 className="mt-1 text-2xl font-semibold">{data.arena.name}</h1>
        <p className="text-(--muted) text-sm">Invite code: <code className="font-mono">{data.arena.joinCode}</code></p>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}

      {data.arena.isCreator && (
        <div className="rounded-xl border border-(--card-border) bg-(--card) p-3">
          <form onSubmit={renameArena} className="flex flex-wrap items-center gap-2">
            <input className="rounded border border-(--card-border) bg-(--background) px-2 py-1.5 text-sm" value={rename} onChange={(e) => setRename(e.target.value)} />
            <button type="submit" className="rounded bg-(--accent) px-3 py-1.5 text-sm text-(--accent-foreground)">Rename</button>
            <button type="button" onClick={() => void deleteArena()} className="rounded border border-red-500/40 px-3 py-1.5 text-sm text-red-500">Delete arena</button>
          </form>
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-4 rounded-xl border border-(--card-border) bg-(--card) p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Members</h2>
            <button
              type="button"
              onClick={() => {
                setMemberSort((s) => (s === "name" ? "topPct" : "name"));
                setMemberSortDir((d) => (d === "asc" ? "desc" : "asc"));
              }}
              className="text-xs text-(--muted)"
            >
              Sort
            </button>
          </div>
          <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {sortedMembers.map((p) => {
            const who = p.user.name || p.user.email.split("@")[0];
            const active = p.user.id === selectedUserId;
            return (
              <li key={p.user.id} className={"rounded-2xl border p-3 " + (active ? "border-(--accent) bg-(--background)" : "border-(--card-border) bg-(--card)")}>
                <button type="button" onClick={() => setSelectedUserId(p.user.id)} className="w-full text-left">
                  <p className="font-medium">{who}</p>
                </button>
                {data.arena.isCreator && p.user.id !== data.arena.meId && (
                  <button type="button" onClick={() => void removeMember(p.user.id)} className="mt-2 rounded border border-red-500/35 px-2 py-1 text-xs text-red-500">Remove user</button>
                )}
              </li>
            );
          })}
          </ul>
        </div>
        <div className="xl:col-span-8 rounded-xl border border-(--card-border) bg-(--card) p-3">
          <h2 className="text-lg font-semibold">Leaderboard</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 shadow-sm">
              <p className="text-sm font-medium">Most diversified</p>
              <p className="text-xs text-(--muted mt-1)">{sortedMembers.slice().sort((a,b)=>b.rows.length-a.rows.length)[0]?.user.name || sortedMembers.slice().sort((a,b)=>b.rows.length-a.rows.length)[0]?.user.email || "—"}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 shadow-sm">
              <p className="text-sm font-medium">{data.arena.name} Top Picks</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {Array.from(new Set(data.portfolios.flatMap((p) => p.rows.slice(0, 3).map((r) => r.label))))
                  .slice(0, 5)
                  .map((ticker) => (
                    <TickerSymbol
                      key={ticker}
                      symbol={ticker}
                      className="rounded border border-(--card-border) px-1.5 py-0.5 text-xs font-mono text-(--muted) underline-offset-2 hover:underline"
                    />
                  ))}
              </div>
            </div>
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 shadow-sm md:col-span-2">
              <p className="text-sm font-medium">Outlier Bets</p>
              <p className="mt-1 text-xs text-(--muted)">
                {(() => {
                  const all = data.portfolios.flatMap((p) => p.rows.filter((r) => r.pct >= 10).map((r) => ({ user: p.user, row: r })));
                  if (!all.length) return "No strong outlier bets above 10% yet.";
                  const pick = all.sort((a, b) => b.row.pct - a.row.pct)[0];
                  return `${pick.user.name || pick.user.email.split("@")[0]}: ${pick.row.label} at ${pick.row.pct.toFixed(1)}%`;
                })()}
              </p>
            </div>
          </div>
        </div>
      </section>

      {selected && me && (
        <section className="space-y-4 rounded-2xl border border-(--card-border) bg-(--card) p-4">
          <h2 className="text-xl font-semibold">Compare with {selected.user.name || selected.user.email.split("@")[0]}</h2>
          <div className="grid items-stretch gap-4 xl:grid-cols-12">
            <div className="xl:col-span-9 rounded-xl border border-(--card-border) bg-(--background) p-3 min-h-[520px]">
              <div className="grid h-full gap-4 lg:grid-cols-[1fr_auto_1fr]">
                <div>
                  <h3 className="text-sm font-medium text-(--muted)">Your portfolio % mix</h3>
                  <HoldingPie holdings={toPieHoldings(me.rows)} height={430} showDollar={false} />
                </div>
                <div className="mx-auto hidden h-[430px] w-px bg-(--card-border) lg:block" />
                <div>
                  <h3 className="text-sm font-medium text-(--muted)">{selected.user.name || selected.user.email.split("@")[0]} portfolio % mix</h3>
                  <HoldingPie holdings={toPieHoldings(selected.rows)} height={430} showDollar={false} />
                </div>
              </div>
            </div>

            <div className="xl:col-span-3 rounded-xl border border-(--card-border) bg-(--background) p-3 min-h-[520px]">
              <h3 className="text-lg font-medium">Arena investing feed</h3>
              <div className="mt-2 max-h-[450px] space-y-2 overflow-y-auto pr-1">
                {selectedFeed.length === 0 ? (
                  <p className="text-sm text-(--muted)">No recent updates.</p>
                ) : (
                  selectedFeed.map((f) => (
                    <div key={f.id} className="rounded-lg border border-(--card-border) bg-(--card) px-2 py-1.5 text-xs">
                      {formatPctChangeLine({
                        userLabel: f.user.name || f.user.email.split("@")[0],
                        symbol: f.symbol,
                        title: f.title,
                        kind: f.kind,
                        pct: f.pct,
                        oldShares: f.oldShares,
                        newShares: f.newShares,
                        at: f.createdAt,
                        accountName: undefined,
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center shadow-sm">
              <h4 className="font-medium text-emerald-200">Shared tickers</h4>
              {shared.length === 0 ? (
                <p className="mt-2 text-sm text-(--muted)">None yet.</p>
              ) : (
                <div className="mt-2 flex flex-wrap justify-center gap-2 text-sm font-mono">
                  {shared.map((ticker) => (
                    <TickerSymbol
                      key={ticker}
                      symbol={ticker}
                      className="rounded border border-(--card-border) px-2 py-0.5 underline-offset-2 hover:underline"
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-center shadow-sm">
              <h4 className="inline-flex items-center justify-center gap-1 font-medium text-sky-200">
                Diversification score
                <Info text="Score uses concentration of top 5 tickers and total ticker count. Higher score means less concentration." />
              </h4>
              <p className="mt-2 text-2xl font-semibold">{diversification.toFixed(0)} / 100</p>
            </div>
            <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4 text-center shadow-sm">
              <h4 className="inline-flex items-center justify-center gap-1 font-medium text-violet-200">
                Holdings overlap score
                <Info text="Jaccard-style overlap: shared tickers divided by total unique tickers across both portfolios." />
              </h4>
              <p className="mt-2 text-2xl font-semibold">{overlapScore.toFixed(0)}%</p>
            </div>
          </div>
          <div className="rounded-xl border border-(--card-border) bg-(--background) p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-medium">Their Holdings</h4>
              <button type="button" onClick={() => setOtherSortDir((d) => (d === "asc" ? "desc" : "asc"))} className="text-xs text-(--muted)">
                {otherSortDir === "asc" ? "A-Z" : "Greatest %"}
              </button>
            </div>
            <ul className="max-h-[280px] space-y-1 overflow-y-auto pr-1 text-sm">
              {otherHoldings.slice(0, 50).map((r) => (
                <li key={r.label} className="flex justify-between border-b border-(--card-border)/50 py-1">
                  <TickerSymbol symbol={r.label} className="font-mono underline-offset-2 hover:underline" />
                  <span>{r.pct.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
