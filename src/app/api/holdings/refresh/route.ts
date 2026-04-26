import { getSession } from "@/lib/auth";
import { fetchQuote } from "@/lib/market";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const holdings = await prisma.holding.findMany({
    where: { account: { userId: s.userId } },
    include: { account: true },
  });

  if (holdings.length === 0) {
    return NextResponse.json({ updatedCount: 0, skippedCount: 0 });
  }

  const uniqueSymbols = [...new Set(holdings.map((h) => h.symbol.toUpperCase()))];
  const quoteMap = new Map<string, Awaited<ReturnType<typeof fetchQuote>>>();
  const failed = new Set<string>();

  await Promise.all(
    uniqueSymbols.map(async (symbol) => {
      try {
        const q = await fetchQuote(symbol);
        quoteMap.set(symbol, q);
      } catch {
        failed.add(symbol);
      }
    })
  );

  let updatedCount = 0;
  const updates = holdings
    .map((h) => {
      const q = quoteMap.get(h.symbol.toUpperCase());
      if (!q) return null;
      updatedCount += 1;
      return prisma.holding.update({
        where: { id: h.id },
        data: {
          symbol: q.symbol,
          name: q.name,
          lastPrice: q.price,
          marketCap: q.marketCap,
          marketCapText: q.marketCapText,
        },
      });
    })
    .filter((x): x is ReturnType<typeof prisma.holding.update> => x !== null);

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }

  const skippedCount = holdings.length - updatedCount;
  return NextResponse.json({
    updatedCount,
    skippedCount,
    failedSymbols: [...failed],
  });
}
