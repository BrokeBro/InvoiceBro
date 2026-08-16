import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { MemberRole, Organization, UserProfile } from "@/lib/types";
import { DEFAULT_ORGANIZATION } from "@/lib/defaults";

export const SESSION_COOKIE = "__session";
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

export type SessionUser = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
};

/**
 * The current user, or null. Verifies the session cookie against Firebase on
 * every call — `checkRevoked` means a disabled or signed-out account stops
 * working immediately rather than when the cookie happens to expire.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (!session) return null;

  try {
    const claims = await adminAuth().verifySessionCookie(session, true);
    return {
      uid: claims.uid,
      email: claims.email ?? "",
      displayName: (claims.name as string) ?? "",
      photoURL: (claims.picture as string) ?? "",
    };
  } catch {
    // Expired, revoked or tampered-with. Treat as signed out.
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * THE TENANCY BOUNDARY.
 *
 * Every server action and every page that touches org-scoped data must call
 * this before reading or writing anything. It answers one question: is this
 * user a member of this organization? Because the Admin SDK bypasses all
 * Firestore rules, this check is the only thing standing between one customer's
 * data and another's — so it is a hard failure, never a soft one.
 */
export async function requireOrg(orgId: string): Promise<{
  user: SessionUser;
  orgId: string;
  role: MemberRole;
}> {
  const user = await requireUser();

  const membership = await adminDb()
    .doc(`organizations/${orgId}/members/${user.uid}`)
    .get();

  if (!membership.exists) {
    // Deliberately "not found", not "forbidden": a stranger should not be able
    // to learn that an org ID exists by probing it.
    notFoundError();
  }

  return {
    user,
    orgId,
    role: (membership.data()?.role as MemberRole) ?? "member",
  };
}

function notFoundError(): never {
  const error = new Error("Not found");
  (error as Error & { digest?: string }).digest = "NEXT_NOT_FOUND";
  throw error;
}

/**
 * Resolve the user's active organization, creating their profile and a personal
 * organization on first sign-in.
 *
 * Bootstrapping here rather than in the sign-in route means a user who somehow
 * arrives with a valid session but no profile (a deleted doc, a failed first
 * run) self-heals instead of hitting a dead end.
 */
export async function requireCurrentOrg(): Promise<{
  user: SessionUser;
  profile: UserProfile;
  org: Organization;
  role: MemberRole;
}> {
  const user = await requireUser();
  const db = adminDb();
  const userRef = db.doc(`users/${user.uid}`);
  const snapshot = await userRef.get();

  let profile = snapshot.data() as UserProfile | undefined;

  if (!profile || !profile.defaultOrgId) {
    profile = await bootstrapUser(user);
  }

  const orgSnapshot = await db.doc(`organizations/${profile.defaultOrgId}`).get();
  if (!orgSnapshot.exists) {
    // Profile points at an org that no longer exists — rebuild rather than 500.
    profile = await bootstrapUser(user);
    const rebuilt = await db.doc(`organizations/${profile.defaultOrgId}`).get();
    return {
      user,
      profile,
      org: { id: rebuilt.id, ...rebuilt.data() } as Organization,
      role: "owner",
    };
  }

  const { role } = await requireOrg(profile.defaultOrgId);

  return {
    user,
    profile,
    org: { id: orgSnapshot.id, ...orgSnapshot.data() } as Organization,
    role,
  };
}

async function bootstrapUser(user: SessionUser): Promise<UserProfile> {
  const db = adminDb();
  const orgRef = db.collection("organizations").doc();
  const now = new Date().toISOString();

  const orgName = user.displayName ? `${user.displayName}'s Business` : "My Business";

  const batch = db.batch();

  batch.set(orgRef, {
    ...DEFAULT_ORGANIZATION,
    name: orgName,
    email: user.email,
    createdAt: now,
  });

  batch.set(orgRef.collection("members").doc(user.uid), {
    role: "owner",
    email: user.email,
    displayName: user.displayName,
    joinedAt: now,
  });

  const profile: UserProfile = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    orgIds: [orgRef.id],
    defaultOrgId: orgRef.id,
  };

  batch.set(db.doc(`users/${user.uid}`), profile, { merge: true });

  await batch.commit();

  return profile;
}
