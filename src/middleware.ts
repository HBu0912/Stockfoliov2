import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  if (!req.cookies.get("fin_session")) {
    const login = new URL("/login", req.url);
    const next = req.nextUrl.pathname + req.nextUrl.search;
    login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/overview",
    "/overview/:path*",
    "/accounts",
    "/accounts/:path*",
    "/feed",
    "/feed/:path*",
    "/arena",
    "/arena/:path*",
    "/profile",
    "/profile/:path*",
    "/chats",
    "/chats/:path*",
    "/stock-analysis",
    "/stock-analysis/:path*",
    "/stock-comparison",
    "/stock-comparison/:path*",
    "/calendar",
    "/calendar/:path*",
  ],
};