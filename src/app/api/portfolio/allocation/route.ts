import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("symbol") ?? "").trim().toUpperCase();
  if (!raw) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const accounts = await prisma.account.findMany({
    where: { userId: s.userId },
    include: { holdings: true },
  });

  let portfolioValue = 0;
  let positionValue = 0;
  for (const a of accounts) {
    for (const h of a.holdings) {
      const mv = h.shares * (h.lastPrice ?? 0);
      portfolioValue += mv;
      if (h.symbol.toUpperCase() === raw) positionValue += mv;
    }
  }

  const inPortfolio = positionValue > 0;
  const allocationPct =
    portfolioValue > 0 && inPortfolio ? (positionValue / portfolioValue) * 100 : null;

  return NextResponse.json({
    symbol: raw,
    inPortfolio,
    allocationPct,
    positionValue,
    portfolioValue,
  });
}
