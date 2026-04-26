"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Arena } from "@/generated/prisma";

type ArenaRow = Arena & { memberCount: number; isCreator: boolean };

export default function ArenaListPage() {
  const [arenas, setArenas] = useState<ArenaRow[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    setErr(null);
    const r = await fetch("/api/arenas");
    if (!r.ok) {
      setErr("Could not load arenas");
      return;
    }
    const d = (await r.json()) as { arenas: ArenaRow[] };
    setArenas(d.arenas);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createArena(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const r = await fetch("/api/arenas", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
    if (!r.ok) {
      setErr("Could not create arena");
      return;
    }
    const d = (await r.json()) as { arena: Arena };
    setName("");
    await load();
    router.push(`/arena/${d.arena.id}`);
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    const r = await fetch("/api/arenas/join", { method: "POST", body: JSON.stringify({ code: code.trim() }) });
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      setErr(d.error ?? "Join failed");
      return;
    }
    const d = (await r.json()) as { arena: Arena };
    setCode("");
    setErr(null);
    await load();
    router.push(`/arena/${d.arena.id}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Arenas</h1>
      <p className="text-(--muted) text-sm">Compare your stockfolio with friends. Gain insights on how their investing evolves.</p>
      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <form onSubmit={createArena} className="rounded-xl border border-(--card-border) bg-(--card) p-4">
          <h2 className="font-medium">Create arena</h2>
          <input
            className="mt-2 w-full rounded border border-(--card-border) bg-(--background) px-2 py-1.5 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. College friends"
          />
          <button type="submit" className="mt-2 rounded bg-(--accent) px-3 py-1.5 text-sm text-(--accent-foreground)">
            Create and open
          </button>
        </form>
        <form onSubmit={join} className="rounded-xl border border-(--card-border) bg-(--card) p-4">
          <h2 className="font-medium">Join with code</h2>
          <input
            className="mt-2 w-full rounded border border-(--card-border) bg-(--background) px-2 py-1.5 text-sm font-mono uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CODE"
          />
          <button type="submit" className="mt-2 rounded border border-(--card-border) px-3 py-1.5 text-sm">
            Join
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-lg font-medium">Your arenas</h2>
        {arenas.length === 0 ? (
          <p className="text-(--muted) text-sm">You haven&rsquo;t joined any arenas yet.</p>
        ) : (
          <ul className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {arenas.map((a) => (
              <li key={a.id} className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
                <Link href={`/arena/${a.id}`} className="text-lg font-semibold text-(--accent) hover:underline">
                  {a.name}
                </Link>
                <p className="mt-1 text-sm text-(--muted)">
                  {a.memberCount} member{a.memberCount === 1 ? "" : "s"} · code{" "}
                  <span className="font-mono">{a.joinCode}</span>
                </p>
                {a.isCreator && (
                  <p className="mt-1 text-xs font-medium text-(--accent)">You are the creator</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
