import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "fin_session";
const maxAge = 60 * 60 * 24 * 7; // 7d

function getSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s) return new TextEncoder().encode("dev-unsafe-secret-change-in-env");
  return new TextEncoder().encode(s);
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function createSessionToken(userId: string, email: string) {
  return new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret());
  return { userId: payload.sub as string, email: payload.email as string };
}

export async function getSession() {
  const c = await cookies();
  const t = c.get(COOKIE)?.value;
  if (!t) return null;
  try {
    return await verifySessionToken(t);
  } catch {
    return null;
  }
}

export async function requireUser() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function setSessionCookie(token: string) {
  const c = await cookies();
  c.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSession() {
  const c = await cookies();
  c.delete(COOKIE);
}
