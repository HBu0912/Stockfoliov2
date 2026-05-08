import { hashPassword, createSessionToken, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; password?: string; name?: string; username?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const name = (body.name ?? "").trim() || null;
    const username = (body.username ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "");
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    if (!username || username.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 valid characters" }, { status: 400 });
    }
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 400 });
    }
    const usernameExists = await prisma.user.findUnique({ where: { username } });
    if (usernameExists) {
      return NextResponse.json({ error: "Username already taken" }, { status: 400 });
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { email, passwordHash, name: name || undefined, username } });
    const token = await createSessionToken(user.id, user.email);
    await setSessionCookie(token);
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, username: user.username } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not create account" }, { status: 500 });
  }
}
