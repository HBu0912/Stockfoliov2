import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { userIds?: string[]; name?: string };
  const userIds = [...new Set((body.userIds ?? []).map((x) => (x ?? "").trim()).filter(Boolean))].filter(
    (id) => id !== s.userId
  );
  if (userIds.length === 0) return NextResponse.json({ error: "At least one user is required" }, { status: 400 });

  // must mutually follow every selected participant
  for (const otherId of userIds) {
    const [a, b] = await Promise.all([
      prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: s.userId, followingId: otherId } },
        select: { id: true },
      }),
      prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: otherId, followingId: s.userId } },
        select: { id: true },
      }),
    ]);
    if (!(a && b)) {
      return NextResponse.json({ error: "All users must be mutual followers" }, { status: 403 });
    }
  }

  // reuse existing 1:1 conversation if possible
  if (userIds.length === 1) {
    const existing = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        participants: {
          every: { userId: { in: [s.userId, userIds[0]] } },
        },
      },
      include: { participants: true },
    });
    if (existing && existing.participants.length === 2) {
      return NextResponse.json({ conversationId: existing.id, reused: true });
    }
  }

  const conv = await prisma.conversation.create({
    data: {
      name: (body.name ?? "").trim() || null,
      isGroup: userIds.length > 1,
      createdById: s.userId,
      participants: {
        create: [{ userId: s.userId, lastReadAt: new Date() }, ...userIds.map((id) => ({ userId: id }))],
      },
    },
  });
  return NextResponse.json({ conversationId: conv.id });
}
