import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";

// This is Next 16's `proxy` convention (formerly `middleware`).
//
// It runs on the Edge runtime, where firebase-admin cannot run — so it only
// checks that a session cookie is *present*, as a cheap redirect for
// obviously-signed-out visitors. It is not a security boundary and must never
// be treated as one: the real verification is verifySessionCookie() in
// src/lib/auth.ts, which every page and action calls server-side.
export default function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const { pathname, search } = request.nextUrl;

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Protect the app surface. Public routes (/login, /p/[token] for the client
  // portal), the auth API, and static assets are all excluded.
  matcher: ["/dashboard/:path*", "/clients/:path*", "/invoices/:path*", "/settings/:path*"],
};
