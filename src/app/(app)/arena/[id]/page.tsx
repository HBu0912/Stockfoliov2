"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { HoldingPie } from "@/components/HoldingPie";
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
  return rows.slice(0, 6).map((r) => ({
    id: r.label,
    symbol: r.label,
    name: r.name,
    shares: r.pct,
    lastPrice: 1,
  })) as unknown as Pick<Holding, "id" | "symbol" | "name" | "shares" | "lastPrice">[];
}

export default function ArenaDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [data, setData] = useState<D | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [rename, setRename] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    const r = await fetch(`/api/arenas/${id}`);
    if (!r.ok) {
      setErr("Could not open arena (members only)");
      return;
    }
    const d = (await r.json()) as D;
    setData(d);
    setRename(d.arena.name);
    setSelectedUserId((cur) => cur || d.portfolios.find((p) => p.user.id !== d.arena.meId)?.user.id || d.arena.meId);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const me = useMemo(
    () => data?.portfolios.find((p) => p.user.id === data.arena.meId) ?? null,
    [data]
  );
  const selected = useMemo(
    () => data?.portfolios.find((p) => p.user.id === selectedUserId) ?? null,
    [data, selectedUserId]
  );
  const shared = useMemo(() => {
    if (!me || !selected) return [];
    const mine = new Set(me.rows.map((r) => r.label));
    return selected.rows.filter((r) => mine.has(r.label)).slice(0, 12);
  }, [me, selected]);
  const selectedFeed = useMemo(
    () => (selected ? data?.feeds.filter((f) => f.userId === selected.user.id).slice(0, 10) ?? [] : []),
    [data, selected]
  );

  async function renameArena(e: React.FormEvent) {
    e.preventDefault();
    if (!rename.trim()) return;
    const r = await fetch(`/api/arenas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: rename.trim() }),
    });
    if (!r.ok) return void setErr("Could not rename arena");
    await load();
  }

  async function deleteArena() {
    if (!confirm("Delete this arena for all members?")) return;
    const r = await fetch(`/api/arenas/${id}`, { method: "DELETE" });
    if (!r.ok) return void setErr("Could not delete arena");
    router.push("/arena");
  }

  async function removeMember(userId: string) {
    if (!confirm("Remove this user from the arena?")) return;
    const r = await fetch(`/api/arenas/${id}/members/${userId}`, { method: "DELETE" });
    if (!r.ok) return void setErr("Could not remove user");
    await load();
  }

  if (err && !data) {
    return (
      <div>
        <p className="text-red-600">{err}</p>
        <Link href="/arena" className="text-(--accent)">Back</Link>
      </div>
    );
  }
  if (!data) return <p className="text-(--muted)">Loading...</p>;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/arena" className="text-sm text-(--accent)">← All arenas</Link>
        <h1 className="mt-1 text-2xl font-semibold">{data.arena.name}</h1>
        <p className="text-(--muted) text-sm">
          Invite code: <code className="font-mono">{data.arena.joinCode}</code>
        </p>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {data.arena.isCreator && (
        <div className="rounded-xl border border-(--card-border) bg-(--card) p-3">
          <form onSubmit={renameArena} className="flex flex-wrap items-center gap-2">
            <input
              className="rounded border border-(--card-border) bg-(--background) px-2 py-1.5 text-sm"
              value={rename}
              onChange={(e) => setRename(e.target.value)}
              placeholder="Arena name"
            />
            <button type="submit" className="rounded bg-(--accent) px-3 py-1.5 text-sm text-(--accent-foreground)">Rename</button>
            <button type="button" onClick={() => void deleteArena()} className="rounded border border-red-500/40 px-3 py-1.5 text-sm text-red-500">Delete arena</button>
          </form>
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold">Members</h2>
        <ul className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.portfolios.map((p) => {
            const who = p.user.name || p.user.email.split("@")[0];
            const active = p.user.id === selectedUserId;
            return (
              <li key={p.user.id} className={"rounded-2xl border p-3 " + (active ? "border-(--accent) bg-(--card)" : "border-(--card-border) bg-(--card)")}>
                <button type="button" onClick={() => setSelectedUserId(p.user.id)} className="w-full text-left">
                  <p className="font-medium">{who}</p>
                  <p className="text-xs text-(--muted)">Top 5 tickers preview</p>
                  <div className="mt-2 space-y-1 text-xs">
                    {p.rows.slice(0, 5).map((r) => (
                      <div key={r.label} className="flex justify-between">
                        <span className="font-mono">{r.label}</span>
                        <span>{r.pct.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </button>
                {data.arena.isCreator && p.user.id !== data.arena.meId && (
                  <button
                    type="button"
                    onClick={() => void removeMember(p.user.id)}
                    className="mt-2 rounded border border-red-500/35 px-2 py-1 text-xs text-red-500"
                  >
                    Remove user
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {selected && me && (
        <section className="space-y-4 rounded-2xl border border-(--card-border) bg-(--card) p-4">
          <h2 className="text-xl font-semibold">
            Compare with {selected.user.name || selected.user.email.split("@")[0]}
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-(--muted)">Your portfolio % mix</h3>
              <HoldingPie holdings={toPieHoldings(me.rows)} height={300} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-(--muted)">
                {selected.user.name || selected.user.email.split("@")[0]} portfolio % mix
              </h3>
              <HoldingPie holdings={toPieHoldings(selected.rows)} height={300} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-(--card-border) bg-(--background) p-3">
              <h4 className="font-medium">Shared tickers</h4>
              {shared.length === 0 ? (
                <p className="text-sm text-(--muted)">No overlapping tickers yet.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {shared.map((r) => (
                    <li key={r.label} className="flex justify-between">
                      <span className="font-mono">{r.label}</span>
                      <span>{r.pct.toFixed(1)}% (them)</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-(--card-border) bg-(--background) p-3">
              <h4 className="font-medium">Diversification score</h4>
              <p className="mt-2 text-sm text-(--muted)">
                {selected.rows.length >= 10
                  ? "High diversity: 10+ tickers."
                  : selected.rows.length >= 5
                  ? "Balanced diversity: 5-9 tickers."
                  : "Concentrated: under 5 tickers."}
              </p>
            </div>
            <div className="rounded-xl border border-(--card-border) bg-(--background) p-3">
              <h4 className="font-medium">Activity streak</h4>
              <p className="mt-2 text-sm text-(--muted)">
                {selectedFeed.length} recent investing feed entries tracked.
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium">Their investing feed</h3>
            {selectedFeed.length === 0 ? (
              <p className="text-sm text-(--muted)">No recent updates.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {selectedFeed.map((f) => (
                  <li key={f.id} className="rounded-lg border border-(--card-border) bg-(--background) px-3 py-2 text-sm">
                    {formatPctChangeLine({
                      userLabel: f.user.name || f.user.email.split("@")[0],
                      symbol: f.symbol,
                      title: f.title,
                      kind: f.kind,
                      pct: f.pct,
                      oldShares: f.oldShares,
                      newShares: f.newShares,
                      at: f.createdAt,
                      accountName: f.accountName,
                    })}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
