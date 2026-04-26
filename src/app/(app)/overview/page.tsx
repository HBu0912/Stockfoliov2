"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HoldingPie } from "@/components/HoldingPie";
import { HoldingsTable } from "@/components/HoldingsTable";
import { formatPctChangeLine } from "@/lib/feed-copy";
import { formatUsd } from "@/lib/money";
import type { Account, Holding } from "@/generated/prisma";

type AccountWithH = Account & { holdings: Holding[] };
type FeedRow = {
  id: string;
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

export default function OverviewPage() {
  const [accounts, setAccounts] = useState<AccountWithH[] | null>(null);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [addAccOpen, setAddAccOpen] = useState(false);
  const [addAccName, setAddAccName] = useState("");
  const [addSym, setAddSym] = useState("");
  const [addShares, setAddShares] = useState("1");

  const load = useCallback(async () => {
    setErr(null);
    const [accountsRes, feedRes] = await Promise.all([
      fetch("/api/accounts"),
      fetch("/api/feed"),
    ]);
    if (!accountsRes.ok) {
      setErr("Could not load accounts");
      return;
    }
    const d = (await accountsRes.json()) as { accounts: AccountWithH[] };
    setAccounts(d.accounts);
    if (feedRes.ok) {
      const f = (await feedRes.json()) as { items: FeedRow[] };
      setFeed(f.items);
    }
    setSelectedAccountId((current) =>
      current === "__overview__" || (current && d.accounts.some((a) => a.id === current))
        ? current
        : "__overview__"
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const fn = () => void load();
    window.addEventListener("prices-refreshed", fn);
    return () => window.removeEventListener("prices-refreshed", fn);
  }, [load]);

  const onOverview = selectedAccountId === "__overview__";
  const selectedAccount = useMemo(
    () => accounts?.find((a) => a.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  );

  const totalPortfolioValue = useMemo(
    () =>
      (accounts ?? [])
        .flatMap((a) => a.holdings)
        .reduce((sum, h) => sum + h.shares * (h.lastPrice ?? 0), 0),
    [accounts]
  );
  const totalHoldingsCount = useMemo(
    () => (accounts ?? []).flatMap((a) => a.holdings).length,
    [accounts]
  );
  const selectedAccountValue = useMemo(
    () =>
      selectedAccount?.holdings.reduce(
        (sum, h) => sum + h.shares * (h.lastPrice ?? 0),
        0
      ) ?? 0,
    [selectedAccount]
  );

  const mergedOverviewHoldings = useMemo(() => {
    const map = new Map<string, Holding>();
    for (const account of accounts ?? []) {
      for (const holding of account.holdings) {
        const key = holding.symbol.toUpperCase();
        const existing = map.get(key);
        if (!existing) {
          map.set(key, { ...holding, symbol: key });
          continue;
        }
        map.set(key, {
          ...existing,
          shares: existing.shares + holding.shares,
          lastPrice: holding.lastPrice ?? existing.lastPrice,
          marketCap: holding.marketCap ?? existing.marketCap,
          marketCapText: holding.marketCapText ?? existing.marketCapText,
        });
      }
    }
    return [...map.values()].sort(
      (a, b) => (b.lastPrice ?? 0) * b.shares - (a.lastPrice ?? 0) * a.shares
    );
  }, [accounts]);

  const viewHoldings = onOverview ? mergedOverviewHoldings : selectedAccount?.holdings ?? [];
  const viewValue = onOverview ? totalPortfolioValue : selectedAccountValue;
  const viewFeed = useMemo(
    () =>
      onOverview
        ? feed.slice(0, 8)
        : feed.filter((x) => x.accountName === selectedAccount?.name).slice(0, 8),
    [feed, onOverview, selectedAccount?.name]
  );

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!addAccName.trim()) return;
    const r = await fetch("/api/accounts", {
      method: "POST",
      body: JSON.stringify({ name: addAccName.trim() }),
    });
    if (!r.ok) return void setErr("Could not add account");
    setAddAccName("");
    setAddAccOpen(false);
    await load();
  }

  async function addHolding(e: React.FormEvent) {
    e.preventDefault();
    const sh = parseFloat(addShares);
    if (!selectedAccountId || !addSym.trim() || Number.isNaN(sh) || sh <= 0) return;
    const r = await fetch("/api/holdings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: selectedAccountId,
        symbol: addSym.trim(),
        shares: sh,
      }),
    });
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) return void setErr(d.error ?? "Could not add holding");
    setAddSym("");
    setAddShares("1");
    setErr(null);
    await load();
  }

  async function editHolding(id: string, nextShares: number) {
    const r = await fetch(`/api/holdings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shares: nextShares }),
    });
    if (!r.ok) {
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      return void setErr(d.error ?? "Update failed");
    }
    await load();
  }

  async function removeHolding(id: string) {
    if (!confirm("Remove this ticker line from this account?")) return;
    const r = await fetch(`/api/holdings/${id}`, { method: "DELETE" });
    if (!r.ok) return void setErr("Could not remove");
    await load();
  }

  if (accounts === null) return <p className="text-(--muted)">Loading...</p>;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-(--card-border) bg-(--card) px-5 py-4 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Stockfolio Dashboard</h1>
        <p className="mt-1 text-sm text-(--muted)">Track smart. Compare bold. Grow together.</p>
      </div>

      {err && (
        <div className="rounded-xl border border-red-400/35 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {err}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">Accounts</h2>
            <button
              type="button"
              onClick={() => setAddAccOpen((v) => !v)}
              className="rounded-md border border-(--card-border) px-2 py-1 text-xs hover:bg-(--background)"
            >
              {addAccOpen ? "Close" : "Add"}
            </button>
          </div>

          {addAccOpen && (
            <form
              onSubmit={addAccount}
              className="mb-3 space-y-2 rounded-lg border border-(--card-border) bg-(--background) p-2.5"
            >
              <input
                className="w-full rounded-md border border-(--card-border) bg-(--background) px-2 py-1.5 text-sm"
                value={addAccName}
                onChange={(e) => setAddAccName(e.target.value)}
                placeholder="Account name"
                required
              />
              <button
                type="submit"
                className="w-full rounded-md bg-(--accent) px-2 py-1.5 text-xs font-medium text-(--accent-foreground)"
              >
                Create account
              </button>
            </form>
          )}

          <ul className="space-y-1.5">
            <li>
              <button
                type="button"
                onClick={() => setSelectedAccountId("__overview__")}
                className={
                  "w-full rounded-lg border px-3 py-2 text-left transition " +
                  (onOverview
                    ? "border-(--accent) bg-(--background) shadow-sm"
                    : "border-(--card-border) hover:bg-(--background)")
                }
              >
                <p className="text-sm font-medium">Consolidated Overview</p>
                <p className="text-xs text-(--muted)">
                  Total across all accounts · {totalHoldingsCount} holdings
                </p>
              </button>
            </li>
            {accounts.map((account) => {
              const subtotal = account.holdings.reduce(
                (sum, h) => sum + h.shares * (h.lastPrice ?? 0),
                0
              );
              const active = account.id === selectedAccountId;
              return (
                <li key={account.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedAccountId(account.id)}
                    className={
                      "w-full rounded-lg border px-3 py-2 text-left transition " +
                      (active
                        ? "border-(--accent) bg-(--background) shadow-sm"
                        : "border-(--card-border) hover:bg-(--background)")
                    }
                  >
                    <p className="text-sm font-medium">{account.name}</p>
                    <p className="text-xs text-(--muted)">
                      {account.holdings.length} holdings · {formatUsd(subtotal)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>

          {!onOverview && (
            <form
              onSubmit={addHolding}
              className="mt-4 space-y-2 rounded-lg border border-(--card-border) bg-(--background) p-2.5"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-(--muted)">
                Add holding
              </p>
              <input
                value={selectedAccount?.name ?? "No account"}
                disabled
                className="w-full rounded-md border border-(--card-border) bg-(--background) px-2 py-1.5 text-sm"
              />
              <input
                className="w-full rounded-md border border-(--card-border) bg-(--background) px-2 py-1.5 text-sm font-mono uppercase"
                value={addSym}
                onChange={(e) => setAddSym(e.target.value.toUpperCase())}
                placeholder="Ticker (AAPL)"
                required
              />
              <input
                type="number"
                min={0.0001}
                step="any"
                className="w-full rounded-md border border-(--card-border) bg-(--background) px-2 py-1.5 text-sm"
                value={addShares}
                onChange={(e) => setAddShares(e.target.value)}
                placeholder="Shares"
                required
              />
              <button
                type="submit"
                disabled={!selectedAccount}
                className="w-full rounded-md bg-(--accent) px-3 py-2 text-sm font-medium text-(--accent-foreground) disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add holding
              </button>
            </form>
          )}
        </aside>

        <section className="space-y-5">
          <div className="grid items-stretch gap-5 xl:grid-cols-12">
            <div className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm xl:col-span-7 min-h-[420px]">
              <h3 className="text-sm font-medium text-(--muted)">
                {onOverview
                  ? "Consolidated Overview"
                  : selectedAccount
                  ? `${selectedAccount.name} mix`
                  : "Account mix"}
              </h3>
              <p className="text-xl font-semibold">{formatUsd(viewValue)}</p>
              <div className="mt-2 h-[340px]">
                <HoldingPie holdings={viewHoldings} height={320} />
              </div>
            </div>

            <div className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm xl:col-span-5 min-h-[420px]">
              <h3 className="text-lg font-semibold">Investing feed</h3>
              <p className="text-xs text-(--muted)">
                {onOverview
                  ? "All recent activity"
                  : `Recent activity for ${selectedAccount?.name ?? "this account"}`}
              </p>
              <div className="mt-2">
                {viewFeed.length === 0 ? (
                  <p className="text-sm text-(--muted)">No activity yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {viewFeed.map((e) => (
                      <li
                        key={e.id}
                        className="rounded-lg border border-(--card-border) bg-(--background) px-3 py-2 text-xs text-foreground/90"
                      >
                        {formatPctChangeLine({
                          userLabel: e.user.name || e.user.email.split("@")[0],
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
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {onOverview
                  ? "All holdings (combined by ticker)"
                  : selectedAccount
                  ? `${selectedAccount.name} holdings`
                  : "Holdings"}
              </h3>
              <p className="text-sm text-(--muted)">
                {viewHoldings.length} line{viewHoldings.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="mt-3">
              <HoldingsTable
                holdings={viewHoldings}
                accountTotal={viewValue}
                onEditShares={onOverview ? undefined : editHolding}
                onRemove={onOverview ? undefined : removeHolding}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
