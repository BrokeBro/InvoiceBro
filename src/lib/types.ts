// Shared domain types. These mirror the Firestore documents described in the
// plan; Firestore itself is schemaless, so this file is the schema of record.

export type TemplateId = "classic" | "modern" | "minimal";

export const TEMPLATE_IDS: TemplateId[] = ["classic", "modern", "minimal"];

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "partial"
  | "paid"
  | "overdue"
  | "void";

export type MemberRole = "owner" | "admin" | "member";

export type Organization = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  vatNumber: string;
  logoPath: string | null;
  branding: {
    accentColor: string;
    template: TemplateId;
  };
  numbering: {
    prefix: string;
    padding: number;
    next: number;
  };
  defaults: {
    currency: string;
    taxRatePercent: number;
    paymentTermsDays: number;
    notes: string;
  };
  createdAt: string;
};

export type Client = {
  id: string;
  name: string;
  email: string;
  address: string;
  /**
   * Whether this client is VAT registered.
   *
   * Deliberately independent of `taxRatePercent`. Registration is about whether
   * *they* have a VAT number to print under their address; the rate is what
   * *you* charge them. A VAT-registered business still bills an unregistered
   * consumer at the standard rate, and a charity may be zero-rated without
   * having a number — so tying the two together would get both cases wrong.
   */
  vatRegistered: boolean;
  vatNumber: string;
  /**
   * Default tax rate for this client, overriding the organization default.
   * `null` means "use the org default" — distinct from `0`, which is an
   * explicit zero-rating for charities, exports and the like.
   */
  taxRatePercent: number | null;
  currency: string;
  archived: boolean;
  createdAt: string;
};

/** The client details frozen onto an invoice when it is issued. */
export type ClientSnapshot = {
  id: string;
  name: string;
  email: string;
  address: string;
  vatRegistered: boolean;
  vatNumber: string;
};

export type LineItem = {
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxRatePercent: number;
};

export type Invoice = {
  id: string;
  number: string | null;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  currency: string;
  client: ClientSnapshot;
  lineItems: LineItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  balanceCents: number;
  notes: string;
  terms: string;
  templateOverride: TemplateId | null;
  createdAt: string;
  updatedAt: string;
};

export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  orgIds: string[];
  defaultOrgId: string;
};
