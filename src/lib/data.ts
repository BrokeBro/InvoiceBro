import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { withDerivedStatus } from "@/lib/invoice-status";
import type { ArchivedInvoice, Client, Invoice, Organization } from "@/lib/types";

// Read helpers. Every one of these takes an orgId that the caller has already
// validated with requireOrg() — they do not check membership themselves, so
// never call them with an org ID taken straight from user input.

export async function getOrganization(orgId: string): Promise<Organization | null> {
  const snapshot = await adminDb().doc(`organizations/${orgId}`).get();
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...snapshot.data() } as Organization;
}

/**
 * Fill in fields added after some clients were already created.
 *
 * Doing this on read rather than with a backfill script keeps old documents
 * valid as they are. Both defaults are chosen to preserve existing behaviour
 * exactly: a client who already has a VAT number is evidently registered, so
 * their invoices keep printing it, and a null rate means "carry on using the
 * organization default", which is what happened before the field existed.
 */
function normalizeClient(id: string, data: FirebaseFirestore.DocumentData): Client {
  return {
    ...(data as Client),
    id,
    vatRegistered: data.vatRegistered ?? Boolean(data.vatNumber),
    taxRatePercent: data.taxRatePercent ?? null,
  };
}

export async function listClients(orgId: string): Promise<Client[]> {
  const snapshot = await adminDb()
    .collection(`organizations/${orgId}/clients`)
    .orderBy("name")
    .get();

  return snapshot.docs
    .map((doc) => normalizeClient(doc.id, doc.data()))
    .filter((client) => !client.archived);
}

export async function getClient(orgId: string, clientId: string): Promise<Client | null> {
  const snapshot = await adminDb().doc(`organizations/${orgId}/clients/${clientId}`).get();
  if (!snapshot.exists) return null;
  return normalizeClient(snapshot.id, snapshot.data()!);
}

export async function listInvoices(orgId: string): Promise<Invoice[]> {
  const snapshot = await adminDb()
    .collection(`organizations/${orgId}/invoices`)
    .orderBy("createdAt", "desc")
    .limit(200)
    .get();

  return snapshot.docs.map((doc) =>
    withDerivedStatus({ id: doc.id, ...doc.data() } as Invoice),
  );
}

export async function getInvoice(orgId: string, invoiceId: string): Promise<Invoice | null> {
  const snapshot = await adminDb().doc(`organizations/${orgId}/invoices/${invoiceId}`).get();
  if (!snapshot.exists) return null;
  return withDerivedStatus({ id: snapshot.id, ...snapshot.data() } as Invoice);
}

/**
 * Reserve the next invoice number for an organization.
 *
 * Firestore has no unique constraint and no auto-increment, so uniqueness comes
 * from this transaction: read the counter, write it back incremented, and let
 * Firestore retry the whole thing if another request got there first. Two
 * invoices created at the same instant therefore cannot receive the same
 * number.
 *
 * A number is consumed even if the caller later fails, which is why the agreed
 * behaviour is "unique and ascending, gaps acceptable" — gapless numbering
 * would require never reserving until the write succeeds, and that reintroduces
 * the collision this exists to prevent.
 */
export async function reserveInvoiceNumber(orgId: string): Promise<string> {
  const db = adminDb();
  const orgRef = db.doc(`organizations/${orgId}`);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(orgRef);
    if (!snapshot.exists) throw new Error("Organization not found");

    const numbering = (snapshot.data()?.numbering ?? {}) as {
      prefix?: string;
      padding?: number;
      next?: number;
    };

    const prefix = numbering.prefix ?? "INV-";
    const padding = numbering.padding ?? 4;
    const next = numbering.next ?? 1;

    transaction.update(orgRef, { "numbering.next": next + 1 });

    return `${prefix}${String(next).padStart(padding, "0")}`;
  });
}

export async function listArchivedInvoices(orgId: string): Promise<ArchivedInvoice[]> {
  const snapshot = await adminDb()
    .collection(`organizations/${orgId}/archivedInvoices`)
    .orderBy("createdAt", "desc")
    .limit(500)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ArchivedInvoice));
}

export async function getArchivedInvoice(
  orgId: string,
  archiveId: string,
): Promise<ArchivedInvoice | null> {
  const snapshot = await adminDb()
    .doc(`organizations/${orgId}/archivedInvoices/${archiveId}`)
    .get();
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...snapshot.data() } as ArchivedInvoice;
}

export async function getSignedUrl(storagePath: string): Promise<string | null> {
  try {
    const { adminBucket } = await import("@/lib/firebase/admin");
    const [url] = await adminBucket()
      .file(storagePath)
      .getSignedUrl({ action: "read", expires: Date.now() + 60 * 60 * 1000 });
    return url;
  } catch {
    return null;
  }
}

/** A short-lived signed URL for an org logo, or null if there isn't one. */
export async function getLogoUrl(logoPath: string | null): Promise<string | null> {
  if (!logoPath) return null;

  try {
    const { adminBucket } = await import("@/lib/firebase/admin");
    const [url] = await adminBucket()
      .file(logoPath)
      .getSignedUrl({
        action: "read",
        expires: Date.now() + 60 * 60 * 1000,
      });
    return url;
  } catch {
    // A missing logo should never take down an invoice or its PDF.
    return null;
  }
}
