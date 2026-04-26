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
  const feeds = await prisma.feedEvent.findMany({
    where: { userId: { in: userIds } },
    orderBy: { createdAt: "desc" },
    take: 120,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json({
    arena: {
      id: arena.id,
      name: arena.name,
      joinCode: arena.joinCode,
      createdById: arena.createdById,
      meId: s.userId,
      isCreator: arena.createdById === s.userId,
    },
    portfolios,
    feeds,
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const arena = await prisma.arena.findUnique({ where: { id } });
  if (!arena) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (arena.createdById !== s.userId) {
    return NextResponse.json({ error: "Only the creator can rename this arena" }, { status: 403 });
  }
  const body = (await req.json()) as { name?: string };
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const updated = await prisma.arena.update({ where: { id }, data: { name } });
  return NextResponse.json({ arena: updated });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const arena = await prisma.arena.findUnique({ where: { id } });
  if (!arena) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (arena.createdById !== s.userId) {
    return NextResponse.json({ error: "Only the creator can delete this arena" }, { status: 403 });
  }
  await prisma.arena.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
