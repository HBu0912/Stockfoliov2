"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPctChangeLine } from "@/lib/feed-copy";

type Row = {
  id: string;
  symbol: string;
  title: string;
  kind: string;
  pct: number;
  oldShares: number;
  newShares: number;
  accountName: string | null;
  createdAt: string;
  user: { name: string | null; email: string };
};

export default function GlobalFeedPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const r = await fetch("/api/feed");
    if (!r.ok) {
      setErr("Could not load feed");
      return;
    }
    const d = (await r.json()) as { items: Row[] };
    setItems(d.items);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Investing feed</h1>
        <p className="text-(--muted) text-sm">Every add or change is expressed as a % of that one position only (e.g. new line = +100%, sell half the line = 50% trimmed), not a rebalance of your other picks.</p>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {items.length === 0 ? (
        <p className="text-(--muted)">No activity yet — add a holding to see updates here.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((e) => {
            const label = e.user.name || e.user.email.split("@")[0];
            return (
              <li key={e.id} className="rounded-lg border border-(--card-border) bg-(--card) px-3 py-2 text-sm">
                {formatPctChangeLine({
                  userLabel: label,
                  symbol: e.symbol,
                  title: e.title,
                  kind: e.kind,
                  pct: e.pct,
                  oldShares: e.oldShares,
                  newShares: e.newShares,
                  at: e.createdAt,
                  accountName: e.accountName,
                })}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
