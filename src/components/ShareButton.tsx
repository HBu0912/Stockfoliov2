"use client";

import { useEffect, useMemo, useState } from "react";

type ArenaOption = { id: string; name: string };
type UserOption = { id: string; name: string | null; email: string };

export function ShareButton({ title, url }: { title: string; url: string }) {
  const [open, setOpen] = useState(false);
  const [targetType, setTargetType] = useState<"arena" | "user">("arena");
  const [targetId, setTargetId] = useState("");
  const [note, setNote] = useState("");
  const [arenas, setArenas] = useState<ArenaOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const fullUrl = useMemo(() => {
    if (typeof window === "undefined") return url;
    try {
      return new URL(url, window.location.origin).toString();
    } catch {
      return url;
    }
  }, [url]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const [arenasRes, friendsRes] = await Promise.all([fetch("/api/arenas"), fetch("/api/friends")]);
      if (arenasRes.ok) {
        const a = (await arenasRes.json().catch(() => ({}))) as { arenas?: Array<{ id: string; name: string }> };
        setArenas(a.arenas?.map((x) => ({ id: x.id, name: x.name })) ?? []);
      }
      if (friendsRes.ok) {
        const f = (await friendsRes.json().catch(() => ({}))) as { following?: UserOption[] };
        setUsers(f.following ?? []);
      }
    })();
  }, [open]);

  async function shareNow() {
    if (!targetId) {
      setStatus("Select a destination first.");
      return;
    }
    setStatus("Sharing...");
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, title, url: fullUrl, note }),
    });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setStatus(d.error ?? "Share failed.");
      return;
    }
    setStatus("Shared.");
    setTimeout(() => setOpen(false), 500);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-(--card-border) px-3 py-1.5 text-xs hover:bg-(--background)"
      >
        Share
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-(--card-border) bg-(--card) p-3 shadow-lg">
          <p className="text-sm font-semibold">Share</p>
          <p className="mt-1 text-xs text-(--muted)">{title}</p>
          <div className="mt-2 flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setTargetType("arena");
                setTargetId("");
              }}
              className={"rounded-md border px-2 py-1 " + (targetType === "arena" ? "bg-(--background)" : "")}
            >
              Arena chat
            </button>
            <button
              type="button"
              onClick={() => {
                setTargetType("user");
                setTargetId("");
              }}
              className={"rounded-md border px-2 py-1 " + (targetType === "user" ? "bg-(--background)" : "")}
            >
              User chat
            </button>
          </div>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="mt-2 w-full rounded-md border border-(--card-border) bg-(--background) px-2 py-1.5 text-sm"
          >
            <option value="">Select destination</option>
            {targetType === "arena"
              ? arenas.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))
              : users.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name || x.email}
                  </option>
                ))}
          </select>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional message"
            className="mt-2 h-16 w-full rounded-md border border-(--card-border) bg-(--background) px-2 py-1.5 text-sm"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(fullUrl)}
              className="rounded-md border border-(--card-border) px-2 py-1 text-xs hover:bg-(--background)"
            >
              Copy link
            </button>
            <button
              type="button"
              onClick={() => void shareNow()}
              className="rounded-md bg-(--accent) px-3 py-1.5 text-xs text-(--accent-foreground)"
            >
              Share
            </button>
          </div>
          {status ? <p className="mt-2 text-xs text-(--muted)">{status}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
