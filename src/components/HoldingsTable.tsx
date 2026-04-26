"use client";

import { useState } from "react";
import { formatNumber, formatUsd } from "@/lib/money";
import type { Holding } from "@/generated/prisma";

type H = Holding;

export function HoldingsTable({
  holdings,
  accountTotal,
  onEditShares,
  onRemove,
}: {
  holdings: H[];
  accountTotal: number;
  onEditShares?: (id: string, nextShares: number) => void;
  onRemove?: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<"symbol" | "shares" | "price" | "value" | "pct">("value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  if (holdings.length === 0) {
    return <p className="text-sm text-(--muted)">No holdings in this list yet.</p>;
  }
  const sorted = [...holdings].sort((a, b) => {
    const av = a.shares * (a.lastPrice ?? 0);
    const bv = b.shares * (b.lastPrice ?? 0);
    const ap = accountTotal > 0 ? (av / accountTotal) * 100 : 0;
    const bp = accountTotal > 0 ? (bv / accountTotal) * 100 : 0;
    let cmp = 0;
    if (sortKey === "symbol") cmp = a.symbol.localeCompare(b.symbol);
    if (sortKey === "shares") cmp = a.shares - b.shares;
    if (sortKey === "price") cmp = (a.lastPrice ?? 0) - (b.lastPrice ?? 0);
    if (sortKey === "value") cmp = av - bv;
    if (sortKey === "pct") cmp = ap - bp;
    return sortDir === "asc" ? cmp : -cmp;
  });
  const sort = (k: typeof sortKey) =>
    setSortKey((cur) => {
      if (cur === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else setSortDir("desc");
      return k;
    });
  const icon = (k: typeof sortKey) => (sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "↕");
  return (
    <div className="space-y-2">
      <div className="space-y-2 md:hidden">
        {sorted.map((h) => {
          const val = h.shares * (h.lastPrice ?? 0);
          const pct = accountTotal > 0 ? (val / accountTotal) * 100 : 0;
          return (
            <article key={h.id} className="rounded-lg border border-(--card-border) bg-(--background) p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-sm font-semibold">{h.symbol}</span>
                <span className="text-sm font-medium">{accountTotal > 0 ? `${pct.toFixed(1)}%` : "—"}</span>
              </div>
              <div className="grid grid-cols-2 gap-y-1 text-xs">
                <span className="text-(--muted)">Shares</span>
                <span className="text-right font-mono">{formatNumber(h.shares, 4)}</span>
                <span className="text-(--muted)">Last price</span>
                <span className="text-right">{formatUsd(h.lastPrice)}</span>
                <span className="text-(--muted)">Value</span>
                <span className="text-right font-medium">{formatUsd(val)}</span>
              </div>
              {(onEditShares || onRemove) && (
                <div className="mt-3 flex flex-wrap items-center justify-end gap-1">
                  {onEditShares && <EditShares id={h.id} current={h.shares} onSave={onEditShares} />}
                  {onRemove && (
                    <button
                      type="button"
                      onClick={() => onRemove(h.id)}
                      className="rounded border border-red-900/30 px-2 py-0.5 text-xs text-red-600 dark:text-red-400"
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-(--card-border) md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-(--card) text-(--muted)">
            <tr>
              <th className="p-2 font-medium"><button type="button" onClick={() => sort("symbol")}>Ticker {icon("symbol")}</button></th>
              <th className="p-2 text-right font-medium"><button type="button" onClick={() => sort("shares")}>Shares {icon("shares")}</button></th>
              <th className="p-2 text-right font-medium"><button type="button" onClick={() => sort("price")}>Last price {icon("price")}</button></th>
              <th className="p-2 text-right font-medium"><button type="button" onClick={() => sort("value")}>Value {icon("value")}</button></th>
              <th className="p-2 text-right font-medium"><button type="button" onClick={() => sort("pct")}>% of Account {icon("pct")}</button></th>
              {(onEditShares || onRemove) && <th className="p-2 w-40" />}
            </tr>
          </thead>
          <tbody>
            {sorted.map((h) => {
              const val = h.shares * (h.lastPrice ?? 0);
              const pct = accountTotal > 0 ? (val / accountTotal) * 100 : 0;
              return (
                <tr key={h.id} className="border-t border-(--card-border)">
                  <td className="p-2 font-mono font-medium">{h.symbol}</td>
                  <td className="p-2 text-right font-mono">{formatNumber(h.shares, 4)}</td>
                  <td className="p-2 text-right">{formatUsd(h.lastPrice)}</td>
                  <td className="p-2 text-right font-medium">{formatUsd(val)}</td>
                  <td className="p-2 text-right">{accountTotal > 0 ? `${pct.toFixed(1)}%` : "—"}</td>
                  {(onEditShares || onRemove) && (
                    <td className="p-2">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {onEditShares && <EditShares id={h.id} current={h.shares} onSave={onEditShares} />}
                        {onRemove && (
                          <button
                            type="button"
                            onClick={() => onRemove(h.id)}
                            className="rounded border border-red-900/30 px-2 py-0.5 text-xs text-red-600 dark:text-red-400"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditShares({ id, current, onSave }: { id: string; current: number; onSave: (id: string, s: number) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(String(current));
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setV(String(current));
          setOpen(true);
        }}
        className="rounded border border-(--card-border) px-2 py-0.5 text-xs hover:bg-(--card)"
      >
        Edit shares
      </button>
    );
  }
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const n = parseFloat(v);
        if (!Number.isNaN(n) && n > 0) onSave(id, n);
        setOpen(false);
      }}
    >
      <input
        type="number"
        min={0.0001}
        step="any"
        className="w-20 rounded border border-(--card-border) bg-(--background) px-1 py-0.5 text-xs"
        value={v}
        onChange={(e) => setV(e.target.value)}
        autoFocus
      />
      <button type="submit" className="text-xs text-(--accent)">
        Save
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-(--muted)"
      >
        Cancel
      </button>
    </form>
  );
}
