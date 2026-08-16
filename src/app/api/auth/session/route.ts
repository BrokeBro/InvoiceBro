import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/auth";

// The Admin SDK needs Node, not Edge.
export const runtime = "nodejs";

/**
 * Exchange a Firebase ID token for an httpOnly session cookie.
 *
 * Why a session cookie rather than holding the ID token in the browser: ID
 * tokens live in JavaScript-reachable storage and expire after an hour, which
 * means either XSS exposure or constant refresh plumbing. A session cookie is
 * httpOnly (invisible to scripts), sameSite=lax (not sent on cross-site POSTs),
 * and independently revocable server-side.
 */
export async function POST(request: Request) {
  let idToken: string;

  try {
    const body = (await request.json()) as { idToken?: string };
    if (!body.idToken) throw new Error("missing idToken");
    idToken = body.idToken;
  } catch {
    return NextResponse.json({ error: "idToken is required" }, { status: 400 });
  }

  try {
    // Verify before minting. Without this, any string could become a session.
    const decoded = await adminAuth().verifyIdToken(idToken, true);

    // Guard against a stale token being replayed long after sign-in.
    const ageSeconds = Date.now() / 1000 - decoded.auth_time;
    if (ageSeconds > 5 * 60) {
      return NextResponse.json(
        { error: "Sign-in is stale, please try again" },
        { status: 401 },
      );
    }

    const sessionCookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: SESSION_COOKIE,
      value: sessionCookie,
      maxAge: SESSION_MAX_AGE_MS / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Invalid sign-in" }, { status: 401 });
  }
}

/** Sign out: clear the cookie. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    maxAge: 0,
    path: "/",
  });
  return response;
}
