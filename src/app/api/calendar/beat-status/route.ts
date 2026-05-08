import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import yahooFinance from "yahoo-finance2";

type EarningsHistoryItem = {
  epsActual?: number | null;
  epsEstimate?: number | null;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "object" && value !== null) {
    const raw = (value as { raw?: unknown }).raw;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  }
  return null;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { symbols?: string[] };
  const symbols = [...new Set((body.symbols ?? []).map((s) => String(s).trim().toUpperCase()).filter(Boolean))].slice(0, 150);
  if (!symbols.length) return NextResponse.json({ statuses: {} });

  const statuses: Record<
    string,
    { status: "beat" | "miss" | "unknown"; actual: number | null; estimate: number | null }
  > = {};
  const queue = [...symbols];
  const concurrency = 6;

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const symbol = queue.shift();
      if (!symbol) return;
      try {
        const summary = (await yahooFinance.quoteSummary(symbol, {
          modules: ["earningsHistory"],
        })) as {
          earningsHistory?: {
            history?: EarningsHistoryItem[];
          };
        };
        const history = Array.isArray(summary.earningsHistory?.history) ? summary.earningsHistory.history : [];
        const latest = history.find((h) => toNumber(h.epsActual) != null && toNumber(h.epsEstimate) != null);
        const actual = toNumber(latest?.epsActual);
        const estimate = toNumber(latest?.epsEstimate);
        if (actual == null || estimate == null) {
          statuses[symbol] = { status: "unknown", actual: null, estimate: null };
        } else {
          statuses[symbol] = {
            status: actual >= estimate ? "beat" : "miss",
            actual,
            estimate,
          };
        }
      } catch {
        statuses[symbol] = { status: "unknown", actual: null, estimate: null };
      }
    }
  });
  await Promise.all(workers);

  return NextResponse.json({ statuses });
}
