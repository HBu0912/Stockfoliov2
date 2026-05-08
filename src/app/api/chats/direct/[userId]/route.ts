import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ userId: string }> };

async function canChat(myId: string, otherId: string) {
  const [a, b] = await Promise.all([
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: myId, followingId: otherId } },
      select: { id: true },
    }),
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: otherId, followingId: myId } },
      select: { id: true },
    }),
  ]);
  return Boolean(a && b);
}

export async function GET(_req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = await params;
  if (!(await canChat(s.userId, userId))) {
    return NextResponse.json({ error: "You can only chat with friends/followed users" }, { status: 403 });
  }
  const messages = await prisma.directMessage.findMany({
    where: {
      OR: [
        { senderId: s.userId, recipientId: userId },
        { senderId: userId, recipientId: s.userId },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { sender: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json({ messages });
}

export async function POST(req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = await params;
  if (!(await canChat(s.userId, userId))) {
    return NextResponse.json({ error: "You can only chat with friends/followed users" }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { body?: string; shareUrl?: string };
  const text = (body.body ?? "").trim();
  const shareUrl = (body.shareUrl ?? "").trim() || null;
  if (!text && !shareUrl) return NextResponse.json({ error: "Message is required" }, { status: 400 });
  const msg = await prisma.directMessage.create({
    data: { senderId: s.userId, recipientId: userId, body: text || "Shared content", shareUrl },
    include: { sender: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json({ message: msg });
}
