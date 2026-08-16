"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, type Auth } from "firebase/auth";

// Only Auth loads in the browser.
//
// There is deliberately no Firestore or Storage client here: all data access
// goes through the server (see src/lib/firebase/admin.ts). The browser's single
// job is to complete a Google sign-in and hand the resulting ID token to our
// own /api/auth/session endpoint.
//
// Analytics is also deliberately absent — getAnalytics() touches `window` at
// import time, which breaks server rendering, and it earns nothing here.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  // Always show the chooser, so switching accounts doesn't silently reuse the
  // last session — this is also how you test tenant isolation.
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}
