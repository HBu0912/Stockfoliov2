import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordHoldingPositionChange } from "@/lib/record-feed";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as { accountId?: string; symbol?: string; shares?: number };
  const accountId = body.accountId?.trim() ?? "";
  const sym = (body.symbol ?? "").trim().toUpperCase();
  const shares = body.shares;
  if (!accountId || !sym || typeof shares !== "number" || shares < 0) {
    return NextResponse.json({ error: "accountId, symbol, and non-negative shares are required" }, { status: 400 });
  }
  if (shares === 0) {
    return NextResponse.json({ error: "Use remove / sell down to 0 to close a line" }, { status: 400 });
  }
  const acc = await prisma.account.findFirst({ where: { id: accountId, userId: s.userId } });
  if (!acc) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  const existing = await prisma.holding.findFirst({ where: { accountId, symbol: sym } });
  if (existing) {
    const oldS = existing.shares;
    const newS = oldS + shares;
    const h = await prisma.holding.update({
      where: { id: existing.id },
      data: { shares: newS },
    });
    await recordHoldingPositionChange(
      s.userId,
      oldS,
      newS,
      h.symbol,
      h.name,
      acc.id,
      acc.name
    );
    return NextResponse.json({ holding: h, merged: true });
  }
  const h = await prisma.holding.create({
    data: {
      accountId: acc.id,
      symbol: sym,
      name: sym,
      shares,
      lastPrice: null,
      marketCap: null,
      marketCapText: null,
    },
  });
  await recordHoldingPositionChange(s.userId, 0, shares, h.symbol, h.name, acc.id, acc.name);
  return NextResponse.json({ holding: h, merged: false });
}
