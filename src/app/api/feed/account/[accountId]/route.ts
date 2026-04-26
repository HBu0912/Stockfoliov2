import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ accountId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { accountId } = await params;
  const acc = await prisma.account.findFirst({ where: { id: accountId, userId: s.userId } });
  if (!acc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const items = await prisma.accountFeedEvent.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ items });
}
