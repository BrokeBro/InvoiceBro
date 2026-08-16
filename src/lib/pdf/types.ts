import type { Invoice, Organization } from "@/lib/types";

/** Everything a template needs, resolved ahead of render. */
export type PdfDocumentProps = {
  invoice: Invoice;
  organization: Organization;
  /** Signed URL, resolved server-side. Null when there's no logo. */
  logoUrl: string | null;
  accentColor: string;
};
