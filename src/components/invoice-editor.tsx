"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { addDaysIso, todayIso } from "@/lib/dates";
import { centsToInput, computeTotals, formatMoney, parseMoneyToCents } from "@/lib/money";
import { saveInvoice } from "@/app/actions/invoices";
import { CURRENCIES } from "@/lib/defaults";
import { TEMPLATE_IDS, type Client, type Invoice, type Organization, type TemplateId } from "@/lib/types";

// A row's price is held as the raw string the user is typing, so that "12." or
// an empty field stays editable instead of being yanked to 0 mid-keystroke.
// It's converted to cents only when the value is read.
type EditorRow = {
  key: string;
  description: string;
  quantity: string;
  price: string;
  taxRatePercent: string;
};

/**
 * The tax rate to apply for a client.
 *
 * `null` on the client means "no override, use the org default". That is
 * deliberately distinct from `0`, which is an explicit zero-rating — a charity
 * set to 0% must stay at 0% even if the org default later changes, so `??`
 * rather than `||` is doing real work here.
 */
function rateForClient(client: Client | undefined, org: Organization): number {
  return client?.taxRatePercent ?? org.defaults.taxRatePercent;
}

function rowsFromInvoice(
  invoice: Invoice | null,
  org: Organization,
  client: Client | undefined,
): EditorRow[] {
  if (!invoice || invoice.lineItems.length === 0) {
    return [
      {
        key: crypto.randomUUID(),
        description: "",
        quantity: "1",
        price: "0.00",
        taxRatePercent: String(rateForClient(client, org)),
      },
    ];
  }

  return invoice.lineItems.map((item) => ({
    key: crypto.randomUUID(),
    description: item.description,
    quantity: String(item.quantity),
    price: centsToInput(item.unitPriceCents),
    taxRatePercent: String(item.taxRatePercent),
  }));
}

export function InvoiceEditor({
  organization,
  clients,
  invoice,
}: {
  organization: Organization;
  clients: Client[];
  invoice: Invoice | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState(invoice?.client.id ?? clients[0]?.id ?? "");
  const [issueDate, setIssueDate] = useState(invoice?.issueDate ?? todayIso());
  const [dueDate, setDueDate] = useState(
    invoice?.dueDate ?? addDaysIso(todayIso(), organization.defaults.paymentTermsDays),
  );
  const [currency, setCurrency] = useState(
    invoice?.currency ?? organization.defaults.currency,
  );
  const [notes, setNotes] = useState(invoice?.notes ?? organization.defaults.notes ?? "");
  const [terms, setTerms] = useState(invoice?.terms ?? "");
  const [templateOverride, setTemplateOverride] = useState<TemplateId | "">(
    invoice?.templateOverride ?? "",
  );
  const selectedClient = clients.find((candidate) => candidate.id === clientId);
  const clientRate = rateForClient(selectedClient, organization);

  const [rows, setRows] = useState<EditorRow[]>(() =>
    rowsFromInvoice(invoice, organization, clients.find((c) => c.id === (invoice?.client.id ?? clients[0]?.id))),
  );

  // Totals use the exact same computeTotals() the server uses, so the figures
  // on screen can never disagree with the figures in the PDF.
  const totals = useMemo(
    () =>
      computeTotals(
        rows.map((row) => ({
          description: row.description,
          quantity: Number(row.quantity) || 0,
          unitPriceCents: parseMoneyToCents(row.price) ?? 0,
          taxRatePercent: Number(row.taxRatePercent) || 0,
        })),
      ),
    [rows],
  );

  function updateRow(key: string, patch: Partial<EditorRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    setRows((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        description: "",
        quantity: "1",
        price: "0.00",
        taxRatePercent: String(clientRate),
      },
    ]);
  }

  /**
   * Switching client re-rates the lines.
   *
   * Only lines still carrying the previous client's rate are touched — a line
   * deliberately set to something else (a mixed-rate invoice) keeps its value,
   * because silently overwriting a hand-entered rate would be worse than
   * leaving one stale.
   */
  function changeClient(nextClientId: string) {
    const previousRate = String(clientRate);
    const nextRate = String(
      rateForClient(
        clients.find((candidate) => candidate.id === nextClientId),
        organization,
      ),
    );

    setClientId(nextClientId);
    setRows((current) =>
      current.map((row) =>
        row.taxRatePercent === previousRate ? { ...row, taxRatePercent: nextRate } : row,
      ),
    );
  }

  function removeRow(key: string) {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.key !== key)));
  }

  function submit() {
    setError(null);

    if (!clientId) {
      setError("Choose a client");
      return;
    }

    const lineItems = rows
      .filter((row) => row.description.trim() !== "")
      .map((row) => ({
        description: row.description.trim(),
        quantity: Number(row.quantity) || 0,
        unitPriceCents: parseMoneyToCents(row.price) ?? 0,
        taxRatePercent: Number(row.taxRatePercent) || 0,
      }));

    if (lineItems.length === 0) {
      setError("Add at least one line item with a description");
      return;
    }

    const formData = new FormData();
    formData.set(
      "payload",
      JSON.stringify({
        clientId,
        issueDate,
        dueDate,
        currency,
        lineItems,
        notes,
        terms,
        templateOverride: templateOverride === "" ? null : templateOverride,
      }),
    );

    startTransition(async () => {
      const result = await saveInvoice(invoice?.id ?? null, formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`/invoices/${result.id}`);
      router.refresh();
    });
  }

  const money = (cents: number) => formatMoney(cents, currency);

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Client">
            <select
              value={clientId}
              onChange={(event) => changeClient(event.target.value)}
              className={inputClass}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              {selectedClient?.taxRatePercent === null || selectedClient === undefined
                ? `Tax ${clientRate}% (your default)`
                : `Tax ${clientRate}% (set on this client)`}
              {selectedClient && !selectedClient.vatRegistered
                ? " · not VAT registered"
                : ""}
            </p>
          </Field>

          <Field label="Issue date">
            <input
              type="date"
              value={issueDate}
              onChange={(event) => {
                const value = event.target.value;
                setIssueDate(value);
                // Keep the due date in step with the payment terms unless the
                // user has deliberately moved it.
                setDueDate(addDaysIso(value, organization.defaults.paymentTermsDays));
              }}
              className={inputClass}
            />
          </Field>

          <Field label="Due date">
            <input
              type="date"
              value={dueDate}
              min={issueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Currency">
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className={inputClass}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Line items</h2>

        {/* Two layouts, one source of data.
            Below sm: a labelled card per line — the columns are far too narrow
            for a phone, and stacking them unlabelled leaves four anonymous
            number boxes with no way to tell qty from tax.
            From sm up: the compact spreadsheet-style grid. */}
        <div className="space-y-3 sm:space-y-2">
          <div className="hidden gap-2 px-1 text-xs font-medium uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-[1fr_80px_120px_80px_100px_36px]">
            <span>Description</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit price</span>
            <span className="text-right">Tax %</span>
            <span className="text-right">Amount</span>
            <span />
          </div>

          {rows.map((row, index) => {
            const amount =
              (parseMoneyToCents(row.price) ?? 0) * (Number(row.quantity) || 0);

            return (
              <div
                key={row.key}
                className="rounded-xl border border-slate-200 p-3 sm:grid sm:grid-cols-[1fr_80px_120px_80px_100px_36px] sm:items-center sm:gap-2 sm:rounded-none sm:border-0 sm:p-0"
              >
                <div className="mb-2 flex items-center justify-between sm:hidden">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Line {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    disabled={rows.length === 1}
                    className="-mr-1 min-h-9 rounded-md px-2 text-xs font-medium text-slate-500 transition hover:text-red-600 disabled:opacity-30"
                  >
                    Remove
                  </button>
                </div>

                <MobileLabel text="Description">
                  <input
                    value={row.description}
                    onChange={(event) =>
                      updateRow(row.key, { description: event.target.value })
                    }
                    placeholder="What are you billing for?"
                    className={inputClass}
                  />
                </MobileLabel>

                <div className="mt-2 grid grid-cols-3 gap-2 sm:contents">
                  <MobileLabel text="Qty">
                    <input
                      value={row.quantity}
                      inputMode="decimal"
                      onChange={(event) =>
                        updateRow(row.key, { quantity: event.target.value })
                      }
                      className={`${inputClass} sm:text-right`}
                    />
                  </MobileLabel>

                  <MobileLabel text="Unit price">
                    <input
                      value={row.price}
                      inputMode="decimal"
                      onChange={(event) => updateRow(row.key, { price: event.target.value })}
                      onBlur={(event) => {
                        const cents = parseMoneyToCents(event.target.value);
                        updateRow(row.key, {
                          price: cents === null ? "0.00" : centsToInput(cents),
                        });
                      }}
                      className={`${inputClass} sm:text-right`}
                    />
                  </MobileLabel>

                  <MobileLabel text="Tax %">
                    <input
                      value={row.taxRatePercent}
                      inputMode="decimal"
                      onChange={(event) =>
                        updateRow(row.key, { taxRatePercent: event.target.value })
                      }
                      className={`${inputClass} sm:text-right`}
                    />
                  </MobileLabel>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 sm:mt-0 sm:block sm:border-0 sm:pt-0">
                  <span className="text-xs text-slate-500 sm:hidden">Amount</span>
                  <span className="text-right text-sm font-medium tabular-nums text-slate-900 sm:block sm:px-1 sm:font-normal sm:text-slate-700">
                    {money(Math.round(amount))}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  disabled={rows.length === 1}
                  aria-label="Remove line"
                  className="hidden rounded-md px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 sm:block"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="mt-4 min-h-11 w-full rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-900 sm:w-auto sm:py-1.5"
        >
          + Add line
        </button>

        <div className="mt-6 flex justify-end">
          <dl className="w-full space-y-1.5 text-sm sm:max-w-xs">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="tabular-nums">{money(totals.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Tax</dt>
              <dd className="tabular-nums">{money(totals.taxCents)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{money(totals.totalCents)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 sm:p-5">
        <Field label="Notes (shown on the invoice)">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            className={inputClass}
            placeholder="Thanks for your business!"
          />
        </Field>
        <Field label="Terms">
          <textarea
            value={terms}
            onChange={(event) => setTerms(event.target.value)}
            rows={3}
            className={inputClass}
            placeholder="Payment due within 30 days."
          />
        </Field>
        <Field label="PDF template">
          <select
            value={templateOverride}
            onChange={(event) => setTemplateOverride(event.target.value as TemplateId | "")}
            className={inputClass}
          >
            <option value="">
              Use default ({organization.branding.template})
            </option>
            {TEMPLATE_IDS.map((id) => (
              <option key={id} value={id}>
                {id[0].toUpperCase() + id.slice(1)}
              </option>
            ))}
          </select>
        </Field>
      </section>

      {/* Sticky on mobile so Save is always reachable without scrolling past a
          long list of line items.
          bottom-14 clears the fixed bottom nav (~56px) — at bottom-0 the two
          bars stack on top of each other and the nav wins, hiding Save. */}
      <div className="sticky bottom-14 -mx-4 flex flex-row-reverse items-center gap-2 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:static sm:bottom-auto sm:mx-0 sm:flex-row sm:gap-3 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="min-h-11 flex-1 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60 sm:flex-none sm:py-2"
        >
          {pending ? "Saving…" : invoice ? "Save changes" : "Create invoice"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="min-h-11 shrink-0 rounded-lg px-4 py-2.5 text-sm text-slate-600 transition hover:text-slate-900 sm:py-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// text-base (16px) on mobile is deliberate: iOS Safari zooms the whole page
// when a focused input is smaller than 16px, which is jarring and leaves the
// layout shifted. sm:text-sm restores the tighter desktop scale.
// min-h-11 keeps every control at a comfortable ~44px tap target.
const inputClass =
  "w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:min-h-0 sm:py-2 sm:text-sm";

/**
 * Wraps a control with a label that only shows below `sm`.
 *
 * Above `sm` the grid has a single header row, so per-field labels would be
 * redundant; `sm:contents` makes the wrapper vanish from the layout entirely so
 * the input becomes a direct grid child and lines up with that header.
 */
function MobileLabel({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block sm:contents">
      <span className="mb-1 block text-xs text-slate-500 sm:hidden">{text}</span>
      {children}
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
