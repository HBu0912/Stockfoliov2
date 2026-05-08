import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [followingRows, followerRows] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: s.userId },
      include: { following: { select: { id: true, name: true, email: true, username: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.follow.findMany({
      where: { followingId: s.userId },
      include: { follower: { select: { id: true, name: true, email: true, username: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    following: followingRows.map((row) => row.following),
    followers: followerRows.map((row) => row.follower),
  });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { userId?: string };
  const userId = (body.userId ?? "").trim();
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  if (userId === s.userId) return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: s.userId, followingId: userId } },
    create: { followerId: s.userId, followingId: userId },
    update: {},
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { userId?: string };
  const userId = (body.userId ?? "").trim();
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  await prisma.follow.deleteMany({ where: { followerId: s.userId, followingId: userId } });
  return NextResponse.json({ ok: true });
}
