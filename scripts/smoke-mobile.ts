/**
 * Mobile layout check against the real running app.
 *
 * Seeds a throwaway org, client and invoice, mints a genuine session cookie
 * with the Admin SDK (so no browser Google sign-in is needed), then drives a
 * phone-sized Chromium through the app and asserts the one thing that is easy
 * to get wrong and impossible to spot in code review: that no page scrolls
 * horizontally.
 *
 * Start the app first, then:
 *   npx tsx --env-file=.env.local scripts/smoke-mobile.ts [baseUrl]
 *
 * Screenshots land in .preview/mobile/ for eyeballing.
 */

import "./allow-server-only";

import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

import { adminAuth, adminDb } from "../src/lib/firebase/admin";
import { SESSION_MAX_AGE_MS } from "../src/lib/auth";
import { DEFAULT_ORGANIZATION } from "../src/lib/defaults";
import { computeTotals } from "../src/lib/money";

const BASE_URL = process.argv[2] ?? "http://localhost:3300";
const UID = `smoke-mobile-${Date.now()}`;
const OUT = ".preview/mobile";

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

async function seed() {
  const db = adminDb();
  const now = new Date().toISOString();
  const orgRef = db.collection("organizations").doc();

  await db
    .batch()
    .set(orgRef, {
      ...DEFAULT_ORGANIZATION,
      name: "Mobile Test Co",
      email: "mobile@example.com",
      address: "1 Test Street\nLondon EC1A 1AA",
      vatNumber: "GB 000 0000 00",
      createdAt: now,
    })
    .set(orgRef.collection("members").doc(UID), { role: "owner", joinedAt: now })
    .set(db.doc(`users/${UID}`), {
      uid: UID,
      email: "mobile@example.com",
      displayName: "Mobile Tester",
      photoURL: "",
      orgIds: [orgRef.id],
      defaultOrgId: orgRef.id,
    })
    .commit();

  const clientRef = await orgRef.collection("clients").add({
    name: "Meridian Coffee Roasters Ltd",
    email: "accounts@meridiancoffee.example",
    address: "Unit 7, Bankside Yard\nManchester M1 5QA",
    vatRegistered: false,
    vatNumber: "",
    taxRatePercent: 0,
    currency: "GBP",
    archived: false,
    createdAt: now,
  });

  const lineItems = [
    {
      description: "Brand identity design — logo, colour system and type scale",
      quantity: 1,
      unitPriceCents: 240000,
      taxRatePercent: 20,
    },
    { description: "Consultancy", quantity: 12.5, unitPriceCents: 9500, taxRatePercent: 20 },
    { description: "Zero-rated licence", quantity: 3, unitPriceCents: 4500, taxRatePercent: 0 },
  ];
  const totals = computeTotals(lineItems);

  const invoiceRef = await orgRef.collection("invoices").add({
    number: "INV-0001",
    status: "sent",
    client: {
      id: clientRef.id,
      name: "Meridian Coffee Roasters Ltd",
      email: "accounts@meridiancoffee.example",
      address: "Unit 7, Bankside Yard\nManchester M1 5QA",
      vatRegistered: false,
      vatNumber: "",
    },
    issueDate: "2026-08-16",
    dueDate: "2026-09-15",
    currency: "GBP",
    lineItems,
    ...totals,
    amountPaidCents: 0,
    balanceCents: totals.totalCents,
    notes: "Thanks for your business.",
    terms: "Payment due within 30 days.",
    templateOverride: null,
    createdAt: now,
    updatedAt: now,
  });

  return { orgId: orgRef.id, invoiceId: invoiceRef.id };
}

/** A genuine session cookie, minted the same way /api/auth/session does. */
async function mintSessionCookie(): Promise<string> {
  const auth = adminAuth();
  const customToken = await auth.createCustomToken(UID);

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );

  const body = (await response.json()) as { idToken?: string };
  if (!body.idToken) throw new Error("could not mint an ID token");

  return auth.createSessionCookie(body.idToken, { expiresIn: SESSION_MAX_AGE_MS });
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  const { orgId, invoiceId } = await seed();
  console.log(`\nSeeded org ${orgId}`);

  const sessionCookie = await mintSessionCookie();
  console.log("Minted a real session cookie.\n");

  // Use the Chromium already present in the environment rather than whatever
  // build this playwright version wants to download — the two rarely match, and
  // a browser download is a slow, network-dependent way to fail.
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });
  const context = await browser.newContext({
    ...devices["iPhone 13"], // 390 x 844, DPR 3, touch
  });

  const url = new URL(BASE_URL);
  await context.addCookies([
    {
      name: "__session",
      value: sessionCookie,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();

  const routes = [
    { path: "/invoices", name: "invoices-list" },
    { path: `/invoices/${invoiceId}`, name: "invoice-detail" },
    { path: "/invoices/new", name: "invoice-new" },
    { path: "/clients", name: "clients" },
    { path: "/settings/organization", name: "settings" },
  ];

  console.log("Checking each page at 390x844 (iPhone 13):");

  for (const route of routes) {
    const response = await page.goto(`${BASE_URL}${route.path}`, {
      waitUntil: "networkidle",
    });

    check(`${route.path} responds 200`, response?.status() === 200, `got ${response?.status()}`);

    // The single most common mobile failure: content wider than the viewport,
    // which forces sideways scrolling and pushes controls off-screen.
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    check(
      `${route.path} has no horizontal overflow`,
      overflow.scrollWidth <= overflow.clientWidth + 1,
      `content ${overflow.scrollWidth}px wide in a ${overflow.clientWidth}px viewport`,
    );

    // iOS Safari zooms the page when a *text-entry* field smaller than 16px
    // takes focus. Controls that open their own picker instead of accepting
    // typing — file, checkbox, radio, colour — never trigger it, so holding
    // them to 16px would be a false alarm rather than a real finding.
    const NON_TEXT = ["file", "checkbox", "radio", "color", "range", "submit", "button"];

    const smallInputs = await page.evaluate((nonText) => {
      const nodes = Array.from(document.querySelectorAll("input, select, textarea"));
      return nodes
        .filter((node) => {
          const type = (node as HTMLInputElement).type ?? "";
          if (nonText.includes(type)) return false;
          return parseFloat(getComputedStyle(node).fontSize) < 16;
        })
        .map((node) => `${node.tagName.toLowerCase()}[name=${(node as HTMLInputElement).name}]`);
    }, NON_TEXT);

    check(
      `${route.path} text inputs are >= 16px (no iOS zoom-on-focus)`,
      smallInputs.length === 0,
      smallInputs.join(", "),
    );

    await page.screenshot({ path: `${OUT}/${route.name}.png`, fullPage: true });
  }

  // The bottom nav is the primary way around on a phone; make sure it is there
  // and reachable rather than merely defined in the markup.
  await page.goto(`${BASE_URL}/invoices`, { waitUntil: "networkidle" });
  const navVisible = await page.locator("nav.fixed").isVisible();
  check("bottom navigation is visible on mobile", navVisible);

  await browser.close();
  return orgId;
}

let createdOrgId: string | undefined;

main()
  .then((orgId) => {
    createdOrgId = orgId;
  })
  .catch((error) => {
    failed += 1;
    console.error("\n💥 Mobile smoke test threw:", error);
  })
  .finally(async () => {
    if (createdOrgId) {
      await adminDb()
        .recursiveDelete(adminDb().doc(`organizations/${createdOrgId}`))
        .catch(() => {});
    }
    await adminDb().doc(`users/${UID}`).delete().catch(() => {});
    await adminAuth().deleteUser(UID).catch(() => {});
    console.log("\n🧹 Cleaned up.");
    console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} passed, ${failed} failed`);
    console.log(`Screenshots: ${OUT}/\n`);
    process.exit(failed === 0 ? 0 : 1);
  });
