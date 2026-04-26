import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  if (!req.cookies.get("fin_session")) {
    return NextResponse.redirect(new URL("/login", req.url));
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
  ],
};