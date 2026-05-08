import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [participants, arenaMemberships] = await Promise.all([
    prisma.conversationParticipant.findMany({
      where: { userId: s.userId },
      include: {
        conversation: {
          include: {
            participants: { include: { user: { select: { id: true, name: true, username: true, email: true } } } },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    }),
    prisma.arenaMember.findMany({
      where: { userId: s.userId },
      include: { arena: { select: { id: true, name: true } } },
      orderBy: { joinedAt: "desc" },
    }),
  ]);

  const individuals = participants
    .filter((p) => !p.conversation.isGroup)
    .map((p) => {
      const other = p.conversation.participants.find((x) => x.userId !== s.userId)?.user;
      return {
        conversationId: p.conversationId,
        user: other ?? null,
        unreadCount: 0,
      };
    })
    .filter((x) => x.user);

  const groups = participants
    .filter((p) => p.conversation.isGroup)
    .map((p) => ({
      conversationId: p.conversationId,
      name: p.conversation.name || "Group chat",
      memberCount: p.conversation.participants.length,
      unreadCount: 0,
    }));

  // unread for conversations
  if (participants.length > 0) {
    const counts = await Promise.all(
      participants.map(async (p) => {
        const unread = await prisma.conversationMessage.count({
          where: {
            conversationId: p.conversationId,
            senderId: { not: s.userId },
            createdAt: p.lastReadAt ? { gt: p.lastReadAt } : undefined,
          },
        });
        return { id: p.conversationId, unread };
      })
    );
    const map = new Map(counts.map((c) => [c.id, c.unread]));
    for (const t of individuals) t.unreadCount = map.get(t.conversationId) ?? 0;
    for (const t of groups) t.unreadCount = map.get(t.conversationId) ?? 0;
  }

  const arenas = await Promise.all(
    arenaMemberships.map(async (m) => {
      const unreadCount = await prisma.arenaMessage.count({
        where: {
          arenaId: m.arenaId,
          senderId: { not: s.userId },
          createdAt: m.lastReadChatAt ? { gt: m.lastReadChatAt } : undefined,
        },
      });
      return { id: m.arena.id, name: m.arena.name, unreadCount };
    })
  );

  return NextResponse.json({ individuals, groups, arenas });
}
