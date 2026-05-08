import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aggregateBySymbol } from "@/lib/allocations";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, username: true, email: true },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [a, b, sharedArena] = await Promise.all([
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: s.userId, followingId: id } },
      select: { id: true },
    }),
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: id, followingId: s.userId } },
      select: { id: true },
    }),
    prisma.arenaMember.findFirst({
      where: { userId: s.userId, arena: { members: { some: { userId: id } } } },
      select: { id: true },
    }),
  ]);
  if (!(sharedArena || (a && b))) {
    return NextResponse.json({ error: "Not authorized to view this profile" }, { status: 403 });
  }

  const accounts = await prisma.account.findMany({ where: { userId: id }, include: { holdings: true } });
  const rows = aggregateBySymbol(accounts.flatMap((a) => a.holdings)).slice(0, 12);
  return NextResponse.json({ user: target, rows });
}
