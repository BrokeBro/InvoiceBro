"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentOrg, requireOrg } from "@/lib/auth";
import { adminDb } from "@/lib/firebase/admin";
import { clientSchema } from "@/lib/schemas";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveClient(
  clientId: string | null,
  formData: FormData,
): Promise<ActionResult> {
  const { org } = await requireCurrentOrg();

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") ?? "",
    address: formData.get("address") ?? "",
    vatRegistered: formData.get("vatRegistered"),
    vatNumber: formData.get("vatNumber") ?? "",
    taxRatePercent: formData.get("taxRatePercent") ?? "",
    currency: formData.get("currency") ?? org.defaults.currency,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  // A client marked as not VAT registered keeps no VAT number. Clearing it here
  // rather than merely hiding it means the invoice snapshot cannot later pick up
  // a stale number, and un-ticking the box genuinely removes the data.
  const data = {
    ...parsed.data,
    vatNumber: parsed.data.vatRegistered ? parsed.data.vatNumber : "",
  };

  const collection = adminDb().collection(`organizations/${org.id}/clients`);

  if (clientId) {
    // merge:true so we never clobber fields this form doesn't manage.
    await collection.doc(clientId).set(data, { merge: true });
  } else {
    await collection.add({
      ...data,
      archived: false,
      createdAt: new Date().toISOString(),
    });
  }

  revalidatePath("/clients");
  revalidatePath("/invoices");
  return { ok: true };
}

/**
 * Archive rather than delete.
 *
 * Invoices snapshot their client details, so removing the record wouldn't
 * corrupt historical invoices — but it would break the link back to the client,
 * and deleting someone you've billed is rarely what you actually meant.
 */
export async function archiveClient(clientId: string): Promise<ActionResult> {
  const { org } = await requireCurrentOrg();
  await requireOrg(org.id);

  await adminDb()
    .doc(`organizations/${org.id}/clients/${clientId}`)
    .set({ archived: true }, { merge: true });

  revalidatePath("/clients");
  return { ok: true };
}
