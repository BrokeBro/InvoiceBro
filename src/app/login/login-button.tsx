"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getRedirectResult, signInWithPopup, signInWithRedirect } from "firebase/auth";

import { getFirebaseAuth, googleProvider } from "@/lib/firebase/client";

function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

async function exchangeToken(idToken: string): Promise<void> {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Could not start your session");
  }
}

export function LoginButton({ next }: { next?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle the return from signInWithRedirect (mobile flow).
  useEffect(() => {
    let cancelled = false;

    getRedirectResult(getFirebaseAuth())
      .then(async (result) => {
        if (!result || cancelled) return;

        setBusy(true);
        const idToken = await result.user.getIdToken();
        await exchangeToken(idToken);
        await getFirebaseAuth().signOut();

        router.replace(next ?? "/invoices");
        router.refresh();
      })
      .catch((caught) => {
        if (cancelled) return;
        const message = caught instanceof Error ? caught.message : "Sign-in failed";
        if (!message.includes("auth/popup-closed-by-user") && !message.includes("cancelled")) {
          setError(interpretError(message));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [next, router]);

  async function signIn() {
    setBusy(true);
    setError(null);

    try {
      if (isMobile()) {
        await signInWithRedirect(getFirebaseAuth(), googleProvider());
        // Page navigates away; nothing after this runs.
        return;
      }

      const credential = await signInWithPopup(getFirebaseAuth(), googleProvider());
      const idToken = await credential.user.getIdToken();
      await exchangeToken(idToken);
      await getFirebaseAuth().signOut();

      router.replace(next ?? "/invoices");
      router.refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Sign-in failed";

      if (message.includes("auth/popup-closed-by-user") || message.includes("cancelled")) {
        setError(null);
      } else if (message.includes("auth/popup-blocked")) {
        // Fallback: if even desktop gets a popup block, try redirect.
        try {
          await signInWithRedirect(getFirebaseAuth(), googleProvider());
          return;
        } catch {
          setError("Popup was blocked. Please allow popups for this site and try again.");
        }
      } else {
        setError(interpretError(message));
      }
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleMark />
        {busy ? "Signing in…" : "Continue with Google"}
      </button>

      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      ) : null}
    </div>
  );
}

function interpretError(message: string): string {
  if (message.includes("auth/unauthorized-domain")) {
    return "This domain isn't authorised in Firebase. Add it under Authentication → Settings → Authorized domains.";
  }
  if (message.includes("auth/operation-not-allowed")) {
    return "Google sign-in isn't enabled yet. Turn it on in Firebase → Authentication → Sign-in method.";
  }
  return message;
}

function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51Z"
      />
    </svg>
  );
}
