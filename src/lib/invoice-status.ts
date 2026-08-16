import type { Invoice, InvoiceStatus } from "@/lib/types";

// Invoice status is derived, never hand-set.
//
// Two rules make this reliable:
//   * `draft` and `void` are sticky — they are explicit human decisions and no
//     amount of arithmetic should move an invoice out of them.
//   * everything else follows from the balance and the due date.
//
// `overdue` in particular is computed at read time rather than stored. A stored
// overdue flag would be wrong every night until some job fixed it; computing it
// means an invoice becomes overdue the moment its due date passes, with no
// scheduled sweep to run or to fail.

export function isTerminalStatus(status: InvoiceStatus): boolean {
  return status === "draft" || status === "void";
}

export function deriveStatus(invoice: {
  status: InvoiceStatus;
  totalCents: number;
  amountPaidCents: number;
  dueDate: string;
}): InvoiceStatus {
  if (isTerminalStatus(invoice.status)) return invoice.status;

  const balance = invoice.totalCents - invoice.amountPaidCents;

  if (invoice.totalCents > 0 && balance <= 0) return "paid";
  if (invoice.amountPaidCents > 0) return "partial";

  // Compare whole days, not instants: an invoice due today is not overdue until
  // today is over, regardless of what time it is now.
  const today = new Date().toISOString().slice(0, 10);
  if (invoice.dueDate < today) return "overdue";

  return "sent";
}

/** Apply the derived status to an invoice read from Firestore. */
export function withDerivedStatus(invoice: Invoice): Invoice {
  return {
    ...invoice,
    status: deriveStatus(invoice),
    balanceCents: invoice.totalCents - invoice.amountPaidCents,
  };
}

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partial: "Part paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  sent: "bg-blue-50 text-blue-700 ring-blue-200",
  partial: "bg-amber-50 text-amber-700 ring-amber-200",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  overdue: "bg-red-50 text-red-700 ring-red-200",
  void: "bg-slate-100 text-slate-500 ring-slate-200",
};
