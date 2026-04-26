import { getSession } from "@/lib/auth";
import { fetchQuote } from "@/lib/market";
import { prisma } from "@/lib/prisma";
import { deleteHoldingWithFeed, recordHoldingPositionChange } from "@/lib/record-feed";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as { shares?: number; refresh?: boolean };
  const holding = await prisma.holding.findFirst({
    where: { id },
    include: { account: true },
  });
  if (!holding || holding.account.userId !== s.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (body.refresh) {
    let q;
    try {
      q = await fetchQuote(holding.symbol);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Could not refresh quote";
      return NextResponse.json({ error: m }, { status: 400 });
    }
    const updated = await prisma.holding.update({
      where: { id },
      data: {
        name: q.name,
        lastPrice: q.price,
        marketCap: q.marketCap,
        marketCapText: q.marketCapText,
      },
    });
    return NextResponse.json({ holding: updated });
  }
  if (typeof body.shares !== "number" || body.shares <= 0) {
    return NextResponse.json(
      { error: "shares must be greater than 0 (use Remove to fully exit)." },
      { status: 400 }
    );
  }
  const newShares = body.shares;
  const oldShares = holding.shares;
  const updated = await prisma.holding.update({
    where: { id },
    data: { shares: newShares },
  });
  await recordHoldingPositionChange(
    s.userId,
    oldShares,
    newShares,
    updated.symbol,
    updated.name,
    holding.accountId,
    holding.account.name
  );
  return NextResponse.json({ holding: updated });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const holding = await prisma.holding.findFirst({ where: { id }, include: { account: true } });
  if (!holding || holding.account.userId !== s.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await deleteHoldingWithFeed(
    s.userId,
    { id: holding.id, accountId: holding.accountId, symbol: holding.symbol, name: holding.name, shares: holding.shares },
    holding.account.name
  );
  return NextResponse.json({ ok: true });
}
