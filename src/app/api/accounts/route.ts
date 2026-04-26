import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const accounts = await prisma.account.findMany({
    where: { userId: s.userId },
    orderBy: { createdAt: "asc" },
    include: {
      holdings: true,
    },
  });
  return NextResponse.json({ accounts });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as { name?: string };
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Account name is required" }, { status: 400 });
  }
  const acc = await prisma.account.create({ data: { userId: s.userId, name } });
  return NextResponse.json({ account: acc });
}
