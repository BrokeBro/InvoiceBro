import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// Server-side Firebase. This is the only path to Firestore and Storage in the
// whole app, and it runs with admin privileges that bypass all security rules —
// so every caller must go through the authorization helpers in src/lib/auth.ts
// first. Never import this from a client component.

const APP_NAME = "invoicebro-admin";

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is not set. Generate a private key in the " +
        "Firebase console (Project settings -> Service accounts), then " +
        "base64-encode the JSON file: base64 -w0 serviceAccountKey.json",
    );
  }

  // Accept both base64 (what we document, and what survives Vercel's env
  // parsing) and raw JSON (convenient in local shells that handle it fine).
  const json = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");

  let parsed: { project_id?: string; client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY could not be parsed. It should be the " +
        "service account JSON file, base64-encoded.",
    );
  }

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is missing project_id, client_email or " +
        "private_key — is it the right file?",
    );
  }

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    // Some environments store the key with literal backslash-n sequences.
    privateKey: parsed.private_key.replace(/\\n/g, "\n"),
  };
}

// Named app + getApps() lookup so Next.js hot reload doesn't try to initialize
// the same app twice, which throws.
function adminApp(): App {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) return existing;

  const serviceAccount = loadServiceAccount();

  return initializeApp(
    {
      credential: cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    },
    APP_NAME,
  );
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}

export function adminDb(): Firestore {
  return getFirestore(adminApp());
}

export function adminBucket() {
  return getStorage(adminApp()).bucket();
}
