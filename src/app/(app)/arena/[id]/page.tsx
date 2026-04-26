"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Row = { label: string; name: string; value: number; pct: number };
type P = { user: { id: string; name: string | null; email: string }; rows: Row[] };
type D = { arena: { id: string; name: string; joinCode: string }; portfolios: P[] };

export default function ArenaDetailPage() {
  const { id } = useParams() as { id: string };
  const [data, setData] = useState<D | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const r = await fetch(`/api/arenas/${id}`);
    if (!r.ok) {
      setErr("Could not open arena (members only)");
      return;
    }
    const d = (await r.json()) as D;
    setData(d);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (err && !data) {
    return (
      <div>
        <p className="text-red-600">{err}</p>
        <Link href="/arena" className="text-(--accent)">
          Back
        </Link>
      </div>
    );
  }
  if (!data) {
    return <p className="text-(--muted)">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/arena" className="text-sm text-(--accent)">
          ← All arenas
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{data.arena.name}</h1>
        <p className="text-(--muted) text-sm">Invite with code: <code className="font-mono">{data.arena.joinCode}</code></p>
      </div>
      <p className="text-(--muted) text-sm">Each person&rsquo;s table shows % of their combined named accounts, grouped by symbol.</p>
      {data.portfolios.length === 0 && <p className="text-(--muted)">No members yet (unexpected).</p>}
      {data.portfolios.map((p) => {
        const who = p.user.name || p.user.email;
        return (
          <div key={p.user.id} className="rounded-xl border border-(--card-border) bg-(--card) p-4">
            <h2 className="text-lg font-medium">{who}</h2>
            {p.rows.length === 0 ? (
              <p className="text-(--muted) text-sm">No holdings to compare.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[360px] text-left text-sm">
                  <thead className="text-(--muted)">
                    <tr>
                      <th className="p-2">Symbol</th>
                      <th className="p-2">Name</th>
                      <th className="p-2 text-right">% of their portfolio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.rows.map((r) => (
                      <tr key={r.label} className="border-t border-(--card-border)">
                        <td className="p-2 font-mono font-medium">{r.label}</td>
                        <td className="p-2 max-w-[200px] truncate" title={r.name}>
                          {r.name}
                        </td>
                        <td className="p-2 text-right tabular-nums">{r.pct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
