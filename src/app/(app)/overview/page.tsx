"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { HoldingPie } from "@/components/HoldingPie";
import { HoldingsTable } from "@/components/HoldingsTable";
import { aggregateBySymbol } from "@/lib/allocations";
import { formatUsd } from "@/lib/money";
import type { Account, Holding } from "@/generated/prisma";

type AccountWithH = Account & { holdings: Holding[] };

function syntheticForAggregate(rows: { label: string; name: string; value: number }[]) {
  return rows.map((r) => ({
    id: r.label,
    symbol: r.label,
    name: r.name,
    shares: 1,
    lastPrice: r.value,
  })) as unknown as Pick<Holding, "id" | "symbol" | "name" | "shares" | "lastPrice">[];
}

export default function OverviewPage() {
  const [accounts, setAccounts] = useState<AccountWithH[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [addAccOpen, setAddAccOpen] = useState(false);
  const [addAccName, setAddAccName] = useState("");
  const [addSym, setAddSym] = useState("");
  const [addShares, setAddShares] = useState("1");
  const [addAccountId, setAddAccountId] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    const r = await fetch("/api/accounts");
    if (!r.ok) {
      setErr("Could not load accounts");
      return;
    }
    const d = (await r.json()) as { accounts: AccountWithH[] };
    setAccounts(d.accounts);
    setAddAccountId((cur) => (cur && d.accounts.some((a) => a.id === cur) ? cur : d.accounts[0]?.id ?? ""));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flat = accounts?.flatMap((a) => a.holdings.map((h) => ({ h, accountName: a.name, accountId: a.id }))) ?? [];
  const totalPortfolio = flat.reduce((s, x) => s + x.h.shares * (x.h.lastPrice ?? 0), 0);
  const flatHoldings = flat.map((x) => ({
    ...x.h,
    _account: x.accountName,
  }));
  const agg = aggregateBySymbol(accounts?.flatMap((a) => a.holdings) ?? []);

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!addAccName.trim()) return;
    const r = await fetch("/api/accounts", { method: "POST", body: JSON.stringify({ name: addAccName.trim() }) });
    if (!r.ok) {
      setErr("Could not add account");
      return;
    }
    setAddAccName("");
    setAddAccOpen(false);
    await load();
  }

  async function addHolding(e: React.FormEvent) {
    e.preventDefault();
    const sh = parseFloat(addShares);
    if (!addAccountId || !addSym.trim() || Number.isNaN(sh) || sh <= 0) return;
    const r = await fetch("/api/holdings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: addAccountId, symbol: addSym.trim(), shares: sh }),
    });
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) {
      setErr(d.error ?? "Could not add holding");
      return;
    }
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
      setErr(d.error ?? "Update failed");
      return;
    }
    await load();
  }

  async function removeHolding(id: string) {
    if (!confirm("Remove this line from your account? This records a 100% exit on your feed if you sell to zero, or use Edit shares.")) return;
    const r = await fetch(`/api/holdings/${id}`, { method: "DELETE" });
    if (!r.ok) {
      setErr("Could not remove");
      return;
    }
    await load();
  }

  async function refreshPrice(id: string) {
    const r = await fetch(`/api/holdings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: true }),
    });
    if (!r.ok) {
      setErr("Could not refresh quote");
      return;
    }
    await load();
  }

  if (accounts === null) {
    return <p className="text-(--muted)">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-(--muted) text-sm">Named accounts, portfolio-wide totals, and a chart per account (top 5 + Other).</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAddAccOpen((v) => !v)}
            className="rounded-md bg-(--accent) px-3 py-2 text-sm font-medium text-(--accent-foreground)"
          >
            Add account
          </button>
        </div>
      </div>

      {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}

      {addAccOpen && (
        <form onSubmit={addAccount} className="max-w-sm rounded-lg border border-(--card-border) bg-(--card) p-4">
          <label className="block text-sm font-medium">Name this account</label>
          <input
            className="mt-1 w-full rounded border border-(--card-border) bg-(--background) px-2 py-1.5 text-sm"
            value={addAccName}
            onChange={(e) => setAddAccName(e.target.value)}
            placeholder="e.g. Roth IRA, Taxable, 401k"
            required
          />
          <div className="mt-2 flex gap-2">
            <button type="submit" className="rounded bg-(--accent) px-3 py-1.5 text-sm text-(--accent-foreground)">
              Create
            </button>
            <button type="button" onClick={() => setAddAccOpen(false)} className="text-sm text-(--muted)">
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="rounded-xl border border-(--card-border) bg-(--card) p-4">
        <h2 className="text-lg font-medium">Add or increase a holding</h2>
        <p className="text-(--muted) text-sm">Uses a public market quote (symbol + shares). Merging into the same symbol in the same account will log % change on the feed.</p>
        <form onSubmit={addHolding} className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-(--muted)">Account</label>
            <select
              className="block min-w-[160px] rounded border border-(--card-border) bg-(--background) px-2 py-1.5 text-sm"
              value={addAccountId}
              onChange={(e) => setAddAccountId(e.target.value)}
              required
            >
              {accounts.length === 0 ? <option value="">Create an account first</option> : null}
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-(--muted)">Symbol</label>
            <input
              className="block w-28 rounded border border-(--card-border) bg-(--background) px-2 py-1.5 text-sm font-mono uppercase"
              value={addSym}
              onChange={(e) => setAddSym(e.target.value.toUpperCase())}
              placeholder="GOOGL"
            />
          </div>
          <div>
            <label className="text-xs text-(--muted)">Shares to add</label>
            <input
              type="number"
              min={0.0001}
              step="any"
              className="block w-28 rounded border border-(--card-border) bg-(--background) px-2 py-1.5 text-sm"
              value={addShares}
              onChange={(e) => setAddShares(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={!accounts.length}
            className="rounded-md bg-foreground px-3 py-2 text-sm text-(--background) disabled:opacity-50"
          >
            Add holding
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-medium">All holdings across accounts</h2>
        <p className="text-(--muted) text-sm">
          Total portfolio value: <strong className="text-foreground">{formatUsd(totalPortfolio)}</strong>
        </p>
        {agg.length > 0 && (
          <div className="mt-4 max-w-sm">
            <h3 className="text-sm font-medium text-(--muted)">Portfolio mix (by symbol, top 5 + Other)</h3>
            <HoldingPie
              holdings={syntheticForAggregate(
                agg.map((a) => ({ label: a.label, name: a.name, value: a.value }))
              )}
            />
          </div>
        )}
        {flat.length === 0 ? (
          <p className="text-(--muted) mt-2">No holdings yet. Add a named account, then a symbol.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-(--muted)">
                <tr>
                  <th className="p-2">Account</th>
                  <th className="p-2">Symbol</th>
                  <th className="p-2">Name</th>
                  <th className="p-2 text-right">Value</th>
                  <th className="p-2 text-right">% of full portfolio</th>
                </tr>
              </thead>
              <tbody>
                {flat.map((x) => {
                  const v = x.h.shares * (x.h.lastPrice ?? 0);
                  const pct = totalPortfolio > 0 ? (v / totalPortfolio) * 100 : 0;
                  return (
                    <tr key={`${x.accountId}-${x.h.id}`} className="border-t border-(--card-border)">
                      <td className="p-2">
                        <Link href={`/accounts/${x.accountId}`} className="text-(--accent) hover:underline">
                          {x.accountName}
                        </Link>
                      </td>
                      <td className="p-2 font-mono font-medium">{x.h.symbol}</td>
                      <td className="p-2 max-w-[200px] truncate" title={x.h.name}>
                        {x.h.name}
                      </td>
                      <td className="p-2 text-right">{formatUsd(v)}</td>
                      <td className="p-2 text-right">{totalPortfolio > 0 ? `${pct.toFixed(1)}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-medium">By account</h2>
        {accounts.length === 0 ? (
          <p className="text-(--muted)">Create an account to start.</p>
        ) : (
          accounts.map((a) => {
            const t = a.holdings.reduce((s, h) => s + h.shares * (h.lastPrice ?? 0), 0);
            return (
              <div key={a.id} className="rounded-xl border border-(--card-border) bg-(--background) p-4 shadow-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-base font-semibold">
                    <Link href={`/accounts/${a.id}`} className="text-(--accent) hover:underline">
                      {a.name}
                    </Link>
                  </h3>
                  <span className="text-sm text-(--muted)">Subtotal: {formatUsd(t)}</span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <HoldingPie holdings={a.holdings} />
                  <div className="text-sm text-(--muted)">
                    <p>{a.holdings.length} line{a.holdings.length === 1 ? "" : "s"} in this account.</p>
                    <p className="mt-1">Open the account page to edit, refresh prices, and see the account-level activity feed.</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
