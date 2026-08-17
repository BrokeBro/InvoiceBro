"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentOrg } from "@/lib/auth";
import { getClient, getInvoice, reserveInvoiceNumber } from "@/lib/data";
import { adminDb } from "@/lib/firebase/admin";
import { computeTotals } from "@/lib/money";
import { invoiceSchema } from "@/lib/schemas";
import type { ClientSnapshot, LineItem } from "@/lib/types";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

type RawLineItem = {
  description?: string;
  quantity?: string | number;
  unitPriceCents?: string | number;
  taxRatePercent?: string | number;
};

function parsePayload(formData: FormData) {
  const raw = formData.get("payload");
  if (typeof raw !== "string") return null;

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function saveInvoice(
  invoiceId: string | null,
  formData: FormData,
): Promise<ActionResult> {
  const { org } = await requireCurrentOrg();

  const payload = parsePayload(formData);
  if (!payload) return { ok: false, error: "Could not read the invoice" };

  const parsed = invoiceSchema.safeParse({
    clientId: payload.clientId,
    issueDate: payload.issueDate,
    dueDate: payload.dueDate,
    currency: payload.currency ?? org.defaults.currency,
    lineItems: (payload.lineItems as RawLineItem[]) ?? [],
    notes: payload.notes ?? "",
    terms: payload.terms ?? "",
    templateOverride: payload.templateOverride ?? null,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid invoice" };
  }

  const input = parsed.data;

  if (input.dueDate < input.issueDate) {
    return { ok: false, error: "The due date cannot be before the issue date" };
  }

  const client = await getClient(org.id, input.clientId);
  if (!client) return { ok: false, error: "That client no longer exists" };

  // Snapshot the client onto the invoice. Editing a client's address later must
  // never rewrite an invoice that has already been issued.
  // vatRegistered rides along in the snapshot for the same reason as the rest:
  // un-registering a client next year must not retroactively strip the VAT
  // number from invoices already issued and sent.
  const clientSnapshot: ClientSnapshot = {
    id: client.id,
    name: client.name,
    email: client.email,
    address: client.address,
    vatRegistered: client.vatRegistered,
    vatNumber: client.vatRegistered ? client.vatNumber : "",
  };

  const lineItems: LineItem[] = input.lineItems;

  // Totals are recomputed server-side from the line items, never taken from the
  // client. The browser's figures are for display only.
  const totals = computeTotals(lineItems);
  const now = new Date().toISOString();

  const collection = adminDb().collection(`organizations/${org.id}/invoices`);

  if (invoiceId) {
    const existing = await getInvoice(org.id, invoiceId);
    if (!existing) return { ok: false, error: "Invoice not found" };
    if (existing.status === "void") {
      return { ok: false, error: "A void invoice cannot be edited" };
    }

    await collection.doc(invoiceId).set(
      {
        client: clientSnapshot,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        currency: input.currency,
        lineItems,
        ...totals,
        balanceCents: totals.totalCents - existing.amountPaidCents,
        notes: input.notes,
        terms: input.terms,
        templateOverride: input.templateOverride,
        updatedAt: now,
      },
      { merge: true },
    );

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${invoiceId}`);
    return { ok: true, id: invoiceId };
  }

  const created = await collection.add({
    number: null,
    status: "draft",
    client: clientSnapshot,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    currency: input.currency,
    lineItems,
    ...totals,
    amountPaidCents: 0,
    balanceCents: totals.totalCents,
    notes: input.notes,
    terms: input.terms,
    templateOverride: input.templateOverride,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/invoices");
  return { ok: true, id: created.id };
}

/**
 * Issue a draft: assign its number and mark it sent.
 *
 * The number is reserved here rather than at creation so that abandoned drafts
 * don't burn numbers, and so the sequence reflects invoices you actually
 * issued.
 */
export async function issueInvoice(invoiceId: string): Promise<ActionResult> {
  const { org } = await requireCurrentOrg();

  const invoice = await getInvoice(org.id, invoiceId);
  if (!invoice) return { ok: false, error: "Invoice not found" };
  if (invoice.status !== "draft") {
    return { ok: false, error: "This invoice has already been issued" };
  }
  if (invoice.lineItems.length === 0) {
    return { ok: false, error: "Add at least one line item before issuing" };
  }

  const number = invoice.number ?? (await reserveInvoiceNumber(org.id));

  await adminDb()
    .doc(`organizations/${org.id}/invoices/${invoiceId}`)
    .set({ number, status: "sent", updatedAt: new Date().toISOString() }, { merge: true });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true, id: invoiceId };
}

/** Void an invoice. Kept, never deleted — the sequence must stay auditable. */
export async function voidInvoice(invoiceId: string): Promise<ActionResult> {
  const { org } = await requireCurrentOrg();

  const invoice = await getInvoice(org.id, invoiceId);
  if (!invoice) return { ok: false, error: "Invoice not found" };

  await adminDb()
    .doc(`organizations/${org.id}/invoices/${invoiceId}`)
    .set({ status: "void", updatedAt: new Date().toISOString() }, { merge: true });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true };
}

/** Delete a draft. Only ever a draft: issued invoices are voided instead. */
export async function deleteDraft(invoiceId: string): Promise<ActionResult> {
  const { org } = await requireCurrentOrg();

  const invoice = await getInvoice(org.id, invoiceId);
  if (!invoice) return { ok: false, error: "Invoice not found" };
  if (invoice.status !== "draft") {
    return { ok: false, error: "Only drafts can be deleted — void this instead" };
  }

  await adminDb().doc(`organizations/${org.id}/invoices/${invoiceId}`).delete();

  revalidatePath("/invoices");
  redirect("/invoices");
}
