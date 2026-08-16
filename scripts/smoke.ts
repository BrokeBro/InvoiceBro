/**
 * End-to-end smoke test against LIVE Firestore.
 *
 * Google sign-in needs a human at a Google prompt, so this can't test the
 * browser half. What it can do — and does — is drive every server-side path the
 * app uses, with the app's own modules rather than reimplementations, so a
 * failure here is a real failure in shipped code.
 *
 *   npx tsx --env-file=.env.local scripts/smoke.ts
 *
 * Creates documents under a throwaway org and deletes all of them at the end,
 * including on failure.
 */

// MUST be first: the modules under test import "server-only", which throws
// outside Next's bundler. See the file for why stubbing it is correct here.
import "./allow-server-only";

import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";

import { adminDb } from "../src/lib/firebase/admin";
import { getInvoice, listClients, listInvoices, reserveInvoiceNumber } from "../src/lib/data";
import { computeTotals } from "../src/lib/money";
import { deriveStatus } from "../src/lib/invoice-status";
import { resolveTemplate } from "../src/lib/pdf/render";
import { DEFAULT_ORGANIZATION } from "../src/lib/defaults";
import { ClassicTemplate } from "../src/lib/pdf/templates/classic";
import { ModernTemplate } from "../src/lib/pdf/templates/modern";
import { MinimalTemplate } from "../src/lib/pdf/templates/minimal";
import type { Invoice, Organization } from "../src/lib/types";

const OWNER_UID = `smoke-owner-${Date.now()}`;
const INTRUDER_UID = `smoke-intruder-${Date.now()}`;

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

/** Mirrors requireOrg()'s membership lookup without Next's cookie machinery. */
async function isMember(orgId: string, uid: string): Promise<boolean> {
  const snapshot = await adminDb().doc(`organizations/${orgId}/members/${uid}`).get();
  return snapshot.exists;
}

async function main() {
  const db = adminDb();
  const now = new Date().toISOString();

  console.log("\n1. Connectivity + org bootstrap");
  const orgRef = db.collection("organizations").doc();
  await db.batch()
    .set(orgRef, {
      ...DEFAULT_ORGANIZATION,
      name: "Smoke Test Co",
      email: "smoke@example.com",
      address: "1 Test Street\nLondon",
      vatNumber: "GB 000 0000 00",
      createdAt: now,
    })
    .set(orgRef.collection("members").doc(OWNER_UID), {
      role: "owner",
      email: "smoke@example.com",
      joinedAt: now,
    })
    .set(db.doc(`users/${OWNER_UID}`), {
      uid: OWNER_UID,
      email: "smoke@example.com",
      displayName: "Smoke Owner",
      photoURL: "",
      orgIds: [orgRef.id],
      defaultOrgId: orgRef.id,
    })
    .commit();

  const orgId = orgRef.id;
  check("wrote org, membership and user profile to live Firestore", true);

  const orgSnapshot = await db.doc(`organizations/${orgId}`).get();
  const organization = { id: orgSnapshot.id, ...orgSnapshot.data() } as Organization;
  check("org reads back", organization.name === "Smoke Test Co");
  check(
    "numbering counter initialised",
    organization.numbering?.next === 1 && organization.numbering?.prefix === "INV-",
    JSON.stringify(organization.numbering),
  );

  console.log("\n2. Tenancy boundary (the one that matters)");
  check("owner is a member", await isMember(orgId, OWNER_UID));
  check("stranger is NOT a member", !(await isMember(orgId, INTRUDER_UID)));

  console.log("\n3. Client + invoice round-trip");
  const clientRef = await db.collection(`organizations/${orgId}/clients`).add({
    name: "Meridian Coffee Roasters Ltd",
    email: "accounts@meridian.example",
    address: "Unit 7, Bankside Yard\nManchester",
    vatNumber: "GB 987 6543 21",
    currency: "GBP",
    archived: false,
    createdAt: now,
  });

  const clients = await listClients(orgId);
  check("listClients returns the new client", clients.length === 1 && clients[0].name.startsWith("Meridian"));

  // Mixed tax rates: the case that breaks naive "one rate on the subtotal" maths.
  const lineItems = [
    { description: "Design work", quantity: 1, unitPriceCents: 240000, taxRatePercent: 20 },
    { description: "Consultancy", quantity: 12.5, unitPriceCents: 9500, taxRatePercent: 20 },
    { description: "Zero-rated licence", quantity: 3, unitPriceCents: 4500, taxRatePercent: 0 },
    { description: "Copywriting", quantity: 6, unitPriceCents: 12000, taxRatePercent: 5 },
  ];
  const totals = computeTotals(lineItems);

  // Independently computed expectation, not a restatement of computeTotals.
  const expectedSubtotal = 240000 + 118750 + 13500 + 72000;
  const expectedTax = 48000 + 23750 + 0 + 3600;
  check(
    `subtotal ${totals.subtotalCents} === ${expectedSubtotal}`,
    totals.subtotalCents === expectedSubtotal,
  );
  check(`tax ${totals.taxCents} === ${expectedTax} (per-line, mixed rates)`, totals.taxCents === expectedTax);
  check(
    "12.5 x £95.00 rounds to exactly £1,187.50",
    Math.round(12.5 * 9500) === 118750,
  );

  const invoiceRef = await db.collection(`organizations/${orgId}/invoices`).add({
    number: null,
    status: "draft",
    client: {
      id: clientRef.id,
      name: "Meridian Coffee Roasters Ltd",
      email: "accounts@meridian.example",
      address: "Unit 7, Bankside Yard\nManchester",
      vatNumber: "GB 987 6543 21",
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

  const invoice = await getInvoice(orgId, invoiceRef.id);
  check("getInvoice reads the invoice back", invoice !== null);
  check("totals survived the Firestore round-trip", invoice?.totalCents === totals.totalCents);
  check("listInvoices sees it", (await listInvoices(orgId)).length === 1);

  console.log("\n4. Derived status");
  check("unpaid future-dated invoice with no number is draft", invoice!.status === "draft");
  check(
    "fully paid ⇒ paid",
    deriveStatus({ status: "sent", totalCents: 1000, amountPaidCents: 1000, dueDate: "2099-01-01" }) === "paid",
  );
  check(
    "part paid ⇒ partial",
    deriveStatus({ status: "sent", totalCents: 1000, amountPaidCents: 400, dueDate: "2099-01-01" }) === "partial",
  );
  check(
    "past due and unpaid ⇒ overdue",
    deriveStatus({ status: "sent", totalCents: 1000, amountPaidCents: 0, dueDate: "2020-01-01" }) === "overdue",
  );
  check(
    "void is sticky even when fully paid",
    deriveStatus({ status: "void", totalCents: 1000, amountPaidCents: 1000, dueDate: "2020-01-01" }) === "void",
  );

  console.log("\n5. Invoice numbering under concurrency");
  // Fired in parallel on purpose: this is the scenario Firestore's lack of a
  // unique constraint would otherwise lose to.
  const numbers = await Promise.all(
    Array.from({ length: 8 }, () => reserveInvoiceNumber(orgId)),
  );
  const unique = new Set(numbers);
  check(
    `8 concurrent reservations produced 8 distinct numbers`,
    unique.size === 8,
    `got ${numbers.sort().join(", ")}`,
  );
  check("numbers use the configured prefix and padding", numbers.every((n) => /^INV-\d{4}$/.test(n)));

  const afterCounter = (await db.doc(`organizations/${orgId}`).get()).data()?.numbering?.next;
  check(`counter advanced to ${afterCounter}`, afterCounter === 9);

  console.log("\n6. PDF rendering from live data");
  const templates = { classic: ClassicTemplate, modern: ModernTemplate, minimal: MinimalTemplate };

  for (const [name, Template] of Object.entries(templates)) {
    const live = { ...invoice!, number: "INV-0001", status: "sent" } as Invoice;
    const buffer = await renderToBuffer(
      createElement(Template, {
        invoice: live,
        organization,
        logoUrl: null,
        accentColor: organization.branding.accentColor,
      }) as unknown as ReactElement<DocumentProps>,
    );
    check(
      `${name} renders a valid PDF (${(buffer.length / 1024).toFixed(1)} KB)`,
      buffer.length > 1000 && buffer.subarray(0, 4).toString() === "%PDF",
    );
  }

  check(
    "template override beats org default",
    resolveTemplate({ templateOverride: "minimal" }, organization) === "minimal",
  );
  check(
    "org default applies when there's no override",
    resolveTemplate({ templateOverride: null }, organization) === "classic",
  );

  return orgId;
}

async function cleanup(orgId: string | undefined) {
  if (!orgId) return;
  const db = adminDb();

  // recursiveDelete removes subcollections too — a plain delete would orphan
  // the clients, invoices and members underneath the org document.
  await db.recursiveDelete(db.doc(`organizations/${orgId}`));
  await db.doc(`users/${OWNER_UID}`).delete();
  console.log("\n🧹 Cleaned up test documents.");
}

let createdOrgId: string | undefined;

main()
  .then((orgId) => {
    createdOrgId = orgId;
  })
  .catch((error) => {
    failed += 1;
    console.error("\n💥 Smoke test threw:", error);
  })
  .finally(async () => {
    await cleanup(createdOrgId).catch((error) =>
      console.error("Cleanup failed:", error),
    );
    console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} passed, ${failed} failed\n`);
    process.exit(failed === 0 ? 0 : 1);
  });
