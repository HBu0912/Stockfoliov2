import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, userId } = await params;
  const arena = await prisma.arena.findUnique({ where: { id } });
  if (!arena) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (arena.createdById !== s.userId) {
    return NextResponse.json({ error: "Only the creator can remove members" }, { status: 403 });
  }
  if (userId === s.userId) {
    return NextResponse.json({ error: "Creator cannot remove themself" }, { status: 400 });
  }
  await prisma.arenaMember.deleteMany({ where: { arenaId: id, userId } });
  return NextResponse.json({ ok: true });
}
