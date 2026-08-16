// All money in InvoiceBro is an integer number of minor units (cents, pence…).
//
// Floats are never used for money: 0.1 + 0.2 !== 0.3 in IEEE-754, and on an
// invoice that surfaces as a total that disagrees with the sum of its own lines.
// Quantities *may* be fractional (2.5 hours), so the one place rounding happens
// is quantity x unitPrice, and it happens exactly once, explicitly.

export type LineItemInput = {
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxRatePercent: number;
};

export type InvoiceTotals = {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
};

/** Half-up rounding. Math.round() is half-up for positives but rounds -0.5 to
 *  -0 (toward +∞), which would make credit notes drift; this is symmetric. */
export function roundHalfUp(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

/** Line total before tax, in cents. */
export function lineSubtotalCents(item: LineItemInput): number {
  return roundHalfUp(item.quantity * item.unitPriceCents);
}

/** Tax for a single line, in cents. */
export function lineTaxCents(item: LineItemInput): number {
  return roundHalfUp((lineSubtotalCents(item) * item.taxRatePercent) / 100);
}

/**
 * Invoice totals.
 *
 * Tax is computed per line and then summed, rather than applying one rate to
 * the subtotal. That is what makes mixed tax rates on a single invoice correct,
 * and it matches how tax authorities expect the arithmetic to be shown.
 */
export function computeTotals(items: LineItemInput[]): InvoiceTotals {
  let subtotalCents = 0;
  let taxCents = 0;

  for (const item of items) {
    subtotalCents += lineSubtotalCents(item);
    taxCents += lineTaxCents(item);
  }

  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

/** Format cents for display: 123456 + "GBP" -> "£1,234.56". */
export function formatMoney(cents: number, currency: string, locale = "en-GB"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/**
 * Parse user input ("1,234.56", "£1234.5", "1234") into cents.
 * Returns null when the text isn't a usable number, so callers can show a
 * validation error rather than silently storing NaN.
 */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[^0-9.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;

  return roundHalfUp(value * 100);
}

/** Cents -> a plain editable decimal string ("123456" -> "1234.56"). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
