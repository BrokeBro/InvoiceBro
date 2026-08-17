/**
 * End-to-end test of the server-side auth path, against live Firebase.
 *
 * The main smoke test covers Firestore but never touches Firebase Auth's admin
 * APIs, which is exactly where sign-in was failing. This closes that gap by
 * driving the real sequence /api/auth/session performs:
 *
 *   verifyIdToken(idToken)  ->  createSessionCookie(idToken)  ->  verifySessionCookie(cookie)
 *
 * A real ID token normally comes from a browser Google sign-in. We get one
 * without a browser by minting a custom token with the Admin SDK and exchanging
 * it for an ID token through the Identity Toolkit REST API — the same endpoint
 * the client SDK uses. The resulting token is a genuine one, so the admin calls
 * under test are exercised for real rather than mocked.
 *
 *   npx tsx --env-file=.env.local scripts/smoke-auth.ts
 *
 * Deletes the throwaway user it creates, including on failure.
 */

import "./allow-server-only";

import { adminAuth } from "../src/lib/firebase/admin";
import { SESSION_MAX_AGE_MS } from "../src/lib/auth";

const TEST_UID = `smoke-auth-${Date.now()}`;

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log("\n1. Admin SDK credentials");
  const auth = adminAuth();
  check("adminAuth() initialised (service account parsed and accepted)", true);

  console.log("\n2. Mint a real ID token without a browser");
  const customToken = await auth.createCustomToken(TEST_UID);
  check("createCustomToken succeeded", typeof customToken === "string" && customToken.length > 0);

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY is not set");

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );

  const body = (await response.json()) as { idToken?: string; error?: { message?: string } };

  check(
    "exchanged custom token for an ID token",
    response.ok && !!body.idToken,
    body.error?.message ?? `HTTP ${response.status}`,
  );

  if (!body.idToken) throw new Error("no ID token — cannot continue");
  const idToken = body.idToken;

  console.log("\n3. The exact sequence /api/auth/session runs");

  const decoded = await auth.verifyIdToken(idToken, true);
  check("verifyIdToken(idToken, checkRevoked=true)", decoded.uid === TEST_UID);

  // The route rejects tokens whose sign-in happened more than 5 minutes ago.
  const ageSeconds = Date.now() / 1000 - decoded.auth_time;
  check(
    `auth_time freshness check passes (age ${ageSeconds.toFixed(1)}s < 300s)`,
    ageSeconds <= 300,
    `auth_time=${decoded.auth_time}`,
  );

  // This is the call most likely to fail on a service account lacking the
  // right IAM permission — it is what turns a token into our session cookie.
  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });
  check("createSessionCookie succeeded", sessionCookie.length > 0);

  const claims = await auth.verifySessionCookie(sessionCookie, true);
  check("verifySessionCookie(cookie, checkRevoked=true)", claims.uid === TEST_UID);

  console.log("\n4. Rejection paths behave");
  let rejected = false;
  try {
    await auth.verifySessionCookie("forged-cookie-value", true);
  } catch {
    rejected = true;
  }
  check("a forged session cookie is rejected", rejected);
}

main()
  .catch((error) => {
    failed += 1;
    console.error("\n💥 Auth smoke test threw:\n", error);
  })
  .finally(async () => {
    await adminAuth()
      .deleteUser(TEST_UID)
      .then(() => console.log("\n🧹 Deleted test user."))
      .catch(() => console.log("\n(no test user to clean up)"));

    console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} passed, ${failed} failed\n`);
    process.exit(failed === 0 ? 0 : 1);
  });
