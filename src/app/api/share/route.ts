import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type ShareTarget = "arena" | "user";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    targetType?: ShareTarget;
    targetId?: string;
    title?: string;
    url?: string;
    note?: string;
  };
  const targetType = body.targetType;
  const targetId = (body.targetId ?? "").trim();
  const title = (body.title ?? "Shared content").trim();
  const url = (body.url ?? "").trim();
  const note = (body.note ?? "").trim();
  if (!targetType || !targetId || !url) {
    return NextResponse.json({ error: "targetType, targetId, and url are required" }, { status: 400 });
  }
  const content = `${title}${note ? ` — ${note}` : ""}`;

  if (targetType === "arena") {
    const membership = await prisma.arenaMember.findFirst({ where: { arenaId: targetId, userId: s.userId } });
    if (!membership) return NextResponse.json({ error: "Not a member of that arena" }, { status: 403 });
    const message = await prisma.arenaMessage.create({
      data: { arenaId: targetId, senderId: s.userId, body: content, shareUrl: url },
    });
    return NextResponse.json({ ok: true, messageId: message.id });
  }

  const [a, b] = await Promise.all([
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: s.userId, followingId: targetId } },
      select: { id: true },
    }),
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: targetId, followingId: s.userId } },
      select: { id: true },
    }),
  ]);
  if (!(a && b)) {
    return NextResponse.json({ error: "Direct sharing requires mutual follow" }, { status: 403 });
  }
  const message = await prisma.directMessage.create({
    data: { senderId: s.userId, recipientId: targetId, body: content, shareUrl: url },
  });
  return NextResponse.json({ ok: true, messageId: message.id });
}
