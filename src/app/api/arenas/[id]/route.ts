import { aggregateBySymbol } from "@/lib/allocations";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const member = await prisma.arenaMember.findFirst({ where: { arenaId: id, userId: s.userId } });
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });
  const arena = await prisma.arena.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });
  if (!arena) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const userIds = arena.members.map((m) => m.userId);
  const accounts = await prisma.account.findMany({
    where: { userId: { in: userIds } },
    include: { holdings: true },
  });
  const byUser = new Map<string, typeof accounts>();
  for (const a of accounts) {
    const list = byUser.get(a.userId) ?? [];
    list.push(a);
    byUser.set(a.userId, list);
  }
  const portfolios = arena.members.map((m) => {
    const accs = byUser.get(m.userId) ?? [];
    const flat = accs.flatMap((a) => a.holdings);
    const rows = aggregateBySymbol(flat);
    return {
      user: m.user,
      rows,
    };
  });
  return NextResponse.json({ arena: { id: arena.id, name: arena.name, joinCode: arena.joinCode }, portfolios });
}
