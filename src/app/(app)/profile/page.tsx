"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HoldingPie } from "@/components/HoldingPie";
import { aggregatePersonaInputs, deriveInvestorPersona, type InvestorPersona, type PersonaSlice } from "@/lib/investor-persona";

type Me = { id: string; email: string; name: string | null; username?: string | null };
type UserRow = { id: string; name: string | null; email: string; username?: string | null };
type DirectMsg = {
  id: string;
  body: string;
  shareUrl: string | null;
  createdAt: string;
  sender: UserRow;
};
type SnapshotRow = { label: string; name: string; value: number; pct: number };
type Snapshot = { user: UserRow; rows: SnapshotRow[] };

export default function ProfilePage() {
  const [user, setUser] = useState<Me | null>(null);
  const [following, setFollowing] = useState<UserRow[]>([]);
  const [followers, setFollowers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserRow[]>([]);
  const [chatUserId, setChatUserId] = useState("");
  const [chatMessages, setChatMessages] = useState<DirectMsg[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [listOpen, setListOpen] = useState<"followers" | "following" | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [persona, setPersona] = useState<InvestorPersona | null>(null);
  const [personaLoading, setPersonaLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const params = useSearchParams();

  const load = useCallback(async () => {
    setErr(null);
    const r = await fetch("/api/auth/me");
    if (!r.ok) return void setErr("Could not load profile");
    const d = (await r.json()) as { user: Me | null };
    if (!d.user) return void setErr("No user found");
    setUser(d.user);
    const fr = await fetch("/api/friends");
    if (fr.ok) {
      const fd = (await fr.json()) as { following?: UserRow[]; followers?: UserRow[] };
      setFollowing(fd.following ?? []);
      setFollowers(fd.followers ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void (async () => {
        const r = await fetch(`/api/users/search?q=${encodeURIComponent(search.trim())}`);
        if (!r.ok) return;
        const d = (await r.json()) as { users?: UserRow[] };
        setResults(d.users ?? []);
      })();
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const chat = params.get("chat");
    if (chat) setChatUserId(chat);
  }, [params]);

  useEffect(() => {
    if (!snapshot) {
      setPersona(null);
      return;
    }
    let cancelled = false;
    setPersona(null);
    setPersonaLoading(true);
    void (async () => {
      const top = snapshot.rows.slice(0, 10);
      const parts = await Promise.all(
        top.map(async (row) => {
          try {
            const res = await fetch(`/api/stocks/${encodeURIComponent(row.label)}?interval=1M&newsLimit=1&newsOffset=0`);
            if (!res.ok) return null;
            const d = (await res.json()) as {
              sector?: string | null;
              metrics?: {
                beta?: number | null;
                dividendYield?: number | null;
                forwardPE?: number | null;
                returnOnEquity?: number | null;
                marketCap?: number | null;
              };
            };
            return {
              pct: row.pct,
              beta: d.metrics?.beta ?? null,
              dividendYield: d.metrics?.dividendYield ?? null,
              forwardPE: d.metrics?.forwardPE ?? null,
              roe: d.metrics?.returnOnEquity ?? null,
              sector: d.sector ?? null,
              marketCap: d.metrics?.marketCap ?? null,
              symbol: row.label,
              name: row.name,
            };
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      const clean = parts.filter(Boolean) as PersonaSlice[];
      const inputs = aggregatePersonaInputs(clean);
      setPersona(deriveInvestorPersona(inputs));
      setPersonaLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [snapshot]);

  useEffect(() => {
    if (!chatUserId) {
      setChatMessages([]);
      return;
    }
    void (async () => {
      const r = await fetch(`/api/chats/direct/${chatUserId}`);
      if (!r.ok) return;
      const d = (await r.json()) as { messages?: DirectMsg[] };
      setChatMessages(d.messages ?? []);
    })();
  }, [chatUserId]);

  async function follow(userId: string) {
    const r = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (r.ok) await load();
  }

  async function unfollow(userId: string) {
    const r = await fetch("/api/friends", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (r.ok) await load();
  }

  async function sendDirect(e: React.FormEvent) {
    e.preventDefault();
    const body = chatDraft.trim();
    if (!body || !chatUserId) return;
    const r = await fetch(`/api/chats/direct/${chatUserId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!r.ok) return;
    setChatDraft("");
    const d = (await r.json()) as { message?: DirectMsg };
    setChatMessages((prev) => (d.message ? [...prev, d.message] : prev));
  }

  async function openSnapshot(userId: string) {
    const r = await fetch(`/api/users/${userId}/snapshot`);
    if (!r.ok) {
      setErr("You can only view profiles if you share an arena or mutually follow.");
      return;
    }
    const d = (await r.json()) as Snapshot;
    setSnapshot(d);
  }

  const mutualSet = useMemo(() => {
    const followerIds = new Set(followers.map((x) => x.id));
    return new Set(following.filter((x) => followerIds.has(x.id)).map((x) => x.id));
  }, [followers, following]);

  if (!user && !err) return <p className="text-(--muted)">Loading profile...</p>;

  return (
    <div className="mx-auto max-w-2xl min-w-0 space-y-4 px-1 sm:px-0">
      <h1 className="bg-linear-to-r from-cyan-200 via-sky-200 to-violet-200 bg-clip-text text-xl font-semibold tracking-tight text-transparent sm:text-2xl">Profile</h1>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {user && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-cyan-400/35 bg-gradient-to-br from-slate-900/95 to-indigo-900/70 p-5 shadow-lg shadow-cyan-700/20">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-(--muted)">Username</p>
              <p className="mt-1 text-lg font-medium">@{user.username || user.name || user.email.split("@")[0]}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-(--muted)">Email</p>
              <p className="mt-1 text-lg font-medium">{user.email}</p>
            </div>
            <div className="rounded-xl border border-violet-400/30 bg-slate-900/70 p-3">
              <p className="text-xs uppercase tracking-wide text-(--muted)">Social Badge</p>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <button type="button" onClick={() => setListOpen("followers")} className="rounded border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 hover:bg-cyan-500/20">
                  Followers: {followers.length}
                </button>
                <button type="button" onClick={() => setListOpen("following")} className="rounded border border-violet-400/30 bg-violet-500/10 px-2 py-1 hover:bg-violet-500/20">
                  Following: {following.length}
                </button>
              </div>
            </div>
          </div>
          </div>

          <div className="rounded-2xl border border-sky-400/35 bg-gradient-to-br from-slate-900/90 to-slate-800/80 p-4 shadow-lg shadow-sky-700/20">
            <p className="text-sm font-semibold">Find users</p>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              className="mt-2 w-full rounded-md border border-cyan-400/30 bg-slate-900/80 px-3 py-2 text-sm"
            />
            <div className="mt-2 space-y-1">
              {results.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded border border-cyan-400/25 bg-black/20 px-2 py-1.5 text-sm">
                  <span>@{u.username || u.name || u.email}</span>
                  {following.some((f) => f.id === u.id) ? (
                    <button type="button" onClick={() => void unfollow(u.id)} className="text-xs text-(--muted)">
                      Unfollow
                    </button>
                  ) : (
                    <button type="button" onClick={() => void follow(u.id)} className="text-xs text-(--accent)">
                      Follow
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-violet-400/35 bg-gradient-to-br from-slate-900/90 to-indigo-900/65 p-4 shadow-lg shadow-violet-700/20">
            <p className="text-sm font-semibold">Direct Chat</p>
            {!chatUserId ? (
              <p className="mt-2 text-sm text-(--muted)">Select someone from Following to chat.</p>
            ) : (
              <>
                <div className="mt-2 max-h-[260px] space-y-2 overflow-y-auto pr-1">
                  {chatMessages.map((m) => (
                    <div key={m.id} className="rounded border border-violet-400/25 bg-black/20 px-2 py-1.5 text-sm">
                      <p className="text-xs text-(--muted)">
                        {m.sender.name || m.sender.email} · {new Date(m.createdAt).toLocaleString()}
                      </p>
                      <p className="mt-1">{m.body}</p>
                      {m.shareUrl ? (
                        <a href={m.shareUrl} target="_blank" rel="noreferrer" className="text-xs text-(--accent) underline">
                          Open shared link
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
                <form onSubmit={sendDirect} className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    className="min-h-11 min-w-0 flex-1 rounded-md border border-violet-400/30 bg-slate-900/80 px-3 py-2 text-sm"
                    placeholder="Send a message"
                  />
                  <button type="submit" className="min-h-11 shrink-0 rounded-md border border-cyan-400/40 bg-cyan-500/80 px-4 py-2 text-sm text-slate-950 hover:bg-cyan-400">
                    Send
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
      {listOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="scrollbar-hide max-h-[min(88dvh,560px)] w-full overflow-y-auto rounded-t-2xl border border-cyan-400/35 bg-gradient-to-br from-slate-900/95 to-indigo-900/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg shadow-cyan-700/25 sm:max-w-xl sm:rounded-2xl sm:pb-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold">{listOpen === "followers" ? "Followers" : "Following"}</p>
              <button type="button" onClick={() => setListOpen(null)} className="rounded border border-(--card-border) px-2 py-1 text-xs">Close</button>
            </div>
            <div className="max-h-[360px] space-y-1 overflow-y-auto">
              {(listOpen === "followers" ? followers : following).map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded border border-(--card-border) px-2 py-1.5 text-sm">
                  <button type="button" onClick={() => void openSnapshot(u.id)} className="text-left hover:underline">
                    @{u.username || u.name || u.email}
                  </button>
                  <button
                    type="button"
                    disabled={!mutualSet.has(u.id)}
                    onClick={() => {
                      setChatUserId(u.id);
                      setListOpen(null);
                    }}
                    className="rounded border border-(--card-border) px-2 py-0.5 text-xs disabled:opacity-40"
                    title={mutualSet.has(u.id) ? "Message" : "Requires mutual follow"}
                  >
                    💬
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {snapshot && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="scrollbar-hide max-h-[min(92dvh,720px)] w-full overflow-y-auto rounded-t-2xl border border-violet-400/35 bg-gradient-to-br from-slate-900/95 to-indigo-900/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg shadow-violet-700/25 sm:max-w-2xl sm:rounded-2xl sm:pb-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold">@{snapshot.user.username || snapshot.user.name || snapshot.user.email}</p>
              <button type="button" onClick={() => setSnapshot(null)} className="rounded border border-(--card-border) px-2 py-1 text-xs">Close</button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-3 md:col-span-2">
                <div className="rounded-xl border border-violet-500/35 bg-linear-to-br from-violet-500/15 via-(--card) to-cyan-500/10 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-200">Investor persona</p>
                  {personaLoading ? (
                    <p className="mt-2 text-sm text-(--muted)">Synthesizing style from holdings…</p>
                  ) : persona ? (
                    <>
                      <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">{persona.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-(--muted)">{persona.subtitle}</p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-(--muted)">Not enough live quote data to label this portfolio yet.</p>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-(--card-border) bg-(--background) p-3">
                <p className="text-xs text-(--muted)">Profile snapshot</p>
                <p className="mt-1 text-sm">Top positions: {snapshot.rows.length}</p>
              </div>
              <div className="rounded-lg border border-(--card-border) bg-(--background) p-3">
                <HoldingPie
                  holdings={snapshot.rows.map((r) => ({ id: r.label, symbol: r.label, name: r.name, shares: r.value, lastPrice: 1 }))}
                  showDollar={false}
                  height={220}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
