import { z } from "zod";

import { TEMPLATE_IDS } from "@/lib/types";

// Validation shared by server actions. Everything crossing the network is
// parsed here first — a Server Action is a public HTTP endpoint, so its input
// is never trusted just because a form of ours happened to produce it.

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Client name is required").max(200),
  email: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]),
  address: z.string().trim().max(1000).default(""),
  vatNumber: z.string().trim().max(60).default(""),
  currency: z.string().trim().length(3).toUpperCase().default("GBP"),
});

export const lineItemSchema = z.object({
  description: z.string().trim().min(1, "Each line needs a description").max(500),
  quantity: z.coerce.number().finite().min(0, "Quantity cannot be negative"),
  unitPriceCents: z.coerce.number().int("Prices are stored in whole cents"),
  taxRatePercent: z.coerce.number().finite().min(0).max(100),
});

export const invoiceSchema = z.object({
  clientId: z.string().trim().min(1, "Choose a client"),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid issue date"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid due date"),
  currency: z.string().trim().length(3).toUpperCase(),
  lineItems: z.array(lineItemSchema).min(1, "Add at least one line item"),
  notes: z.string().trim().max(2000).default(""),
  terms: z.string().trim().max(2000).default(""),
  templateOverride: z.enum(["classic", "modern", "minimal"]).nullable().default(null),
});

export const organizationSchema = z.object({
  name: z.string().trim().min(1, "Business name is required").max(200),
  email: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]),
  phone: z.string().trim().max(60).default(""),
  address: z.string().trim().max(1000).default(""),
  vatNumber: z.string().trim().max(60).default(""),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #2563eb"),
  template: z.enum(TEMPLATE_IDS as [string, ...string[]]),
  currency: z.string().trim().length(3).toUpperCase(),
  taxRatePercent: z.coerce.number().min(0).max(100),
  paymentTermsDays: z.coerce.number().int().min(0).max(365),
  numberPrefix: z.string().trim().max(20).default("INV-"),
  numberPadding: z.coerce.number().int().min(1).max(10),
  defaultNotes: z.string().trim().max(2000).default(""),
});

export type ClientInput = z.infer<typeof clientSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type OrganizationInput = z.infer<typeof organizationSchema>;
