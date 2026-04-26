"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HoldingPie } from "@/components/HoldingPie";
import { HoldingsTable } from "@/components/HoldingsTable";
import { formatUsd } from "@/lib/money";
import type { Account, Holding } from "@/generated/prisma";

type AccountWithH = Account & { holdings: Holding[] };

export default function OverviewPage() {
  const [accounts, setAccounts] = useState<AccountWithH[] | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [addAccOpen, setAddAccOpen] = useState(false);
  const [addAccName, setAddAccName] = useState("");
  const [addSym, setAddSym] = useState("");
  const [addShares, setAddShares] = useState("1");

  const load = useCallback(async () => {
    setErr(null);
    const r = await fetch("/api/accounts");
    if (!r.ok) {
      setErr("Could not load accounts");
      return;
    }
    const d = (await r.json()) as { accounts: AccountWithH[] };
    setAccounts(d.accounts);
    setSelectedAccountId((current) =>
      current && d.accounts.some((a) => a.id === current)
        ? current
        : d.accounts[0]?.id ?? ""
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  const selectedAccountValue = useMemo(
    () =>
      selectedAccount?.holdings.reduce(
        (sum, h) => sum + h.shares * (h.lastPrice ?? 0),
        0
      ) ?? 0,
    [selectedAccount]
  );

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!addAccName.trim()) return;
    const r = await fetch("/api/accounts", {
      method: "POST",
      body: JSON.stringify({ name: addAccName.trim() }),
    });
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
    if (!selectedAccountId || !addSym.trim() || Number.isNaN(sh) || sh <= 0) {
      return;
    }
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
    if (
      !confirm(
        "Remove this holding line from this account? This will log a position change in your feed."
      )
    )
      return;
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
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) {
      setErr(d.error ?? "Could not refresh quote");
      return;
    }
    await load();
  }

  if (accounts === null) {
    return <p className="text-(--muted)">Loading...</p>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-(--card-border) bg-(--card) px-5 py-4 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio Dashboard</h1>
        <p className="mt-1 text-sm text-(--muted)">
          Select an account from the left rail. The chart and holdings update for that account.
        </p>
      </div>

      {err && (
        <div className="rounded-xl border border-red-400/35 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {err}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
          <div className="rounded-xl border border-(--card-border) bg-(--background) p-3">
            <p className="text-xs uppercase tracking-wide text-(--muted)">
              Overview
            </p>
            <p className="mt-1 text-xl font-semibold">{formatUsd(totalPortfolioValue)}</p>
            <p className="text-xs text-(--muted)">
              {accounts.length} account{accounts.length === 1 ? "" : "s"} total
            </p>
          </div>

          <div className="mt-4">
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
              <form onSubmit={addAccount} className="mb-3 space-y-2 rounded-lg border border-(--card-border) bg-(--background) p-2.5">
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
              {accounts.length === 0 && (
                <li className="rounded-md border border-dashed border-(--card-border) px-2 py-2 text-xs text-(--muted)">
                  Add your first account to begin.
                </li>
              )}
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
          </div>
        </aside>

        <section className="space-y-5">
          <div className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
            <h2 className="text-lg font-semibold">Add holding</h2>
            <p className="text-sm text-(--muted)">
              Add shares to the selected account. Price and company data are fetched automatically.
            </p>
            <form
              onSubmit={addHolding}
              className="mt-3 grid gap-2 sm:grid-cols-[120px_140px_140px_auto]"
            >
              <div>
                <label className="text-xs text-(--muted)">Selected account</label>
                <input
                  value={selectedAccount?.name ?? "No account"}
                  disabled
                  className="mt-1 w-full rounded-md border border-(--card-border) bg-(--background) px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-(--muted)">Symbol</label>
                <input
                  className="mt-1 w-full rounded-md border border-(--card-border) bg-(--background) px-2 py-1.5 text-sm font-mono uppercase"
                  value={addSym}
                  onChange={(e) => setAddSym(e.target.value.toUpperCase())}
                  placeholder="AAPL"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-(--muted)">Shares</label>
                <input
                  type="number"
                  min={0.0001}
                  step="any"
                  className="mt-1 w-full rounded-md border border-(--card-border) bg-(--background) px-2 py-1.5 text-sm"
                  value={addShares}
                  onChange={(e) => setAddShares(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={!selectedAccount}
                className="self-end rounded-md bg-(--accent) px-4 py-2 text-sm font-medium text-(--accent-foreground) disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add holding
              </button>
            </form>
          </div>

          <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
              <h3 className="text-sm font-medium text-(--muted)">
                {selectedAccount ? `${selectedAccount.name} mix` : "Account mix"}
              </h3>
              <p className="text-xl font-semibold">
                {formatUsd(selectedAccountValue)}
              </p>
              <div className="mt-2">
                <HoldingPie holdings={selectedAccount?.holdings ?? []} />
              </div>
            </div>

            <div className="rounded-2xl border border-(--card-border) bg-(--card) p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {selectedAccount ? `${selectedAccount.name} holdings` : "Holdings"}
                </h3>
                <p className="text-sm text-(--muted)">
                  {selectedAccount?.holdings.length ?? 0} line
                  {(selectedAccount?.holdings.length ?? 0) === 1 ? "" : "s"}
                </p>
              </div>
              <div className="mt-3">
                <HoldingsTable
                  holdings={selectedAccount?.holdings ?? []}
                  accountTotal={selectedAccountValue}
                  onEditShares={editHolding}
                  onRemove={removeHolding}
                  onRefresh={refreshPrice}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
