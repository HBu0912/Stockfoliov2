import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as { code?: string };
  const code = (body.code ?? "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "Join code is required" }, { status: 400 });
  const arena = await prisma.arena.findUnique({ where: { joinCode: code } });
  if (!arena) return NextResponse.json({ error: "No arena with that code" }, { status: 404 });
  await prisma.arenaMember.upsert({
    where: { arenaId_userId: { arenaId: arena.id, userId: s.userId } },
    create: { arenaId: arena.id, userId: s.userId },
    update: {},
  });
  return NextResponse.json({ arena });
}
