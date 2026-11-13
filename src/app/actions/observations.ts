"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentOrg } from "@/lib/auth";
import { getObservationTemplate } from "@/lib/data";
import { adminDb } from "@/lib/firebase/admin";

type Result = { ok: true; id?: string } | { ok: false; error: string };

// ── Observation templates ──────────────────────────────────────────────

export async function saveObservationTemplate(
  templateId: string | null,
  formData: FormData,
): Promise<Result> {
  const { org } = await requireCurrentOrg();

  const raw = formData.get("payload");
  if (typeof raw !== "string") return { ok: false, error: "Missing payload" };

  let payload: { name?: string; fields?: { label: string; options: string[] }[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Invalid payload" };
  }

  const name = (payload.name ?? "").trim();
  if (!name) return { ok: false, error: "Template name is required" };

  const fields = (payload.fields ?? []).filter(
    (f) => f.label.trim() && f.options.length >= 2,
  );
  if (fields.length === 0) {
    return { ok: false, error: "Add at least one field with two or more options" };
  }

  const now = new Date().toISOString();
  const collection = adminDb().collection(`organizations/${org.id}/observationTemplates`);

  if (templateId) {
    await collection.doc(templateId).set(
      { name, fields, updatedAt: now },
      { merge: true },
    );
    revalidatePath("/settings/observation-templates");
    return { ok: true, id: templateId };
  }

  const created = await collection.add({
    name,
    fields,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/settings/observation-templates");
  return { ok: true, id: created.id };
}

export async function deleteObservationTemplate(templateId: string): Promise<Result> {
  const { org } = await requireCurrentOrg();

  await adminDb()
    .doc(`organizations/${org.id}/observationTemplates/${templateId}`)
    .delete();

  revalidatePath("/settings/observation-templates");
  return { ok: true };
}

// ── Invoice observations ───────────────────────────────────────────────

export async function addObservation(
  invoiceId: string,
  formData: FormData,
): Promise<Result> {
  const { org } = await requireCurrentOrg();

  const raw = formData.get("payload");
  if (typeof raw !== "string") return { ok: false, error: "Missing payload" };

  let payload: {
    templateId?: string;
    responses?: Record<string, string>;
    note?: string;
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Invalid payload" };
  }

  const templateId = payload.templateId;
  if (!templateId) return { ok: false, error: "No template selected" };

  const template = await getObservationTemplate(org.id, templateId);
  if (!template) return { ok: false, error: "Template not found" };

  const responses = payload.responses ?? {};
  const note = (payload.note ?? "").trim();

  const now = new Date().toISOString();
  const created = await adminDb()
    .collection(`organizations/${org.id}/invoices/${invoiceId}/observations`)
    .add({
      templateId,
      templateName: template.name,
      responses,
      note,
      createdAt: now,
    });

  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true, id: created.id };
}

export async function deleteObservation(
  invoiceId: string,
  observationId: string,
): Promise<Result> {
  const { org } = await requireCurrentOrg();

  await adminDb()
    .doc(`organizations/${org.id}/invoices/${invoiceId}/observations/${observationId}`)
    .delete();

  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true };
}
