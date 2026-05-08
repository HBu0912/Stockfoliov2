import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

async function assertParticipant(conversationId: string, userId: string) {
  return prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true },
  });
}

export async function GET(_req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const member = await assertParticipant(id, s.userId);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId: id, userId: s.userId } },
    data: { lastReadAt: new Date() },
  });

  const [conversation, messages] = await Promise.all([
    prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: { include: { user: { select: { id: true, name: true, username: true, email: true } } } },
      },
    }),
    prisma.conversationMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
      take: 300,
      include: { sender: { select: { id: true, name: true, username: true, email: true } } },
    }),
  ]);
  return NextResponse.json({ conversation, messages });
}

export async function POST(req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const member = await assertParticipant(id, s.userId);
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { body?: string; shareUrl?: string };
  const text = (body.body ?? "").trim();
  const shareUrl = (body.shareUrl ?? "").trim() || null;
  if (!text && !shareUrl) return NextResponse.json({ error: "Message is required" }, { status: 400 });

  const msg = await prisma.conversationMessage.create({
    data: { conversationId: id, senderId: s.userId, body: text || "Shared content", shareUrl },
    include: { sender: { select: { id: true, name: true, username: true, email: true } } },
  });
  return NextResponse.json({ message: msg });
}
