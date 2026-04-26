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
  if (holdings.length === 0) {
    return <p className="text-sm text-(--muted)">No holdings in this list yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-(--card-border)">
      <table className="w-full min-w-[500px] text-left text-sm">
        <thead className="bg-(--card) text-(--muted)">
          <tr>
            <th className="p-2 font-medium">Ticker</th>
            <th className="p-2 text-right font-medium">Shares</th>
            <th className="p-2 text-right font-medium">Last price</th>
            <th className="p-2 text-right font-medium">Value</th>
            <th className="p-2 text-right font-medium">% of Account</th>
            {(onEditShares || onRemove) && <th className="p-2 w-40" />}
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
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
