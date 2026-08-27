"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentOrg } from "@/lib/auth";
import { getArchivedInvoice } from "@/lib/data";
import { adminBucket, adminDb } from "@/lib/firebase/admin";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/**
 * Try to extract a date from a filename.
 *
 * Recognises common patterns people use when saving invoices:
 *   2024-03-15, 2024_03_15, 20240315
 *   15-03-2024, 15_03_2024, 15032024
 *   March 2024, Mar-2024
 *   invoice-2024-03
 */
const MONTH_NAMES: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
  jan: "01", feb: "02", mar: "03", apr: "04",
  jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function detectDateFromFilename(filename: string): string | null {
  const name = filename.replace(/\.[^.]+$/, "");

  // YYYY-MM-DD or YYYY_MM_DD
  let m = name.match(/(\d{4})[-_./](\d{1,2})[-_./](\d{1,2})/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  // DD-MM-YYYY or DD_MM_YYYY
  m = name.match(/(\d{1,2})[-_./](\d{1,2})[-_./](\d{4})/);
  if (m) {
    const d = new Date(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  // YYYYMMDD
  m = name.match(/(\d{4})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}`);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  // Month name + year: "March 2024", "Mar-2024"
  const lower = name.toLowerCase();
  for (const [monthName, monthNum] of Object.entries(MONTH_NAMES)) {
    const re = new RegExp(`${monthName}[\\s_-]*(\\d{4})`, "i");
    const match = lower.match(re);
    if (match) return `${match[1]}-${monthNum}-01`;
  }

  // YYYY-MM (year-month only)
  m = name.match(/(\d{4})[-_](0[1-9]|1[0-2])(?!\d)/);
  if (m) return `${m[1]}-${m[2]}-01`;

  return null;
}

export async function uploadArchivedInvoice(formData: FormData): Promise<ActionResult> {
  const { org } = await requireCurrentOrg();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "No file selected" };
  if (file.size > MAX_FILE_SIZE) return { ok: false, error: "File too large (max 10 MB)" };
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, error: "Only PDF, PNG, JPEG or WebP files are accepted" };
  }

  const notes = (formData.get("notes") as string) ?? "";
  const manualDate = (formData.get("detectedDate") as string) || null;
  const detectedDate = manualDate || detectDateFromFilename(file.name);

  const collection = adminDb().collection(`organizations/${org.id}/archivedInvoices`);
  const docRef = collection.doc();

  const ext = file.name.split(".").pop() ?? "bin";
  const storagePath = `organizations/${org.id}/archive/${docRef.id}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await adminBucket().file(storagePath).save(buffer, { contentType: file.type });

  await docRef.set({
    fileName: file.name,
    storagePath,
    contentType: file.type,
    sizeBytes: file.size,
    detectedDate,
    notes,
    createdAt: new Date().toISOString(),
  });

  revalidatePath("/archive");
  return { ok: true, id: docRef.id };
}

export async function deleteArchivedInvoice(archiveId: string): Promise<ActionResult> {
  const { org } = await requireCurrentOrg();

  const doc = await getArchivedInvoice(org.id, archiveId);
  if (!doc) return { ok: false, error: "Archived invoice not found" };

  try {
    await adminBucket().file(doc.storagePath).delete();
  } catch {
    // File may already be gone — continue with Firestore cleanup
  }

  await adminDb().doc(`organizations/${org.id}/archivedInvoices/${archiveId}`).delete();

  revalidatePath("/archive");
  return { ok: true };
}

export async function updateArchivedInvoice(
  archiveId: string,
  formData: FormData,
): Promise<ActionResult> {
  const { org } = await requireCurrentOrg();

  const doc = await getArchivedInvoice(org.id, archiveId);
  if (!doc) return { ok: false, error: "Archived invoice not found" };

  const notes = (formData.get("notes") as string) ?? "";
  const detectedDate = (formData.get("detectedDate") as string) || null;

  await adminDb()
    .doc(`organizations/${org.id}/archivedInvoices/${archiveId}`)
    .set({ notes, detectedDate }, { merge: true });

  revalidatePath("/archive");
  return { ok: true };
}
