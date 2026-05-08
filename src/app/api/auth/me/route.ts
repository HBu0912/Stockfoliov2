import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ user: null });
  const u = await prisma.user.findUnique({
    where: { id: s.userId },
    select: { id: true, email: true, name: true, username: true },
  });
  if (!u) return NextResponse.json({ user: null });
  return NextResponse.json({ user: u });
}
