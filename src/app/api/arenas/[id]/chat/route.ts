import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const membership = await prisma.arenaMember.findFirst({ where: { arenaId: id, userId: s.userId } });
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });
  await prisma.arenaMember.updateMany({
    where: { arenaId: id, userId: s.userId },
    data: { lastReadChatAt: new Date() },
  });

  const messages = await prisma.arenaMessage.findMany({
    where: { arenaId: id },
    orderBy: { createdAt: "asc" },
    take: 300,
    include: { sender: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json({ messages });
}

export async function POST(req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const membership = await prisma.arenaMember.findFirst({ where: { arenaId: id, userId: s.userId } });
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { body?: string; shareUrl?: string };
  const text = (body.body ?? "").trim();
  const shareUrl = (body.shareUrl ?? "").trim() || null;
  if (!text && !shareUrl) return NextResponse.json({ error: "Message is required" }, { status: 400 });
  const msg = await prisma.arenaMessage.create({
    data: { arenaId: id, senderId: s.userId, body: text || "Shared content", shareUrl },
    include: { sender: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json({ message: msg });
}
