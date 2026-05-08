import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

function normSymbol(s: string) {
  return s.trim().toUpperCase();
}

export async function GET(_req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: arenaId } = await params;
  const member = await prisma.arenaMember.findFirst({ where: { arenaId, userId: s.userId } });
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const votes = await prisma.arenaStockVote.findMany({
    where: { arenaId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { updatedAt: "desc" },
  });

  type Sym = {
    tallies: Record<1 | 2 | 3 | 4 | 5, number>;
    myVote: number | null;
    voters: Array<{ userId: string; name: string; rating: number }>;
  };
  const bySymbol = new Map<string, Sym>();

  for (const v of votes) {
    const sym = normSymbol(v.symbol);
    if (!/^[A-Z][A-Z0-9.\-]{0,14}$/.test(sym)) continue;
    const r = v.rating as 1 | 2 | 3 | 4 | 5;
    if (r < 1 || r > 5) continue;
    let slot = bySymbol.get(sym);
    if (!slot) {
      slot = {
        tallies: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        myVote: null,
        voters: [],
      };
      bySymbol.set(sym, slot);
    }
    slot.tallies[r] += 1;
    const label = v.user.name || v.user.email.split("@")[0] || "Member";
    slot.voters.push({ userId: v.userId, name: label, rating: r });
    if (v.userId === s.userId) slot.myVote = r;
  }

  for (const [, slot] of bySymbol) {
    const seen = new Set<string>();
    slot.voters = slot.voters.filter((x) => {
      if (seen.has(x.userId)) return false;
      seen.add(x.userId);
      return true;
    });
    slot.voters.sort((a, b) => a.name.localeCompare(b.name));
  }

  return NextResponse.json({ bySymbol: Object.fromEntries(bySymbol) });
}

export async function POST(req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: arenaId } = await params;
  const member = await prisma.arenaMember.findFirst({ where: { arenaId, userId: s.userId } });
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const body = (await req.json()) as { symbol?: string; rating?: number };
  const symbol = normSymbol(body.symbol ?? "");
  const rating = Math.round(Number(body.rating));
  if (!symbol || !/^[A-Z][A-Z0-9.\-]{0,14}$/.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be 1–5" }, { status: 400 });
  }

  const row = await prisma.arenaStockVote.upsert({
    where: { arenaId_userId_symbol: { arenaId, userId: s.userId, symbol } },
    create: { arenaId, userId: s.userId, symbol, rating },
    update: { rating },
  });

  return NextResponse.json({ vote: row });
}
