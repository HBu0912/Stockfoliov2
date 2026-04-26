"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HoldingPie } from "@/components/HoldingPie";
import { HoldingsTable } from "@/components/HoldingsTable";
import { formatPctChangeLine } from "@/lib/feed-copy";
import type { Account, AccountFeedEvent, Holding } from "@/generated/prisma";

type A = Account & { holdings: Holding[] };

export default function AccountDetailPage() {
  const { id } = useParams() as { id: string };
  const [account, setAccount] = useState<A | null>(null);
  const [feed, setFeed] = useState<AccountFeedEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const r = await fetch(`/api/accounts/${id}`);
    if (!r.ok) {
      setErr("Not found or no access");
      return;
    }
    const d = (await r.json()) as { account: A };
    setAccount(d.account);
    const fr = await fetch(`/api/feed/account/${id}`);
    if (fr.ok) {
      const fd = (await fr.json()) as { items: AccountFeedEvent[] };
      setFeed(fd.items);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = account ? account.holdings.reduce((s, h) => s + h.shares * (h.lastPrice ?? 0), 0) : 0;

  async function editHolding(holdingId: string, nextShares: number) {
    const r = await fetch(`/api/holdings/${holdingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shares: nextShares }),
    });
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      setErr(d.error ?? "Update failed");
      return;
    }
    await load();
  }

  async function removeHolding(holdingId: string) {
    if (!confirm("Remove this line? The feed will record a position change (including full exit if you move to 0).")) return;
    const r = await fetch(`/api/holdings/${holdingId}`, { method: "DELETE" });
    if (!r.ok) {
      setErr("Could not remove");
      return;
    }
    await load();
  }

  async function refreshPrice(holdingId: string) {
    const r = await fetch(`/api/holdings/${holdingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: true }),
    });
    if (!r.ok) {
      setErr("Could not refresh");
      return;
    }
    await load();
  }

  if (err && !account) {
    return (
      <div>
        <p className="text-red-600">{err}</p>
        <Link href="/overview" className="text-(--accent)">
          Back
        </Link>
      </div>
    );
  }
  if (!account) {
    return <p className="text-(--muted)">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/overview" className="text-sm text-(--accent)">
          ← Overview
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{account.name}</h1>
        <p className="text-(--muted) text-sm">This account&rsquo;s own activity (position % — not the rest of your portfolio)</p>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}

      <section className="grid gap-4 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-medium text-(--muted)">Top 5 by value (+ Other) — hover slices</h2>
          <HoldingPie holdings={account.holdings} />
        </div>
        <div>
          <h2 className="text-sm font-medium text-(--muted)">Account value</h2>
          <p className="text-2xl font-semibold tabular-nums">
            {total.toLocaleString("en-US", { style: "currency", currency: "USD" })}
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium">Holdings</h2>
        <div className="mt-2">
          <HoldingsTable
            holdings={account.holdings}
            accountTotal={total}
            onEditShares={editHolding}
            onRemove={removeHolding}
            onRefresh={refreshPrice}
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium">Activity on this account</h2>
        <p className="text-(--muted) text-sm">Only this account&rsquo;s line changes, using position-relative % (same idea as the site feed, but not shown in arenas).</p>
        {feed.length === 0 ? (
          <p className="text-(--muted) mt-2">No position changes here yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {feed.map((e) => (
              <li key={e.id} className="rounded-lg border border-(--card-border) bg-(--card) px-3 py-2 text-sm text-foreground/90">
                {formatPctChangeLine({
                  userLabel: "You",
                  symbol: e.symbol,
                  title: e.title,
                  kind: e.kind,
                  pct: e.pct,
                  oldShares: e.oldShares,
                  newShares: e.newShares,
                  at: e.createdAt,
                })}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
