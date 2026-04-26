import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function randomCode(len = 7) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const memberships = await prisma.arenaMember.findMany({
    where: { userId: s.userId },
    include: { arena: true },
    orderBy: { joinedAt: "desc" },
  });
  return NextResponse.json({ arenas: memberships.map((m) => m.arena) });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as { name?: string };
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Arena name is required" }, { status: 400 });
  let joinCode = randomCode();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.arena.findUnique({ where: { joinCode } });
    if (!clash) break;
    joinCode = randomCode();
  }
  const arena = await prisma.arena.create({
    data: { name, joinCode, createdById: s.userId },
  });
  await prisma.arenaMember.create({ data: { arenaId: arena.id, userId: s.userId } });
  return NextResponse.json({ arena });
}
