import "server-only";

import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";

import { ClassicTemplate } from "@/lib/pdf/templates/classic";
import { ModernTemplate } from "@/lib/pdf/templates/modern";
import { MinimalTemplate } from "@/lib/pdf/templates/minimal";
import type { PdfDocumentProps } from "@/lib/pdf/types";
import type { Invoice, Organization, TemplateId } from "@/lib/types";

const TEMPLATES: Record<TemplateId, (props: PdfDocumentProps) => React.ReactElement> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
};

export function resolveTemplate(
  invoice: Pick<Invoice, "templateOverride">,
  organization: Pick<Organization, "branding">,
): TemplateId {
  const candidate = invoice.templateOverride ?? organization.branding?.template;
  return candidate && candidate in TEMPLATES ? (candidate as TemplateId) : "classic";
}

/**
 * Render an invoice to a PDF buffer.
 *
 * renderToBuffer (rather than renderToStream) because the whole document is
 * small and we want any render error to surface here, as a catchable exception,
 * rather than mid-stream after headers have already been sent.
 */
export async function renderInvoicePdf(props: {
  invoice: Invoice;
  organization: Organization;
  logoUrl: string | null;
}): Promise<Buffer> {
  const templateId = resolveTemplate(props.invoice, props.organization);
  const Template = TEMPLATES[templateId];

  const accentColor = props.organization.branding?.accentColor ?? "#2563eb";

  const element = createElement(Template, {
    invoice: props.invoice,
    organization: props.organization,
    logoUrl: props.logoUrl,
    accentColor,
  });

  // Each template returns a <Document>, but TypeScript only sees the component's
  // own prop type, so it can't tell that renderToBuffer's DocumentProps contract
  // is satisfied. The cast asserts what the templates structurally guarantee.
  return renderToBuffer(element as unknown as ReactElement<DocumentProps>);
}

/** A filename a human would recognise in their downloads folder. */
export function pdfFilename(invoice: Invoice, organization: Organization): string {
  const slug = organization.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const reference = invoice.number ?? `draft-${invoice.id.slice(0, 6)}`;
  return `${slug || "invoice"}-${reference}.pdf`.replace(/--+/g, "-");
}
