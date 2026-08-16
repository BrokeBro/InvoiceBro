"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentOrg } from "@/lib/auth";
import { adminBucket, adminDb } from "@/lib/firebase/admin";
import { organizationSchema } from "@/lib/schemas";
import type { TemplateId } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function saveOrganization(formData: FormData): Promise<ActionResult> {
  const { org } = await requireCurrentOrg();

  const parsed = organizationSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    address: formData.get("address") ?? "",
    vatNumber: formData.get("vatNumber") ?? "",
    accentColor: formData.get("accentColor"),
    template: formData.get("template"),
    currency: formData.get("currency"),
    taxRatePercent: formData.get("taxRatePercent"),
    paymentTermsDays: formData.get("paymentTermsDays"),
    numberPrefix: formData.get("numberPrefix") ?? "INV-",
    numberPadding: formData.get("numberPadding"),
    defaultNotes: formData.get("defaultNotes") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  }

  const input = parsed.data;
  let logoPath = org.logoPath;

  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (!ALLOWED_LOGO_TYPES.includes(logo.type)) {
      return { ok: false, error: "Logo must be a PNG, JPEG or WebP image" };
    }
    if (logo.size > MAX_LOGO_BYTES) {
      return { ok: false, error: "Logo must be smaller than 2 MB" };
    }

    const extension = logo.type.split("/")[1].replace("jpeg", "jpg");
    const path = `organizations/${org.id}/logo.${extension}`;
    const buffer = Buffer.from(await logo.arrayBuffer());

    await adminBucket().file(path).save(buffer, { contentType: logo.type });
    logoPath = path;
  }

  // `numbering.next` is carried through untouched: the prefix and padding are
  // yours to change, but the counter belongs to reserveInvoiceNumber(), and
  // resetting it here could reissue a number that already exists on a real
  // invoice.
  //
  // This writes `numbering` as a whole object rather than dotted paths like
  // "numbering.prefix" — set() treats a dotted key as a literal field name
  // containing a dot, and only update() interprets it as a path.
  await adminDb().doc(`organizations/${org.id}`).set(
    {
      name: input.name,
      email: input.email,
      phone: input.phone,
      address: input.address,
      vatNumber: input.vatNumber,
      logoPath,
      branding: {
        accentColor: input.accentColor,
        template: input.template as TemplateId,
      },
      numbering: {
        prefix: input.numberPrefix,
        padding: input.numberPadding,
        next: org.numbering?.next ?? 1,
      },
      defaults: {
        currency: input.currency,
        taxRatePercent: input.taxRatePercent,
        paymentTermsDays: input.paymentTermsDays,
        notes: input.defaultNotes,
      },
    },
    { merge: true },
  );

  revalidatePath("/settings/organization");
  revalidatePath("/invoices");
  return { ok: true };
}
