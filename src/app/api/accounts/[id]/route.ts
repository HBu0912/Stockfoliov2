import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const acc = await prisma.account.findFirst({
    where: { id, userId: s.userId },
    include: { holdings: { orderBy: { symbol: "asc" } } },
  });
  if (!acc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ account: acc });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const n = await prisma.account.deleteMany({ where: { id, userId: s.userId } });
  if (n.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
