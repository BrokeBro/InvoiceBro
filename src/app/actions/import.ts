"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentOrg } from "@/lib/auth";
import { getClient } from "@/lib/data";
import { adminBucket, adminDb } from "@/lib/firebase/admin";
import type { ImportedInvoiceData } from "@/lib/import-parser";
import { parseInvoiceText } from "@/lib/import-parser";
import { computeTotals } from "@/lib/money";
import { extractTextFromPdf } from "@/lib/pdf-parse";
import type { ClientSnapshot, LineItem } from "@/lib/types";

type Result<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function parseImportedInvoice(
  formData: FormData,
): Promise<Result<ImportedInvoiceData>> {
  await requireCurrentOrg();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "No file selected" };
  if (file.size > MAX_FILE_SIZE) return { ok: false, error: "File too large (max 10 MB)" };
  if (file.type !== "application/pdf") {
    return { ok: false, error: "Only PDF files can be imported" };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractTextFromPdf(buffer);
    const data = parseInvoiceText(text);
    return { ok: true, data };
  } catch (err) {
    console.error("PDF parse failed", err);
    return { ok: false, error: "Could not read the PDF. Is the file valid?" };
  }
}

export async function saveImportedInvoice(
  formData: FormData,
): Promise<Result<{ invoiceId: string }>> {
  const { org } = await requireCurrentOrg();

  const raw = formData.get("payload");
  if (typeof raw !== "string") return { ok: false, error: "Missing payload" };

  let payload: {
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    currency: string;
    clientId: string | null;
    clientName: string;
    clientEmail: string;
    clientAddress: string;
    lineItems: { description: string; quantity: number; unitPriceCents: number; taxRatePercent: number }[];
    notes: string;
    terms: string;
    status: "draft" | "sent" | "paid";
    fileName: string;
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Invalid payload" };
  }

  if (!payload.issueDate || !payload.dueDate) {
    return { ok: false, error: "Issue date and due date are required" };
  }
  if (!payload.clientName && !payload.clientId) {
    return { ok: false, error: "Client name is required" };
  }
  if (payload.lineItems.length === 0) {
    return { ok: false, error: "At least one line item is required" };
  }

  const db = adminDb();
  const now = new Date().toISOString();

  // Resolve or create client
  let clientSnapshot: ClientSnapshot;
  if (payload.clientId) {
    const existing = await getClient(org.id, payload.clientId);
    if (!existing) return { ok: false, error: "Selected client not found" };
    clientSnapshot = {
      id: existing.id,
      name: existing.name,
      email: existing.email,
      address: existing.address,
      vatRegistered: existing.vatRegistered,
      vatNumber: existing.vatRegistered ? existing.vatNumber : "",
    };
  } else {
    const clientRef = db.collection(`organizations/${org.id}/clients`).doc();
    const newClient = {
      name: payload.clientName,
      email: payload.clientEmail || "",
      address: payload.clientAddress || "",
      vatRegistered: false,
      vatNumber: "",
      taxRatePercent: null,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    await clientRef.set(newClient);
    clientSnapshot = {
      id: clientRef.id,
      name: newClient.name,
      email: newClient.email,
      address: newClient.address,
      vatRegistered: false,
      vatNumber: "",
    };
  }

  const lineItems: LineItem[] = payload.lineItems.map((li) => ({
    description: li.description,
    quantity: li.quantity,
    unitPriceCents: li.unitPriceCents,
    taxRatePercent: li.taxRatePercent,
  }));

  const totals = computeTotals(lineItems);
  const isPaid = payload.status === "paid";

  const invoiceData = {
    number: payload.invoiceNumber || null,
    status: payload.status === "paid" ? "sent" : payload.status,
    client: clientSnapshot,
    issueDate: payload.issueDate,
    dueDate: payload.dueDate,
    currency: payload.currency || "GBP",
    lineItems,
    ...totals,
    amountPaidCents: isPaid ? totals.totalCents : 0,
    balanceCents: isPaid ? 0 : totals.totalCents,
    notes: payload.notes || "",
    terms: payload.terms || "",
    templateOverride: null,
    createdAt: now,
    updatedAt: now,
  };

  const invoiceRef = await db
    .collection(`organizations/${org.id}/invoices`)
    .add(invoiceData);

  // Archive the original PDF if provided
  const file = formData.get("file") as File | null;
  if (file && file.size > 0) {
    const ext = file.name.split(".").pop() ?? "pdf";
    const archiveDocRef = db.collection(`organizations/${org.id}/archivedInvoices`).doc();
    const storagePath = `organizations/${org.id}/archive/${archiveDocRef.id}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await adminBucket().file(storagePath).save(buffer, { contentType: file.type });

    await archiveDocRef.set({
      fileName: file.name,
      storagePath,
      contentType: file.type,
      sizeBytes: file.size,
      detectedDate: payload.issueDate,
      notes: `Imported as invoice ${payload.invoiceNumber || "draft"}`,
      createdAt: now,
    });
  }

  revalidatePath("/invoices");
  revalidatePath("/archive");
  revalidatePath("/clients");
  return { ok: true, data: { invoiceId: invoiceRef.id } };
}
