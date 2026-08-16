import type { TemplateId } from "@/lib/types";

/** Shape a brand-new organization starts with. */
export const DEFAULT_ORGANIZATION = {
  name: "My Business",
  email: "",
  phone: "",
  address: "",
  vatNumber: "",
  logoPath: null as string | null,
  branding: {
    accentColor: "#2563eb",
    template: "classic" as TemplateId,
  },
  numbering: {
    prefix: "INV-",
    padding: 4,
    next: 1,
  },
  defaults: {
    currency: "GBP",
    taxRatePercent: 20,
    paymentTermsDays: 30,
    notes: "",
  },
};

/** Currencies offered in the picker. Any ISO 4217 code works at runtime. */
export const CURRENCIES = [
  "GBP",
  "USD",
  "EUR",
  "AUD",
  "CAD",
  "NZD",
  "CHF",
  "SEK",
  "JPY",
  "ZAR",
];
