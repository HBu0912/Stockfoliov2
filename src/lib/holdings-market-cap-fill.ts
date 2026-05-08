import type { Holding } from "@prisma/client";
import { fetchQuoteWithYahooMarketData } from "@/lib/yahoo-quote-enrich";

type HoldingLike = Pick<Holding, "symbol" | "marketCap" | "marketCapText">;

async function runWithConcurrency<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const next = queue.shift();
      if (!next) return;
      await fn(next);
    }
  });
  await Promise.all(workers);
}

/**
 * Fills missing `marketCap` / `marketCapText` on holdings using the same Yahoo quote path as stock analysis.
 * Does not write to the database — used to make list UIs accurate without requiring a manual refresh.
 */
export async function fillHoldingsMarketCapFromYahoo<T extends HoldingLike>(holdings: T[]): Promise<T[]> {
  const need = holdings.filter((h) => h.marketCap == null && !(h.marketCapText ?? "").trim());
  if (need.length === 0) return holdings;

  const uniqueSymbols = [...new Set(need.map((h) => h.symbol.toUpperCase()))];
  const quoteBySymbol = new Map<string, Awaited<ReturnType<typeof fetchQuoteWithYahooMarketData>>>();

  await runWithConcurrency(uniqueSymbols, 8, async (sym) => {
    try {
      const q = await fetchQuoteWithYahooMarketData(sym);
      quoteBySymbol.set(sym, q);
    } catch {
      // ignore per-symbol failures
    }
  });

  return holdings.map((h) => {
    if (h.marketCap != null) return h;
    const q = quoteBySymbol.get(h.symbol.toUpperCase());
    if (!q) return h;
    if (q.marketCap == null && !(q.marketCapText ?? "").trim()) return h;
    return {
      ...h,
      marketCap: q.marketCap ?? h.marketCap,
      marketCapText: q.marketCapText ?? h.marketCapText,
    };
  });
}
