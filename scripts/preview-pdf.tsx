/**
 * Render sample invoices to PDF without touching Firebase.
 *
 * This is how you iterate on the templates: it exercises the real render path
 * with realistic data (mixed tax rates, long descriptions, enough lines to force
 * a page break) and needs no credentials, so template work never waits on the
 * Firebase console.
 *
 *   npx tsx scripts/preview-pdf.tsx
 *
 * Writes classic.pdf, modern.pdf and minimal.pdf into .preview/.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";

import { ClassicTemplate } from "../src/lib/pdf/templates/classic";
import { ModernTemplate } from "../src/lib/pdf/templates/modern";
import { MinimalTemplate } from "../src/lib/pdf/templates/minimal";
import { computeTotals } from "../src/lib/money";
import type { Invoice, LineItem, Organization } from "../src/lib/types";

const lineItems: LineItem[] = [
  {
    description: "Brand identity design — logo, colour system and type scale",
    quantity: 1,
    unitPriceCents: 240000,
    taxRatePercent: 20,
  },
  {
    description: "Website design and build (12 pages)",
    quantity: 1,
    unitPriceCents: 480000,
    taxRatePercent: 20,
  },
  { description: "Consultancy", quantity: 12.5, unitPriceCents: 9500, taxRatePercent: 20 },
  {
    description: "Stock photography licence — zero-rated",
    quantity: 3,
    unitPriceCents: 4500,
    taxRatePercent: 0,
  },
  {
    description:
      "Copywriting for landing pages, including two rounds of revisions and a final proofread against the agreed style guide",
    quantity: 6,
    unitPriceCents: 12000,
    taxRatePercent: 5,
  },
  { description: "Hosting setup", quantity: 1, unitPriceCents: 15000, taxRatePercent: 20 },
  { description: "Domain registration (2 years)", quantity: 2, unitPriceCents: 1800, taxRatePercent: 20 },
  { description: "Accessibility audit", quantity: 1, unitPriceCents: 85000, taxRatePercent: 20 },
  { description: "Training workshop", quantity: 2, unitPriceCents: 45000, taxRatePercent: 20 },
  { description: "Ongoing support retainer — Q3", quantity: 3, unitPriceCents: 60000, taxRatePercent: 20 },
];

const totals = computeTotals(lineItems);

const organization: Organization = {
  id: "demo",
  name: "Northwind Studio",
  email: "studio@northwind.example",
  phone: "+44 20 7946 0123",
  address: "48 Rivington Street\nLondon EC2A 3QP\nUnited Kingdom",
  vatNumber: "GB 123 4567 89",
  logoPath: null,
  branding: { accentColor: "#2563eb", template: "classic" },
  numbering: { prefix: "INV-", padding: 4, next: 43 },
  defaults: { currency: "GBP", taxRatePercent: 20, paymentTermsDays: 30, notes: "" },
  createdAt: new Date().toISOString(),
};

const invoice: Invoice = {
  id: "demo-invoice",
  number: "INV-0042",
  status: "sent",
  issueDate: "2026-08-16",
  dueDate: "2026-09-15",
  currency: "GBP",
  client: {
    id: "client-1",
    name: "Meridian Coffee Roasters Ltd",
    email: "accounts@meridiancoffee.example",
    address: "Unit 7, Bankside Yard\nManchester M1 5QA",
    // Flip to false to preview an unregistered client: the VAT line should
    // disappear from under their address in all three templates.
    vatRegistered: true,
    vatNumber: "GB 987 6543 21",
  },
  lineItems,
  ...totals,
  amountPaidCents: 150000,
  balanceCents: totals.totalCents - 150000,
  notes: "Thanks for your business — it's been a pleasure working with you.",
  terms: "Payment due within 30 days by bank transfer. Late payments accrue 4% interest.",
  templateOverride: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const templates = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
};

async function main() {
  mkdirSync(".preview", { recursive: true });

  for (const [name, Template] of Object.entries(templates)) {
    const element = createElement(Template, {
      invoice,
      organization,
      logoUrl: null,
      accentColor: organization.branding.accentColor,
    });

    const buffer = await renderToBuffer(element as unknown as ReactElement<DocumentProps>);
    writeFileSync(`.preview/${name}.pdf`, buffer);
    console.log(`✓ .preview/${name}.pdf  (${(buffer.length / 1024).toFixed(1)} KB)`);
  }

  console.log(
    `\nTotals check: subtotal ${totals.subtotalCents}, tax ${totals.taxCents}, total ${totals.totalCents} (cents)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
